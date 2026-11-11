import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { collectVideo, parseSources } from "../tooling/data/collect-vk-oembed";
import { parseVkEmbed } from "../apps/backend/src/content/vk-video-input";

describe("offline VK source selection", () => {
  it("reads the existing TXT shape and deduplicates by video ID", () => {
    // Сценарий: TXT-список нормализуется и очищается от дублей по video ID.

    expect(
      parseSources(
        `Список роликов\n1. Весенний влог\n   https://vkvideo.ru/video-211171256_456239242\nhttps://vk.ru/video-211171256_456239242\nhttps://vk.com/video-211171256_456239241\n`,
      ),
    ).toEqual([
      "https://vkvideo.ru/video-211171256_456239242",
      "https://vkvideo.ru/video-211171256_456239241",
    ]);
  });
  it.each([
    "https://evil.test/video-211171256_456239242",
    "http://vkvideo.ru/video-211171256_456239242",
    "https://vkvideo.ru/video-123_456239242",
    "https://vkvideo.ru:8443/video-211171256_456239242",
    "https://user:pass@vkvideo.ru/video-211171256_456239242",
    "https://vkvideo.ru/video-211171256_456239242?token=private",
    "https://vkvideo.ru/video-211171256_456239242#private",
    "https://vkvideo.ru/video-211171256_456239242/extra",
    "https://vkvideo.ru/video-211171256_0",
    "https://vkvideo.ru/video-211171256_999999999999999999999",
    "https://vkvideo.ru/wall-211171256_41982",
    "https://vkvideo.ru/video-211171256_456239242 extra",
    "no links here",
  ])("refuses an unsafe or unsupported input: %s", (text) => {
    // Сценарий: Небезопасный host, протокол, параметры, чужое сообщество и неподдержанная форма отклоняются.

    expect(() => parseSources(text)).toThrow();
  });
  it("refuses an oversized file before parsing links", () => {
    // Сценарий: Большой исходный файл отклоняется до разбора ссылок.

    expect(() => parseSources("x".repeat(1024 * 1024 + 1))).toThrow();
  });
  it("bounds a single batch at100 distinct videos", () => {
    // Сценарий: Одна партия ограничена сотней различных видео.

    const text = Array.from(
      { length: 101 },
      (_, i) => `https://vkvideo.ru/video-211171256_${i + 1}`,
    ).join("\n");
    expect(() => parseSources(text)).toThrow();
  });
});

describe("oEmbed metadata through an isolated local HTTP provider", () => {
  const source = "https://vkvideo.ru/video-211171256_456239242";
  const iframe =
    '<iframe src="https://vk.ru/video_ext.php?oid=-211171256&amp;id=456239242&amp;hash=synthetic_hash" width="640" allowfullscreen></iframe>';
  // Matches the user-supplied oEmbed shape, without copying its real hash/cover.
  const trackedIframe = `<iframe
  src="https://vk.com/video_ext.php?oid=-211171256&id=456239242&hash=synthetic_hash&__ref=vk.web2"
  width="853"
  height="480"
  allow="autoplay; encrypted-media; fullscreen; picture-in-picture; screen-wake-lock;"
  frameborder="0"
  allowfullscreen></iframe>`;
  const good = () => /* Формирует минимальный синтетический VK oEmbed с корректными идентификаторами и обложкой. */ ({
    response: {
      version: "1.0",
      type: "video",
      title: "  Весенний влог  ",
      html: iframe,
      thumbnail_url: "https://sun9.example.test/cover.jpg?quality=90",
    },
  });
  let server: Server,
    base: string,
    reply: string,
    status: number,
    wait: boolean,
    bodyWait: boolean;
  const repliesBySource = new Map<string, string>();
  const requests: Array<{
    endpoint: string;
    method?: string;
    body: string;
    auth?: string;
    cookie?: string;
  }> = [];
  const mappedFetch: typeof fetch = async (url, init) => {
    // Перенаправляет внешний endpoint только на локальный HTTP-провайдер, записывая запрошенный адрес для проверки.

    const response = await fetch(base, init);
    requests.at(-1)!.endpoint = String(url);
    return response;
  };
  beforeAll(async () => {
    server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        requests.push({
          endpoint: "",
          method: req.method,
          body,
          auth: req.headers.authorization,
          cookie: req.headers.cookie,
        });
        if (wait) return;
        res.writeHead(status, {
          "Content-Type": "application/json",
          ...(status === 302 ? { Location: base + "/unexpected" } : {}),
        });
        if (bodyWait) {
          res.write('{"response":');
          return;
        }
        res.end(
          repliesBySource.get(new URLSearchParams(body).get("url") ?? "") ??
            reply,
        );
      });
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  beforeEach(() => {
    reply = JSON.stringify(good());
    status = 200;
    wait = false;
    bodyWait = false;
    requests.length = 0;
    repliesBySource.clear();
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  it("exports only verified matching src and optional cover metadata, without HTML or credentials", async () => {
    // Сценарий: Экспортируются проверенный src и обложка без HTML, cookie и авторизации.

    expect(await collectVideo(source, { fetchImpl: mappedFetch })).toEqual({
      sourceUrl: source,
      status: "ok",
      title: "Весенний влог",
      embedUrl:
        "https://vk.ru/video_ext.php?oid=-211171256&id=456239242&hash=synthetic_hash&autoplay=0",
      thumbnailSourceUrl: "https://sun9.example.test/cover.jpg?quality=90",
      issues: [],
    });
    expect(requests).toEqual([
      {
        endpoint: "https://api.vk.com/method/video.getOembed",
        method: "POST",
        body: new URLSearchParams({ url: source, v: "5.199" }).toString(),
        auth: undefined,
        cookie: undefined,
      },
    ]);
  });
  it("refuses an input outside the community before contacting any provider", async () => {
    // Сценарий: Внешний источник вне сообщества отклоняется до обращения к провайдеру.

    await expect(
      collectVideo("https://evil.test/video-211171256_456239242", {
        fetchImpl: mappedFetch,
      }),
    ).rejects.toThrow();
    expect(requests).toEqual([]);
  });
  it("normalizes the observed oEmbed tracking parameter before strict backend validation", async () => {
    // Сценарий: Наблюдаемый tracking-параметр нормализуется до строгой серверной проверки embed.

    reply = JSON.stringify({
      response: { ...good().response, html: trackedIframe },
    });
    const result = await collectVideo(source, { fetchImpl: mappedFetch });
    expect(result).toMatchObject({
      status: "ok",
      embedUrl:
        "https://vk.com/video_ext.php?oid=-211171256&id=456239242&hash=synthetic_hash&autoplay=0",
      issues: [],
    });
    // The application contract remains strict, including for tracking parameters.
    expect(
      parseVkEmbed(
        "https://vk.com/video_ext.php?oid=-211171256&id=456239242&hash=synthetic_hash&__ref=vk.web2",
      ),
    ).toBeNull();
  });
  it.each([
    iframe.replace("&amp;hash=synthetic_hash", ""),
    trackedIframe.replace("&hash=synthetic_hash", ""),
  ])("accepts an exported iframe without an optional hash", async (html) => {
    // Сценарий: Экспортированный iframe без необязательного hash остаётся допустимым.

    reply = JSON.stringify({ response: { ...good().response, html } });
    const result = await collectVideo(source, { fetchImpl: mappedFetch });
    expect(result).toMatchObject({ status: "ok", issues: [] });
    const player = new URL(result.embedUrl!);
    expect(player.searchParams.get("oid")).toBe("-211171256");
    expect(player.searchParams.get("id")).toBe("456239242");
    expect(player.searchParams.get("autoplay")).toBe("0");
    expect(player.searchParams.has("hash")).toBe(false);
    expect(player.searchParams.has("__ref")).toBe(false);
  });
  it.each([
    trackedIframe.replace("__ref=vk.web2", "__ref=unknown"),
    trackedIframe.replace("__ref=vk.web2", "__ref=vk.web2&__ref=vk.web2"),
    trackedIframe.replace("__ref=vk.web2", "__ref=vk.web2&unexpected=1"),
    trackedIframe.replace("hash=synthetic_hash", "hash="),
    trackedIframe.replace("456239242", "456239241"),
    trackedIframe.replace("-211171256", "-999"),
    trackedIframe.replace("vk.com", "evil.test"),
    trackedIframe.replace("&__ref=", "&id=456239242&__ref="),
  ])(
    "does not let tracking normalization bypass the player guards",
    async (html) => {
      // Сценарий: Нормализация tracking не обходит ограничения идентификаторов, host и дублирующихся параметров.

      reply = JSON.stringify({ response: { ...good().response, html } });
      expect(
        await collectVideo(source, { fetchImpl: mappedFetch }),
      ).toMatchObject({
        status: "incomplete",
        embedUrl: null,
        issues: ["invalid_embed"],
      });
    },
  );
  it.each([
    iframe.replace("456239242", "456239241"),
    iframe.replace("-211171256", "-999"),
    iframe.replace("vk.ru", "evil.test"),
    iframe.replace("hash=synthetic_hash", "hash="),
    iframe + "<script>unsafe()</script>",
    `<iframe title=' src="https://vk.ru/video_ext.php?oid=-211171256&id=456239242&hash=synthetic_hash"'></iframe>`,
    '<iframe src="https://vk.ru/video_ext.php?oid=-211171256&id=456239242&hash=synthetic_hash" src="https://evil.test"></iframe>',
  ])("does not export an unsupported or mismatched iframe", async (html) => {
    // Сценарий: Несогласованный либо неподдержанный iframe, включая лишний script/src, не экспортируется.

    reply = JSON.stringify({ response: { ...good().response, html } });
    const result = await collectVideo(source, { fetchImpl: mappedFetch });
    expect(result.status).toBe("incomplete");
    expect(result.embedUrl).toBeNull();
    expect(result.issues).toContain("invalid_embed");
  });
  it.each([
    undefined,
    "javascript:unsafe()",
    "http://example.test/a.jpg",
    "https://user:secret@example.test/a.jpg",
  ])(
    "does not treat unsafe/missing cover metadata as complete",
    async (thumbnail_url) => {
      // Сценарий: Небезопасная либо отсутствующая обложка не считается завершённым результатом.

      reply = JSON.stringify({
        response: { ...good().response, thumbnail_url },
      });
      const result = await collectVideo(source, { fetchImpl: mappedFetch });
      expect(result.status).toBe("incomplete");
      expect(result.thumbnailSourceUrl).toBeNull();
      expect(result.embedUrl).not.toBeNull();
      expect(result.issues).toContain("missing_or_invalid_thumbnail");
    },
  );
  it("marks a missing title without inventing it", async () => {
    // Сценарий: Пустой заголовок отмечается явно, без придумывания текста.

    reply = JSON.stringify({ response: { ...good().response, title: " " } });
    expect(
      await collectVideo(source, { fetchImpl: mappedFetch }),
    ).toMatchObject({
      status: "incomplete",
      title: null,
      issues: ["missing_title"],
    });
  });
  it.each([
    [
      JSON.stringify({
        error: { error_code: 15, error_msg: "PRIVATE_PROVIDER_DETAIL" },
      }),
      "vk_error_15",
    ],
    ["not JSON PRIVATE_PROVIDER_DETAIL", "invalid_response"],
    [
      JSON.stringify({ response: { ...good().response, type: "photo" } }),
      "invalid_response",
    ],
    ["x".repeat(65537), "invalid_response"],
  ])(
    "records a bounded safe failure without leaking raw responses",
    async (body, issue) => {
      // Сценарий: Ошибки провайдера, неверный тип/JSON и большой ответ дают ограниченную безопасную диагностику.

      reply = body;
      const result = await collectVideo(source, { fetchImpl: mappedFetch });
      expect(result).toMatchObject({
        status: "failed",
        title: null,
        embedUrl: null,
        thumbnailSourceUrl: null,
        issues: [issue],
      });
      expect(JSON.stringify(result)).not.toContain("PRIVATE_PROVIDER_DETAIL");
    },
  );
  it("records HTTP refusal rather than success", async () => {
    // Сценарий: HTTP-отказ не считается успешным сбором.

    status = 403;
    expect(
      await collectVideo(source, { fetchImpl: mappedFetch }),
    ).toMatchObject({ status: "failed", issues: ["http_403"] });
  });
  it("does not follow redirects", async () => {
    // Сценарий: Редирект провайдера не выполняется.

    status = 302;
    expect(
      await collectVideo(source, { fetchImpl: mappedFetch }),
    ).toMatchObject({ status: "failed" });
    expect(requests).toHaveLength(1);
  });
  it("bounds a hung provider request", async () => {
    // Сценарий: Зависание получения ответа ограничивается deadline.

    wait = true;
    expect(
      await collectVideo(source, { fetchImpl: mappedFetch, timeoutMs: 25 }),
    ).toMatchObject({ status: "failed", issues: ["request_timeout"] });
  });
  it("keeps the deadline active after response headers arrive", async () => {
    // Сценарий: Deadline остаётся активным после прихода заголовков.

    bodyWait = true;
    expect(
      await collectVideo(source, { fetchImpl: mappedFetch, timeoutMs: 25 }),
    ).toMatchObject({ status: "failed", issues: ["request_timeout"] });
  });
  it.each([0, 50])(
    "cancels a stalled response body even when its transport ignores abort (headers after %sms)",
    async (headerDelay) => {
      // Сценарий: Зависшее тело отменяется даже при игнорировании AbortSignal транспортом и поздних заголовках.

      let controller!: ReadableStreamDefaultController<Uint8Array>;
      let cancelled = false;
      const body = new ReadableStream<Uint8Array>({
        start(value) {
          // Подаёт начало JSON и оставляет тело незавершённым для проверки предельного срока чтения.

          controller = value;
          value.enqueue(new TextEncoder().encode('{"response":'));
        },
        cancel() {
          // Отмечает отмену незавершённого тела, даже если транспорт игнорирует AbortSignal.

          cancelled = true;
        },
      });
      const pending = collectVideo(source, {
        timeoutMs: 25,
        fetchImpl: async () => {
          // Возвращает локальное незавершённое тело сразу либо после задержки заголовков.

          if (headerDelay)
            await new Promise((resolve) => setTimeout(resolve, headerDelay));
          return new Response(body);
        },
      });
      let guard: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          pending,
          new Promise<string>((resolve) => {
            guard = setTimeout(() => resolve("body deadline missed"), 500);
          }),
        ]);
        expect(result).toMatchObject({
          status: "failed",
          issues: ["request_timeout"],
        });
        expect(cancelled).toBe(true);
      } finally {
        clearTimeout(guard);
        if (!cancelled) controller.close();
        await pending;
      }
    },
  );

  describe("native CLI and private export", () => {
    let directory: string, input: string, bootstrap: string;
    // CLI получает собственный временный каталог и bootstrap, разрешающий fetch только к локальной подмене известного oEmbed endpoint.
    beforeAll(async () => {
      directory = await mkdtemp(join(tmpdir(), "owned-vk-metadata-"));
      input = join(directory, "sources.txt");
      bootstrap = join(directory, "provider.mjs");
      await writeFile(input, source + "\n");
      await writeFile(
        bootstrap,
        `const realFetch=globalThis.fetch;
        globalThis.fetch=(url,init)=>{
          if(String(url)!=='https://api.vk.com/method/video.getOembed')throw Error('UNEXPECTED_DESTINATION');
          return realFetch(${JSON.stringify(base)},init);
        };`,
      );
    });
    afterAll(async () => {
      if (!directory.startsWith(join(tmpdir(), "owned-vk-metadata-")))
        throw Error("Fixture ownership mismatch");
      await rm(directory, { recursive: true });
    });
    const run = (args: string[]) =>
      /* Запускает CLI с локальным fetch-bootstrap и минимальным окружением в собственном временном каталоге. */ promisify(execFile)(
        process.execPath,
        [
          "--import",
          bootstrap,
          "--import",
          "tsx",
          "tooling/data/collect-vk-oembed.ts",
          ...args,
        ],
        {
          cwd: resolve("."),
          env: { PATH: process.env.PATH!, NODE_ENV: "test" },
          timeout: 10000,
        },
      );
    it("defaults to an offline plan without requesting the provider", async () => {
      // Сценарий: CLI по умолчанию строит офлайн-план без обращения к провайдеру.

      const result = await run(["--input", input]);
      expect(JSON.parse(result.stdout)).toMatchObject({
        mode: "plan",
        sourceCount: 1,
        networkRequested: false,
      });
      expect(requests).toEqual([]);
    });
    it("writes a new0600 report only with explicit collection and never embeds raw HTML", async () => {
      // Сценарий: Сбор по явному флагу создаёт новый отчёт 0600 без сырого HTML и без ложной отметки готовности импорта.

      const output = join(directory, "collected.json");
      const result = await run([
        "--input",
        input,
        "--output",
        output,
        "--collect",
      ]);
      expect(JSON.parse(result.stdout)).toMatchObject({
        mode: "collect",
        sourceCount: 1,
        summary: { ok: 1, incomplete: 0, failed: 0 },
      });
      const data = await readFile(output, "utf8");
      expect(JSON.parse(data)).toMatchObject({
        sourceCount: 1,
        playbackVerified: false,
        importReady: false,
        thumbnailBytesDownloaded: false,
        items: [{ status: "ok", sourceUrl: source, title: "Весенний влог" }],
      });
      expect(data).not.toContain("<iframe");
      expect((await stat(output)).mode & 0o777).toBe(0o600);
    });
    it("refuses an existing output before collecting and preserves it", async () => {
      // Сценарий: Существующий output сохраняется, отказ происходит до обращения к провайдеру.

      const output = join(directory, "existing.json");
      await writeFile(output, "ORIGINAL_CONTENT");
      await expect(
        run(["--input", input, "--output", output, "--collect"]),
      ).rejects.toMatchObject({ code: 1 });
      expect(await readFile(output, "utf8")).toBe("ORIGINAL_CONTENT");
      expect(requests).toEqual([]);
    });
    it("writes a canonical player for the observed multiline oEmbed response", async () => {
      // Сценарий: Многострочный oEmbed экспортируется в канонический player без tracking и HTML.

      reply = JSON.stringify({
        response: { ...good().response, html: trackedIframe },
      });
      const output = join(directory, "tracked.json");
      const result = await run([
        "--input",
        input,
        "--output",
        output,
        "--collect",
      ]);
      expect(JSON.parse(result.stdout).summary).toEqual({
        ok: 1,
        incomplete: 0,
        failed: 0,
      });
      const report = await readFile(output, "utf8");
      expect(JSON.parse(report).items[0].embedUrl).toBe(
        "https://vk.com/video_ext.php?oid=-211171256&id=456239242&hash=synthetic_hash&autoplay=0",
      );
      expect(report).not.toContain("__ref");
      expect(report).not.toContain("<iframe");
    });
    it("refuses output inside the repository before collecting", async () => {
      // Сценарий: Output внутри репозитория запрещён до сбора данных.

      const output = resolve(".owned-vk-oembed-test.json");
      await expect(
        run(["--input", input, "--output", output, "--collect"]),
      ).rejects.toMatchObject({ code: 1 });
      await expect(stat(output)).rejects.toMatchObject({ code: "ENOENT" });
      expect(requests).toEqual([]);
    });
    it("saves a safe failure report and exits2 without pretending collection succeeded", async () => {
      // Сценарий: Отказ сохраняется безопасным отчётом и кодом выхода 2 вместо ложного успеха.

      reply = JSON.stringify({
        error: { error_code: 15, error_msg: "PRIVATE_ERROR" },
      });
      const output = join(directory, "refused.json");
      await expect(
        run(["--input", input, "--output", output, "--collect"]),
      ).rejects.toMatchObject({ code: 2 });
      const text = await readFile(output, "utf8");
      expect(JSON.parse(text)).toMatchObject({
        importReady: false,
        items: [{ status: "failed", issues: ["vk_error_15"] }],
      });
      expect(text).not.toContain("PRIVATE_ERROR");
    });
    it("rejects unknown switches before requesting the provider", async () => {
      // Сценарий: Неизвестные CLI-флаги отклоняются до запроса.

      await expect(
        run(["--input", input, "--token", "not-a-real-token"]),
      ).rejects.toMatchObject({ code: 1 });
      expect(requests).toEqual([]);
    });
    it("continues the batch after a refusal and preserves separate per-video results", async () => {
      // Сценарий: Одна ошибка не прерывает партию: каждый ролик сохраняет собственный ok/failed/incomplete результат.

      const second = "https://vkvideo.ru/video-211171256_456239241";
      const third = "https://vkvideo.ru/video-211171256_456239238";
      const batch = join(directory, "batch.txt"),
        output = join(directory, "batch.json");
      await writeFile(batch, [source, second, third].join("\n"));
      repliesBySource.set(
        source,
        JSON.stringify({ error: { error_code: 15 } }),
      );
      repliesBySource.set(
        second,
        JSON.stringify({
          response: {
            ...good().response,
            html: iframe.replace("456239242", "456239241"),
          },
        }),
      );
      repliesBySource.set(
        third,
        JSON.stringify({
          response: {
            ...good().response,
            html: iframe.replace("456239242", "456239238"),
            thumbnail_url: undefined,
          },
        }),
      );
      await expect(
        run(["--input", batch, "--output", output, "--collect"]),
      ).rejects.toMatchObject({ code: 2 });
      const report = JSON.parse(await readFile(output, "utf8"));
      expect(report.summary).toEqual({ ok: 1, failed: 1, incomplete: 1 });
      expect(report.items).toMatchObject([
        { sourceUrl: source, status: "failed", embedUrl: null },
        {
          sourceUrl: second,
          status: "ok",
          embedUrl: expect.stringContaining("id=456239241&"),
        },
        { sourceUrl: third, status: "incomplete", thumbnailSourceUrl: null },
      ]);
      expect(requests).toHaveLength(3);
    });
  });
});
