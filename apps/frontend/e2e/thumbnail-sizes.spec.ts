import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const photo =
  "https://s3.twcstorage.ru/daryadarcy-s3/feed/thumbnail-size-fixture.jpg";
const post = {
  id: 700,
  text: "THUMBNAIL_POST",
  photos: [photo],
  media: [],
  tags: [],
  target: "feed",
  published: true,
  status: "published",
  source: "manual",
  createdAt: "2026-10-27T10:00:00Z",
  publishedAt: "2026-10-27T10:00:00Z",
  likeCount: 0,
  commentCount: 0,
};

/** Для ширины и DPR создаём отдельный контекст; реальный выбор currentSrc проверяется на детерминированных байтах, а не на живом S3. */
for (const width of [390, 1440])
  for (const dpr of [1, 2, 3]) {
    test(`thumbnail resources fit actual slots at ${width}px DPR${dpr}`, async ({
      browser,
    }, testInfo) => {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        deviceScaleFactor: dpr,
      });
      const page = await context.newPage();
      try {
        await editorApi(page, (name) => {
          if (name === "admin.posts" || name === "feed.savedPosts")
            return ok([post]);
          if (name === "articles.getById")
            return ok({
              id: 700,
              title: "THUMBNAIL_ARTICLE",
              access: "public",
              locked: false,
              published: true,
              coverUrl: null,
              sections: [{ type: "carousel", urls: [photo] }],
            });
        });
        const pixels = Buffer.alloc(1920 * 1080 * 3);
        for (let i = 0; i < pixels.length; i++)
          pixels[i] = (i * 37 + Math.floor(i / 1920) * 17) % 256;
        const original = await sharp(pixels, {
          raw: { width: 1920, height: 1080, channels: 3 },
        })
          .jpeg({ quality: 95 })
          .toBuffer();
        const bytes = new Map<string, number>();
        await page.route(photo, (route) =>
          route.fulfill({ contentType: "image/jpeg", body: original }),
        );
        // Real browser source selection; deterministic image bytes avoid depending on live S3 content.
        await page.route("**/_next/image?*", async (route) => {
          const url = new URL(route.request().url());
          if (url.searchParams.get("url") !== photo) return route.continue();
          const body = await sharp(original)
            .resize(Number(url.searchParams.get("w")))
            .webp({ quality: 75 })
            .toBuffer();
          bytes.set(url.href, body.length);
          await route.fulfill({ contentType: "image/webp", body });
        });
        /** Сверяем реальный CSS-слот с выбранной шириной ресурса в админке, сохранённом и статье; измерения прикладываем к отчёту. */
        const measurements = [];
        for (const [path, slot] of [
          ["/admin", 56],
          ["/profile", (Math.min(width, 480) - 40) * 0.31],
          ["/library/article/700", Math.min(width, 480) * 0.58],
        ] as const) {
          await gotoWithSession(page, path);
          // Use the source URL rather than generated CSS hashes to find this exact fixture image.
          const fixture = page.locator(
            'img[src*="thumbnail-size-fixture"]:visible',
          );
          await fixture.first().scrollIntoViewIfNeeded();
          await expect
            .poll(() =>
              fixture
                .first()
                .evaluate(
                  (img: HTMLImageElement) =>
                    img.complete && img.naturalWidth > 0,
                ),
            )
            .toBe(true);
          const measured = await fixture
            .first()
            .evaluate((img: HTMLImageElement) => ({
              currentSrc: img.currentSrc,
              width: img.getBoundingClientRect().width,
              sizes: img.sizes,
            }));
          expect(measured.width).toBeCloseTo(slot, 0);
          const resource = new URL(measured.currentSrc);
          const selected = Number(resource.searchParams.get("w"));
          const expected = [160, 320, 480, 640, 960, 1440].find(
            (candidate) => candidate >= slot * dpr,
          )!;
          expect(selected).toBe(expected);
          expect(resource.searchParams.get("q")).toBe("75");
          expect(bytes.get(measured.currentSrc)).toBeGreaterThan(0);
          expect(bytes.get(measured.currentSrc)!).toBeLessThan(original.length);
          measurements.push({
            path,
            dpr,
            ...measured,
            resourceWidth: selected,
            bytes: bytes.get(measured.currentSrc),
          });
        }
        await page
          .getByRole("button", {
            name: "Открыть изображение статьи",
            exact: true,
          })
          .click();
        const viewer = page.getByRole("dialog", {
          name: "Просмотр фотографий",
        });
        const large = viewer.locator("img").first();
        await expect(large).toHaveAttribute("sizes", "100vw");
        await expect
          .poll(() =>
            large.evaluate(
              (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
            ),
          )
          .toBe(true);
        const largeSource = new URL(
          await large.evaluate((img: HTMLImageElement) => img.currentSrc),
        );
        expect(largeSource.searchParams.get("url")).toBe(photo);
        expect(largeSource.searchParams.get("q")).toBe("75");
        expect(
          Number(largeSource.searchParams.get("w")),
        ).toBeGreaterThanOrEqual(measurements.at(-1)!.resourceWidth);
        await testInfo.attach("thumbnail-resources.json", {
          body: JSON.stringify(
            { originalBytes: original.length, measurements },
            null,
            2,
          ),
          contentType: "application/json",
        });
      } finally {
        await context.close();
      }
    });
  }
