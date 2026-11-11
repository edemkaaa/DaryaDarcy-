import { test, expect } from "@playwright/test";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

/** Проверяем три колонки и подписи разных форматов в обеих вкладках сохранённого; превью не должно скачивать аудио/видео/документ ради отображения. */
for (const width of [320, 390, 1280]) {
  test(`saved previews keep three columns and identify media at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    const writes: string[] = [];
    const mediaRequests: string[] = [];
    const photo = "/saved-preview-photo.svg";
    const poster = "/api/media/post-photos/9001";
    const attachment = "/api/media/post-attachments/9002";
    await editorApi(page, (name, input) => {
      if (name === "feed.savedPostsPage") {
        const target = input.target;
        return ok({
          items: [
            { id: 1, text: "Фото из сохранённого", photos: [photo, photo] },
            {
              id: 2,
              text: "Видео из сохранённого",
              media: [{ type: "video", url: attachment, posterUrl: poster }],
            },
            {
              id: 3,
              richText: [
                {
                  type: "paragraph",
                  children: [{ text: "Текст из форматированной публикации" }],
                },
              ],
            },
            {
              id: 4,
              media: [
                { type: "audio", url: attachment, filename: "Знакомство.mp3" },
              ],
            },
            {
              id: 5,
              media: [
                { type: "document", url: attachment, filename: "Памятка.pdf" },
              ],
            },
            { id: 6, media: [{ type: "video", url: attachment }] },
          ].map((row) => ({
            text: "",
            photos: [],
            media: [],
            richText: null,
            target,
            createdAt: "2026-10-01T12:00:00Z",
            ...row,
          })),
          nextCursor: null,
        });
      }
    });
    page.on("request", (request) => {
      if (request.method() !== "GET") writes.push(request.url());
      if (request.url().includes(attachment)) mediaRequests.push(request.url());
    });
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="240"><rect width="120" height="240" fill="#a99b85"/><circle cx="60" cy="120" r="40" fill="#fdf8f0"/></svg>';
    for (const url of [photo, poster]) {
      await page.route(`**${url}`, (route) =>
        route.fulfill({ contentType: "image/svg+xml", body: svg }),
      );
    }
    await gotoWithSession(page, "/profile");
    for (const tab of ["Из ленты", "Из клуба"]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      const cards = page.locator('button[aria-label^="Открыть публикацию"]');
      await expect(cards).toHaveCount(6);
      const gallery = cards.filter({ hasText: "2 фото" });
      const video = cards.filter({ has: page.locator(`img[src="${poster}"]`) });
      await expect(gallery.locator("img")).toHaveAttribute("src", photo);
      await expect(video).toContainText("Видео");
      await expect(cards.nth(2)).toContainText(
        "Текст из форматированной публикации",
      );
      await expect(cards.nth(3)).toContainText("Знакомство");
      await expect(cards.nth(3)).toContainText("Аудио");
      await expect(cards.nth(4)).toContainText("Памятка");
      await expect(cards.nth(4)).toContainText("Документ");
      await expect(cards.nth(5)).toContainText("Видео");
      await expect(cards.nth(5)).not.toContainText("9002");
      await expect(cards.nth(5).locator("img,video,iframe")).toHaveCount(0);
      await gallery.scrollIntoViewIfNeeded();
      const boxes = await cards.evaluateAll((nodes) =>
        nodes.map((node) => {
          const { x, y, width, height } = node.getBoundingClientRect();
          return { x, y, width, height };
        }),
      );
      expect(boxes[0].y).toBe(boxes[1].y);
      expect(boxes[1].y).toBe(boxes[2].y);
      expect(boxes[3].y).toBeGreaterThan(boxes[0].y);
      expect(Math.abs(boxes[0].width - boxes[0].height)).toBeLessThan(1);
      await expect
        .poll(() =>
          gallery
            .locator("img")
            .evaluate((img: HTMLImageElement) => img.naturalWidth),
        )
        .toBeGreaterThan(0);
      expect(
        await gallery
          .locator("img")
          .evaluate((img) => getComputedStyle(img).objectFit),
      ).toBe("cover");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.screenshot({ path: info.outputPath(`saved-${width}.png`) });
    expect(writes).toEqual([]);
    expect(mediaRequests).toEqual([]);
  });
}
