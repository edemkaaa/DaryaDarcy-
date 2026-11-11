import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chromium, webkit, expect as ui } from "@playwright/test";
import { transform } from "esbuild";
import { createServer, type Server } from "node:http";
import {
  createReadStream,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import type { AddressInfo } from "node:net";
import { dirname } from "node:path";

// Explicit local files only. No Next build, SQL, credentials or external requests.
const source = process.env.AUDIO_PLAYBACK_SOURCE;
const rendition = process.env.AUDIO_PLAYBACK_RENDITION;
const report = process.env.AUDIO_PLAYBACK_REPORT;
const enabled = Boolean(source && rendition);
const observations: unknown[] = [];
let server: Server | undefined;
let origin: string;
const ranges: string[] = [];
/** Проверяет явно заданные локальные исходник и rendition и поднимает loopback HTTP с точными MIME, HEAD и Range для неизменённого production-плеера. */
beforeAll(async () => {
  if (!enabled) return;
  for (const path of [source!, rendition!])
    expect(statSync(path).isFile()).toBe(true);
  const bundle = await transform(
    readFileSync(
      "apps/frontend/src/shared/media/browser-audio-player.ts",
      "utf8",
    ),
    { loader: "ts", format: "iife", globalName: "PlayerModule" },
  );
  const files: Record<string, { path: string; mime: string }> = {
    "/legacy": { path: source!, mime: "audio/mpeg" },
    "/mime-only": { path: source!, mime: "audio/mp4" },
    "/rendition": { path: rendition!, mime: "audio/mp4" },
  };
  server = createServer((req, res) => {
    const path = new URL(req.url!, "http://127.0.0.1").pathname;
    if (path === "/player.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(bundle.code);
    }
    if (path === "/") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.end(`<!doctype html><button id="play">Play</button>
        <button id="pause">Pause</button><button id="seek">Seek</button>
        <pre id="state"></pre><script src="/player.js"></script><script>
        const src=new URLSearchParams(location.search).get('src');
        if(!['/legacy','/mime-only','/rendition'].includes(src))throw Error('Invalid fixture');
        let audio;const player=new PlayerModule.BrowserAudioPlayer(src,s=>audio=new Audio(s));
        function update(){document.querySelector('#state').textContent=JSON.stringify({
          ...player.getSnapshot(),mediaError:audio?.error?.code??null,muted:audio?.muted,
          volume:audio?.volume,readyState:audio?.readyState});}
        player.subscribe(update);player.connect();update();
        document.querySelector('#play').onclick=()=>player.play().catch(update);
        document.querySelector('#pause').onclick=()=>player.pause();
        document.querySelector('#seek').onclick=()=>player.seekTo(player.duration*0.7);
        window.addEventListener('pagehide',()=>player.release());
        </script>`);
    }
    const file = files[path];
    if (!file) return void res.writeHead(404).end();
    const size = statSync(file.path).size;
    const match = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
    let start = 0,
      end = size - 1;
    if (req.headers.range) {
      if (!match || (!match[1] && !match[2]))
        return void res.writeHead(416).end();
      start = match[1]
        ? Number(match[1])
        : Math.max(0, size - Number(match[2]));
      end =
        match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      if (start > end || start >= size) return void res.writeHead(416).end();
      res.statusCode = 206;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
      ranges.push(`${path}:${start}-${end}`);
    }
    res.setHeader("Content-Type", file.mime);
    res.setHeader("Content-Length", end - start + 1);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (req.method === "HEAD") return void res.end();
    const body = createReadStream(file.path, { start, end });
    res.on("close", () => body.destroy());
    body.on("error", () => res.destroy());
    body.pipe(res);
  });
  await new Promise<void>((done) => server!.listen(0, "127.0.0.1", done));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
/** Закрывает локальный сервер и при явном пути создаёт новый защищённый отчёт рядом с исходником без перезаписи чужого файла. */
afterAll(async () => {
  await new Promise<void>((done) => {
    if (!server) return done();
    server.closeAllConnections();
    server.close(() => done());
  });
  if (enabled && report) {
    expect(dirname(report)).toBe(dirname(source!));
    writeFileSync(report, JSON.stringify({ observations, ranges }, null, 2), {
      flag: "wx",
      mode: 0o600,
    });
  }
});

/** Сравнивает реальную воспроизводимость локальных audio-файлов в Chromium и WebKit без SQL, внешней сети и Next-сборки. */
describe.skipIf(!enabled)(
  "real HTTP audio with the unchanged production player",
  () => {
    for (const [engine, type] of [
      ["chromium", chromium],
      ["webkit", webkit],
    ] as const) {
      /** Запускает выбранный browser engine с опциональным явно заданным WebKit executable. */
      const launch = () =>
        type.launch({
          headless: true,
          ...(engine === "webkit" && process.env.AUDIO_WEBKIT_EXECUTABLE_PATH
            ? { executablePath: process.env.AUDIO_WEBKIT_EXECUTABLE_PATH }
            : {}),
        });
      /** Наблюдает playback либо media-error исходника с прежним и исправленным MIME, не предполагая заранее отказ Safari от ALAC. */
      it(`${engine}: observes original MIME versus corrected MIME without assuming Safari rejects ALAC`, async () => {
        const browser = await launch();
        try {
          for (const path of ["/legacy", "/mime-only"]) {
            const page = await browser.newPage();
            await page.route("**/*", (route) =>
              route
                .request()
                .url()
                .startsWith(origin + "/")
                ? route.continue()
                : route.abort(),
            );
            await page.goto(`${origin}/?src=${encodeURIComponent(path)}`);
            await page.click("#play");
            await ui
              .poll(
                async () => {
                  const state = JSON.parse(
                    await page.locator("#state").innerText(),
                  );
                  return state.currentTime > 0.3 || Boolean(state.error);
                },
                { timeout: 18000 },
              )
              .toBe(true);
            observations.push({
              engine,
              path,
              ...JSON.parse(await page.locator("#state").innerText()),
            });
            await page.close();
          }
        } finally {
          await browser.close();
        }
      }, 45000);

      /** Проверяет звук без muted, запуск, seek, pause и resume утверждённого rendition на настоящем HTTP. */
      it(`${engine}: plays, seeks, pauses and resumes the approved rendition without muting`, async () => {
        const browser = await launch();
        try {
          const page = await browser.newPage();
          await page.route("**/*", (route) =>
            route
              .request()
              .url()
              .startsWith(origin + "/")
              ? route.continue()
              : route.abort(),
          );
          await page.goto(`${origin}/?src=/rendition`);
          await page.click("#play");
          /** Читает snapshot плеера из тестовой страницы для ожидания реального продвижения времени и ошибок. */
          const state = async () =>
            JSON.parse(await page.locator("#state").innerText());
          await ui
            .poll(async () => (await state()).currentTime, { timeout: 18000 })
            .toBeGreaterThan(0.3);
          expect(await state()).toMatchObject({
            playing: true,
            error: null,
            muted: false,
            volume: 1,
          });
          await page.click("#seek");
          await ui
            .poll(async () => {
              const value = await state();
              return value.currentTime / value.duration;
            })
            .toBeGreaterThan(0.69);
          await page.click("#pause");
          expect(await state()).toMatchObject({ playing: false, error: null });
          const paused = (await state()).currentTime;
          await page.click("#play");
          await ui
            .poll(async () => (await state()).currentTime)
            .toBeGreaterThan(paused + 0.2);
          observations.push({ engine, path: "/rendition", ...(await state()) });
        } finally {
          await browser.close();
        }
      }, 30000);
    }
  },
);
