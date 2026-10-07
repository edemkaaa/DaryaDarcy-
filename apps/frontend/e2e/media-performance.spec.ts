import { test, expect } from "@playwright/test";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

const photos = Array.from(
  { length: 10 },
  (_, i) => `https://images.example.test/carousel-${i}.svg`,
);
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800"><rect width="640" height="800" fill="#d8c7ac"/></svg>';

test("a ten-photo carousel requests only adjacent slides and loads a distant slide on navigation", async ({
  page,
}) => {
  // Emulate browsers without native lazy loading: the application still owns
  // the carousel's network budget instead of relying on browser heuristics.
  await page.addInitScript(() => {
    new MutationObserver(() => {
      document
        .querySelectorAll<HTMLImageElement>(
          'img[src^="https://images.example.test/"][loading="lazy"]',
        )
        .forEach((img) => {
          img.loading = "eager";
        });
    }).observe(document, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["src", "loading"],
    });
  });
  await editorApi(page, (name) =>
    name === "feed.listPaginated"
      ? ok({
          posts: [
            {
              id: 1,
              text: "ALBUM",
              photos,
              tags: [],
              media: [],
              target: "feed",
              richText: null,
              likeCount: 0,
              commentCount: 0,
              createdAt: "2026-10-06T10:00:00Z",
              publishedAt: "2026-10-06T10:00:00Z",
            },
          ],
          nextCursor: null,
        })
      : undefined,
  );
  const requested = new Set<string>();
  await page.route("https://images.example.test/**", (route) => {
    requested.add(route.request().url());
    return route.fulfill({ contentType: "image/svg+xml", body: svg });
  });
  await gotoWithSession(page, "/feed");
  const album = page.getByRole("region", { name: "Фотографии поста" });
  await expect(album).toBeVisible();
  await expect.poll(() => requested.has(photos[0])).toBe(true);
  await page.waitForTimeout(400);
  expect(requested.size).toBeLessThanOrEqual(2);
  await album.locator(".ui-scroll-horizontal").focus();
  await page.keyboard.press("End");
  await expect(album.getByText("10 / 10", { exact: true })).toBeVisible();
  await expect.poll(() => requested.has(photos[9])).toBe(true);
  await album.getByRole("button", { name: "Открыть фото 10 из 10" }).click();
  const viewer = page.getByRole("dialog", { name: "Просмотр фотографий" });
  await expect(viewer.getByText("10 / 10", { exact: true })).toBeVisible();
  expect(requested.size).toBeLessThanOrEqual(4);
});

test("YouTube covers use our media route instead of the old production site", async ({
  page,
}) => {
  await layoutApi(page);
  await page.route("**/api/trpc/videos.list**", (route) =>
    route.fulfill({
      json: [
        {
          result: {
            data: {
              json: [
                {
                  id: 1,
                  youtubeId: "sq7pY1H_fYU",
                  title: "Видео",
                  thumbnailUrl:
                    "https://i.ytimg.com/vi/sq7pY1H_fYU/hqdefault.jpg",
                  duration: "10:00",
                  published: true,
                },
              ],
            },
          },
        },
      ],
    }),
  );
  await page.route("**/media/yt-thumb/**", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: svg }),
  );
  await gotoWithSession(page, "/videos");
  const cover = page.locator('img[src*="yt-thumb/"]').first();
  await expect(cover).toHaveAttribute(
    "src",
    "/media/yt-thumb/sq7pY1H_fYU/hqdefault.jpg",
  );
  await expect
    .poll(() => cover.evaluate((img) => (img as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
});

test("public feed cards request resized previews while the viewer retains the original", async ({
  page,
}) => {
  const original =
    "https://s3.twcstorage.ru/daryadarcy-s3/feed/fixture/photo_1.jpg";
  await editorApi(page, (name) =>
    name === "feed.listPaginated"
      ? ok({
          posts: [
            {
              id: 1,
              text: "PREVIEW",
              photos: [original],
              tags: [],
              media: [],
              target: "feed",
              richText: null,
              likeCount: 0,
              commentCount: 0,
              createdAt: "2026-10-06T10:00:00Z",
              publishedAt: "2026-10-06T10:00:00Z",
            },
          ],
          nextCursor: null,
        })
      : undefined,
  );
  const originals: string[] = [];
  await page.route("**/_next/image?**", (route) =>
    route.fulfill({ contentType: "image/svg+xml", body: svg }),
  );
  await page.route(original, (route) => {
    originals.push(route.request().url());
    return route.fulfill({ contentType: "image/svg+xml", body: svg });
  });
  await gotoWithSession(page, "/feed");
  const photo = page.locator('img[src^="/_next/image?"]').first();
  await expect
    .poll(() => photo.evaluate((img) => (img as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  expect(originals).toEqual([]);
  const current = new URL(
    await photo.evaluate((img) => (img as HTMLImageElement).currentSrc),
  );
  expect(current.searchParams.get("url")).toBe(original);
  expect(Number(current.searchParams.get("w"))).toBeLessThanOrEqual(1440);
  await photo.click();
  const viewer = page.getByRole("dialog", { name: "Просмотр фотографий" });
  await expect(viewer.locator("img").first()).toHaveAttribute("src", original);
  await expect.poll(() => originals.length).toBe(1);
});

test("club previews are smaller WebP files served by the real image processor", async ({
  page,
  request,
}) => {
  await layoutApi(page);
  await gotoWithSession(page, "/club");
  const photo = page.locator('img[src^="/_next/image?"]').first();
  await expect(photo).toBeVisible();
  await expect
    .poll(() => photo.evaluate((img) => (img as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);
  const preview = await photo.evaluate(
    (img) => (img as HTMLImageElement).currentSrc,
  );
  const response = await request.get(preview, {
    headers: { Accept: "image/webp" },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/webp");
  const original = new URL(preview).searchParams.get("url")!;
  const source = await request.get(original);
  expect((await response.body()).length).toBeLessThan(
    (await source.body()).length / 2,
  );
  await page.screenshot({ path: test.info().outputPath("club-previews.png") });
});

test("the image processor refuses private, signed and foreign sources before fetching", async ({
  request,
}) => {
  for (const source of [
    "http://127.0.0.1:3000/api/auth/me",
    "/api/auth/me",
    "/media/private/a.jpg",
    "https://s3.twcstorage.ru/other-bucket/feed/a.jpg",
    "https://s3.twcstorage.ru/daryadarcy-s3/club/a.jpg",
    "https://s3.twcstorage.ru/daryadarcy-s3/feed/a.jpg?signature=secret",
    "https://example.test/a.jpg",
  ]) {
    const response = await request.get(
      `/_next/image?url=${encodeURIComponent(source)}&w=640&q=75`,
    );
    expect(response.status(), source).toBe(400);
  }
});
