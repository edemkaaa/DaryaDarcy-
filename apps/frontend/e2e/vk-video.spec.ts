import { test, expect, type Page } from "@playwright/test";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const embed =
  "https://vkvideo.ru/video_ext.php?oid=-227034863&id=456239527&hash=99fae216cf20dcdc";
async function fixture(page: Page, url: string) {
  const post = {
    id: 42,
    text: "VK_POST",
    photos: [],
    tags: ["video"],
    target: "feed",
    published: true,
    status: "published",
    createdAt: "2026-10-12T10:00:00Z",
    publishedAt: "2026-10-12T10:00:00Z",
    media: [{ id: 10, type: "video", url }],
  };
  await editorApi(page, (name) => {
    if (name === "videos.getById")
      return ok({
        id: 42,
        title: "VK_TEST_VIDEO",
        youtubeId: "",
        videoUrl: url,
      });
    if (name === "feed.getById") return ok(post);
    if (name === "feed.listPaginated")
      return ok({ posts: [post], nextCursor: null });
  });
}

for (const width of [320, 390, 1440]) {
  for (const path of ["/feed", "/post/42", "/video/42"]) {
    test(`VK uses the existing video frame at ${width}px on ${path}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      await fixture(page, embed);
      // Only frame layout/source selection is accepted here; this is not external playback.
      await page.route("https://vkvideo.ru/video_ext.php?**", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: "<html><body>Player fixture</body></html>",
        }),
      );
      await gotoWithSession(page, path);
      if (path !== "/video/42")
        await page
          .getByRole("button", { name: "Открыть видео", exact: true })
          .click();
      const player = page.getByTitle("VK Видео", { exact: true });
      await expect(player).toBeVisible();
      await expect(player).toHaveAttribute("src", embed + "&autoplay=0");
      const sizes = await player.evaluate((node) => {
        const rect = node.getBoundingClientRect(),
          frame = node.parentElement!.getBoundingClientRect();
        return {
          width: rect.width,
          height: rect.height,
          frameWidth: frame.width,
          frameHeight: frame.height,
          border: getComputedStyle(node).borderWidth,
        };
      });
      expect(sizes.width).toBeGreaterThan(100);
      expect(sizes.height).toBeGreaterThan(80);
      expect(Math.abs(sizes.width - sizes.frameWidth)).toBeLessThan(2);
      expect(Math.abs(sizes.height - sizes.frameHeight)).toBeLessThan(2);
      expect(sizes.border).toBe("0px");
      await expect(page.locator("video")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width === 390 && path === "/video/42")
        await page.screenshot({
          path: test.info().outputPath("vk-mobile.png"),
        });
    });
  }
}

test("a direct video file retains the native player", async ({ page }) => {
  const url = "https://example.test/kept.mp4";
  await fixture(page, url);
  await gotoWithSession(page, "/video/42");
  await expect(page.locator("video")).toHaveAttribute("src", url);
  await expect(page.getByTitle("VK Видео", { exact: true })).toHaveCount(0);
});

test("optional public VK playback advances in the embedded provider player", async ({
  page,
}) => {
  test.skip(
    !process.env.VK_BROWSER_TEST_EMBED_URL,
    "Requires explicit public-provider opt-in",
  );
  test.setTimeout(90_000);
  await fixture(page, process.env.VK_BROWSER_TEST_EMBED_URL!);
  await gotoWithSession(page, "/video/42");
  const video = page
    .frameLocator('iframe[title="VK Видео"]')
    .locator("video")
    .first();
  await expect(video).toBeAttached({ timeout: 45_000 });
  await video.evaluate((node: HTMLVideoElement) => {
    node.muted = true;
  });
  await page.getByTitle("VK Видео", { exact: true }).click();
  await expect
    .poll(() => video.evaluate((node: HTMLVideoElement) => node.paused))
    .toBe(false);
  await expect
    .poll(() => video.evaluate((node: HTMLVideoElement) => node.currentTime), {
      timeout: 20_000,
    })
    .toBeGreaterThan(0.5);
  await page.screenshot({
    path: test.info().outputPath("vk-public-playing.png"),
  });
  await video.evaluate((node: HTMLVideoElement) => node.pause());
});
