import { test, expect, type Page } from "@playwright/test";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const embed =
  "https://vkvideo.ru/video_ext.php?oid=-227034863&id=456239527&hash=99fae216cf20dcdc";
async function fixture(page: Page, url: string, posterUrl?: string) {
  const post = {
    id: 42,
    text: "VK_POST",
    photos: [],
    richText: null,
    likeCount: 0,
    commentCount: 0,
    tags: ["video"],
    target: "feed",
    published: true,
    status: "published",
    createdAt: "2026-10-12T10:00:00Z",
    publishedAt: "2026-10-12T10:00:00Z",
    media: [
      {
        id: 10,
        type: "video",
        url,
        posterUrl: posterUrl ?? null,
        duration: null,
        filename: null,
        mimeType: null,
        fileSize: null,
        postId: 42,
        sortOrder: 0,
        createdAt: "2026-10-12T10:00:00Z",
      },
    ],
  };
  await editorApi(page, (name) => {
    if (name === "videos.getById")
      return ok({
        id: 42,
        title: "VK_TEST_VIDEO",
        youtubeId: "",
        videoUrl: url,
      });
    if (name === "videos.catalog")
      return ok({
        items: [
          {
            id: 42,
            title: "VK_TEST_VIDEO",
            duration: null,
            access: "public",
            canWatch: true,
          },
        ],
        nextCursor: null,
      });
    if (name === "videos.playback")
      return ok(
        url.includes("/video_ext.php")
          ? { id: 42, provider: "vk", embedUrl: url }
          : {
              id: 42,
              provider: "youtube",
              youtubeId: "testvideo42",
              videoUrl: url,
            },
      );
    if (name === "feed.getById") return ok(post);
    if (name === "feed.listPaginated" || name === "club.listByCategory")
      return ok({ posts: [post], nextCursor: null });
  });
}

for (const width of [320, 390, 1440]) {
  for (const path of ["/feed", "/club", "/post/42", "/video/42"]) {
    test(`VK uses the existing video frame at ${width}px on ${path}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 844 });
      const poster =
        path === "/club" ? "https://example.test/vk-poster.svg" : undefined;
      await fixture(page, embed, poster);
      if (poster)
        await page.route(poster, (route) =>
          route.fulfill({
            contentType: "image/svg+xml",
            body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="tan"/></svg>',
          }),
        );
      // Only frame layout/source selection is accepted here; this is not external playback.
      await page.route("https://vkvideo.ru/video_ext.php?**", (route) =>
        route.fulfill({
          contentType: "text/html",
          body: "<html><body>Player fixture</body></html>",
        }),
      );
      await gotoWithSession(page, path);
      if (path !== "/video/42") {
        const preview = page.getByRole("button", {
          name: "Открыть видео",
          exact: true,
        });
        await expect(preview).toBeVisible();
        if (poster)
          await expect
            .poll(() =>
              preview
                .locator("img")
                .evaluate((img: HTMLImageElement) => img.naturalWidth),
            )
            .toBe(400);
        const box = (await preview.boundingBox())!;
        expect(box.width / box.height).toBeCloseTo(16 / 9, 2);
        await preview.click();
      }
      if (path === "/club") {
        await expect(page.getByText("видео", { exact: true })).toBeVisible();
        await expect(page.getByText("video", { exact: true })).toHaveCount(0);
      }
      const player = page.getByTitle("VK Видео", { exact: true });
      await expect(player).toBeVisible();
      await expect(player).toHaveAttribute("src", embed + "&autoplay=0");
      await expect(
        page
          .frameLocator('iframe[title="VK Видео"]')
          .getByText("Player fixture", { exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", {
          name: "Перезагрузить плеер VK",
          exact: true,
        }),
      ).toHaveCount(0);
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
      expect(sizes.width / sizes.height).toBeCloseTo(16 / 9, 2);
      expect(Math.abs(sizes.width - sizes.frameWidth)).toBeLessThan(2);
      expect(Math.abs(sizes.height - sizes.frameHeight)).toBeLessThan(2);
      expect(sizes.border).toBe("0px");
      await expect(page.locator("video")).toHaveCount(0);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width === 390 && (path === "/video/42" || path === "/club"))
        await page.screenshot({
          path: test.info().outputPath("vk-mobile.png"),
        });
    });
  }
}

for (const path of ["/club", "/video/42"]) {
  for (const recovery of ["retry", "late load"]) {
    test(`VK ${recovery} on ${path}: recovery appears only for a stalled frame and stays away from the post menu`, async ({
      page,
    }, info) => {
      await page.clock.install();
      await fixture(page, embed);
      let requests = 0;
      let release!: () => void;
      const stalled = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("https://vkvideo.ru/**", async (route) => {
        requests++;
        if (requests === 1) await stalled;
        await route
          .fulfill({
            contentType: "text/html",
            body: "<html><body>Recovered player</body></html>",
          })
          .catch(() => {});
      });
      try {
        await gotoWithSession(page, path);
        if (path === "/club")
          await page
            .getByRole("button", { name: "Открыть видео", exact: true })
            .click();
        await expect.poll(() => requests).toBe(1);
        const button = page.getByRole("button", {
          name: "Перезагрузить плеер VK",
          exact: true,
        });
        await expect(button).toHaveCount(0);
        await page.clock.fastForward(15_001);
        const notice = page
          .getByRole("status")
          .filter({ hasText: "Плеер VK загружается дольше обычного" });
        await expect(notice).toBeVisible();
        await expect(
          notice.getByRole("button", { name: "Перезагрузить плеер VK" }),
        ).toBeVisible();
        const frame = (await page
          .getByTitle("VK Видео", { exact: true })
          .boundingBox())!;
        const box = (await button.boundingBox())!;
        expect(
          Math.abs(box.x + box.width / 2 - frame.x - frame.width / 2),
        ).toBeLessThan(2);
        expect(box.y).toBeGreaterThan(frame.y + 40);
        if (path === "/club") {
          const menu = page.getByRole("button", {
            name: "Действия с постом",
            exact: true,
          });
          const menuBox = (await menu.boundingBox())!;
          expect(box.y).toBeGreaterThanOrEqual(menuBox.y + menuBox.height);
          await menu.click({ trial: true });
        }
        await page.screenshot({ path: info.outputPath("vk-recovery.png") });
        if (recovery === "retry") {
          await button.click();
          await expect.poll(() => requests).toBe(2);
        }
        release();
        await expect(
          page
            .frameLocator('iframe[title="VK Видео"]')
            .getByText("Recovered player"),
        ).toBeVisible();
        await expect(button).toHaveCount(0);
        await expect(notice).toHaveCount(0);
        await page.clock.fastForward(16_000);
        await expect(button).toHaveCount(0);
        expect(requests).toBe(recovery === "retry" ? 2 : 1);
      } finally {
        release();
      }
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
