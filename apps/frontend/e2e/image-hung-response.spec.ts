import { test, expect } from "@playwright/test";
import { createServer, request, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import sharp from "sharp";

// A real HTTP transport is essential here: Playwright routing disables the
// browser cache and cannot reproduce joining an unfinished image response.
/** Создаём настоящий HTTP-прокси: первый image-response отдаёт начало байтов и остаётся незавершённым, следующий возвращает весь файл; routing Playwright не воспроизводит такой cache-join. */
async function photoServer(upstream: string, optimized: boolean) {
  const bytes = await sharp({
    create: { width: 640, height: 800, channels: 3, background: "#e4cfb4" },
  })
    .png()
    .toBuffer();
  let origin = "";
  let requests = 0;
  let first: ServerResponse | undefined;
  const requestedPaths: string[] = [];
  const photoPath = "/media/hung-photo.png?signature=unchanged";
  const publicPhoto =
    "https://s3.twcstorage.ru/daryadarcy-s3/feed/hung-fixture.jpg";
  const capabilities = {
    smsLogin: false,
    penPals: false,
    shopOnlinePayment: false,
    webPush: false,
    privateContentUploads: false,
  };
  /** Выбираем прямой подписанный URL либо public-источник image processor, сохраняя одинаковый пост. */
  const post = () => ({
    id: 1,
    text: "Фото с незавершённым ответом",
    photos: [optimized ? publicPhoto : origin + photoPath],
    tags: [],
    media: [],
    richText: null,
    target: "feed",
    likeCount: 0,
    commentCount: 0,
    createdAt: "2026-10-06T10:00:00Z",
    publishedAt: "2026-10-06T10:00:00Z",
  });
  const server = createServer((req, res) => {
    const url = new URL(req.url!, origin);
    /** Синтетические API всегда no-store, чтобы измерялся только настоящий image-cache. */
    const json = (value: unknown, status = 200) => {
      res.writeHead(status, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify(value));
    };
    if (
      url.pathname === "/media/hung-photo.png" ||
      (url.pathname === "/_next/image" &&
        url.searchParams.get("url") === publicPhoto)
    ) {
      requests += 1;
      requestedPaths.push(req.url!);
      // The application must preserve the complete URL, including signatures.
      if (!optimized && req.url !== photoPath)
        return json({ error: "Changed photo URL" }, 403);
      res.writeHead(200, {
        "Content-Type": "image/png",
        "Content-Length": bytes.length,
        "Cache-Control": "public, max-age=3600",
        ETag: '"photo-v1"',
      });
      if (requests === 1) {
        first = res;
        res.write(bytes.subarray(0, 32));
        return; // Never release this response to make the retry pass.
      }
      return res.end(bytes);
    }
    if (url.pathname === "/api/auth/me") return json({ user: null });
    if (url.pathname === "/api/capabilities") return json(capabilities);
    if (url.pathname === "/api/launch-config")
      return json({
        revision: 1,
        season: "autumn",
        appearance: { startsOn: "09-01", backgroundUrl: null, bannerUrl: null },
        managerEmail: "manager@example.test",
        orderMethod: "email-client",
        capabilities,
      });
    if (url.pathname.startsWith("/api/trpc/")) {
      const results = decodeURIComponent(
        url.pathname.slice("/api/trpc/".length),
      )
        .split(",")
        .map((name) => {
          let data: unknown = [];
          if (name === "feed.listPaginated")
            data = { posts: [post()], nextCursor: null };
          if (name === "feed.getById") data = post();
          if (name === "notifications.latest")
            data = { feedId: 1, feedText: "", clubId: null, clubText: "" };
          return { result: { data: { json: data } } };
        });
      return json(url.searchParams.has("batch") ? results : results[0]);
    }
    if (url.pathname.startsWith("/api/"))
      return json({ error: "Unsupported synthetic API" }, 404);
    const proxy = request(
      new URL(req.url!, upstream),
      {
        method: req.method,
        headers: req.headers,
      },
      (response) => {
        res.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(res);
      },
    );
    proxy.on("error", () => {
      if (!res.headersSent) res.writeHead(502);
      res.end();
    });
    req.pipe(proxy);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    origin,
    photoPath,
    /** Отдаём счётчик сетевых запросов, который отличает новый retry от присоединения к зависшему ответу. */
    requests: () => requests,
    /** Сохраняем ссылку на первый незавершённый ответ для проверки его отмены. */
    first: () => first,
    requestedPaths,
    /** Закрываем все соединения перед ожиданием server.close, иначе зависшая fixture удержала бы сам тест. */
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

/** Проверяем direct, optimized preview и viewer на реальном времени: ручной retry отменяет старую загрузку, сохраняет точный URL и делает успешный ответ кешируемым после reload. */
for (const mode of ["direct", "preview", "viewer"] as const) {
  test(`manual retry recovers an unfinished HTTP response with cache enabled (${mode})`, async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(60_000);
    const server = await photoServer(baseURL!, mode === "preview");
    try {
      await page.addInitScript(() =>
        localStorage.setItem("@darcy_install_guide_seen", "1"),
      );
      await page.goto(server.origin + "/feed", {
        waitUntil: "domcontentloaded",
      });
      const frame = page.getByRole("button", {
        name: "Открыть фото",
        exact: true,
        includeHidden: true,
      });
      await expect(frame).toBeVisible({ timeout: 15_000 });
      await expect.poll(server.requests).toBe(1);
      const before = await frame.boundingBox();
      const initialSrc = await frame
        .locator("img")
        .evaluate((img: HTMLImageElement) => img.currentSrc);
      if (mode === "preview")
        await expect(frame.locator("img")).toHaveAttribute("srcset", /\d+w/);
      const viewer = page.getByRole("dialog", { name: "Просмотр фотографий" });
      if (mode === "viewer") {
        await frame.click();
        await expect(viewer).toBeVisible();
      }
      const container = mode === "viewer" ? viewer : frame.locator("..");
      const photo =
        mode === "viewer" ? viewer.locator("img") : frame.locator("img");
      const retry = container.getByRole("button", {
        name: "Повторить загрузку",
        exact: true,
      });
      // Real time is intentional: freezing the browser clock also changes when
      // it releases native image resources, masking the cancellation behavior.
      await expect(retry).toBeVisible({ timeout: 35_000 });
      await expect(container.getByRole("status")).toHaveCount(0);
      expect((await frame.boundingBox())!.height).toBeCloseTo(
        before!.height,
        1,
      );
      expect(server.first()?.writableEnded).toBe(false);
      await page.screenshot({ path: test.info().outputPath("timed-out.png") });
      await retry.click();
      await expect.poll(server.requests, { timeout: 8_000 }).toBe(2);
      await expect.poll(() => server.first()?.destroyed).toBe(true);
      expect(server.requestedPaths[1]).toBe(server.requestedPaths[0]);
      await expect
        .poll(() =>
          photo.evaluate(
            (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
          ),
        )
        .toBe(true);
      expect(
        await photo.evaluate((img: HTMLImageElement) => img.currentSrc),
      ).toBe(initialSrc);
      await expect(retry).toHaveCount(0);
      expect((await frame.boundingBox())!.height).toBeCloseTo(
        before!.height,
        1,
      );
      await page.screenshot({ path: test.info().outputPath("recovered.png") });

      // The recovered response remains cacheable on a real document reload.
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect
        .poll(() =>
          frame
            .locator("img")
            .evaluate(
              (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
            ),
        )
        .toBe(true);
      expect(server.requests()).toBe(2);
    } finally {
      await page.close();
      await server.close();
    }
  });
}
