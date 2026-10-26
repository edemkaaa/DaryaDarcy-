import { readFileSync } from "node:fs";
import { expect, test, type Page, type Locator } from "@playwright/test";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const bytes = readFileSync("e2e/fixtures/carousel-video.webm");
const vk = "https://vkvideo.ru/video_ext.php?oid=-1&id=2&hash=abcdefgh";
const gallery = "https://media.example.test/gallery.svg";
const videos = [
  {
    id: 11,
    type: "video",
    url: "/api/media/post-attachments/11",
    filename: "one.webm",
    posterUrl: "https://media.example.test/one.svg",
  },
  {
    id: 12,
    type: "video",
    url: "/api/media/post-attachments/12",
    filename: "two.webm",
    posterUrl: "https://media.example.test/two.svg",
  },
  {
    id: 13,
    type: "video",
    url: vk,
    filename: "VK",
    posterUrl: "https://media.example.test/three.svg",
  },
];
async function fixture(page: Page, count = 3, photos: string[] = []) {
  const requests: string[] = [];
  await page.route("https://**", (route) => route.abort());
  const post = {
    id: 42,
    text: "Видеозаписи для участниц",
    photos,
    tags: ["podborki"],
    target: "both",
    published: true,
    status: "published",
    sortOrder: 0,
    richText: null,
    createdAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    media: videos.slice(0, count),
    likeCount: 0,
    commentCount: 0,
  };
  await editorApi(page, (name) => {
    if (name === "feed.listPaginated" || name === "club.listByCategory")
      return ok({ posts: [post], nextCursor: null });
    if (name === "feed.getById") return ok(post);
    if (name === "club.subscription")
      return ok({
        hasClubAccess: true,
        subscribed: true,
        expiresAt: "2040-01-01T00:00:00Z",
        isOwner: true,
        cancelAtPeriodEnd: false,
        cancellationStatus: "none",
        monthlyPrice: "790",
      });
  });
  await page.route("https://media.example.test/**", (route) => {
    const name = new URL(route.request().url()).pathname;
    const color = name.includes("two")
      ? "#8B7355"
      : name.includes("three")
        ? "#6B7B5E"
        : "#5C4033";
    return route.fulfill({
      contentType: "image/svg+xml",
      body: `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800"><rect width="640" height="800" fill="${color}"/><circle cx="320" cy="370" r="160" fill="#FDF8F0" opacity=".16"/></svg>`,
    });
  });
  await page.route("**/api/media/post-attachments/*", (route) => {
    requests.push(new URL(route.request().url()).pathname);
    return route.fulfill({ contentType: "video/webm", body: bytes });
  });
  await page.route("https://vkvideo.ru/**", (route) => {
    requests.push("vk");
    return route.fulfill({
      contentType: "text/html",
      body: "<html><body>Controlled VK player</body></html>",
    });
  });
  return requests;
}
const carousel = (page: Page) =>
  page.getByRole("region", { name: "Видео поста", exact: true });
async function navigate(region: Locator, direction: "next" | "previous") {
  const scroll = region.getByLabel("Перелистывание видео", { exact: true });
  await scroll.focus();
  await scroll.press(direction === "next" ? "ArrowRight" : "ArrowLeft");
}

test.describe("desktop video carousel", () => {
  test.use({
    viewport: { width: 1440, height: 1000 },
    hasTouch: false,
    isMobile: false,
  });
  for (const path of ["/feed", "/club", "/post/42"]) {
    test(`${path}: every video has its own slide, and leaving it releases its player`, async ({
      page,
    }) => {
      const requests = await fixture(page);
      await gotoWithSession(page, path);
      const region = carousel(page);
      await expect(region.getByText("1 / 3", { exact: true })).toBeVisible();
      await expect(
        region.getByRole("button", {
          name: /Следующее видео|Предыдущее видео/,
        }),
      ).toHaveCount(0);
      await expect(region.locator("video,iframe")).toHaveCount(0);
      expect(requests).toEqual([]);
      await region
        .getByRole("button", { name: "Открыть видео", exact: true })
        .click();
      const video = region.locator("video");
      await expect(video).toHaveAttribute("src", videos[0].url);
      await video.evaluate(async (node: HTMLVideoElement) => {
        await node.play();
      });
      await expect
        .poll(() => video.evaluate((node: HTMLVideoElement) => node.paused))
        .toBe(false);
      const old = await video.elementHandle();
      await navigate(region, "next");
      await expect(region.getByText("2 / 3", { exact: true })).toBeVisible();
      await expect
        .poll(() => old!.evaluate((node) => node.getAttribute("src")))
        .toBeNull();
      expect(
        await old!.evaluate((node) => (node as HTMLVideoElement).paused),
      ).toBe(true);
      await expect(region.locator("video,iframe")).toHaveCount(0);
      expect(requests).not.toContain(videos[1].url);
      await expect(
        region.locator('[data-video-slide="1"] img'),
      ).toHaveAttribute("src", videos[1].posterUrl);
      await region
        .getByRole("button", { name: "Открыть видео", exact: true })
        .click();
      await expect(region.locator("video")).toHaveAttribute(
        "src",
        videos[1].url,
      );
      await navigate(region, "next");
      await expect(region.getByText("3 / 3", { exact: true })).toBeVisible();
      expect(requests).not.toContain("vk");
      await region
        .getByRole("button", { name: "Открыть видео", exact: true })
        .click();
      const frame = region.getByTitle("VK Видео", { exact: true });
      await expect(frame).toHaveAttribute("src", vk + "&autoplay=0");
      const oldFrame = await frame.elementHandle();
      await navigate(region, "previous");
      await expect(region.locator("video,iframe")).toHaveCount(0);
      expect(await oldFrame!.evaluate((node) => node.isConnected)).toBe(false);
      await expect(page).toHaveURL(
        new RegExp(path.replaceAll("/", "\\/") + "$"),
      );
      const scroll = region.getByLabel("Перелистывание видео", { exact: true });
      await scroll.focus();
      await page.keyboard.press("Home");
      await expect(region.getByText("1 / 3", { exact: true })).toBeVisible();
      await page.keyboard.press("End");
      await expect(region.getByText("3 / 3", { exact: true })).toBeVisible();
      await old?.dispose();
      await oldFrame?.dispose();
    });
  }
  test("resize preserves selection, photos stay separate, and drag never opens the post", async ({
    page,
  }, info) => {
    await fixture(page, 3, [gallery]);
    await gotoWithSession(page, "/feed");
    const region = carousel(page);
    await navigate(region, "next");
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(region.getByText("2 / 3", { exact: true })).toBeVisible();
    const scroll = region.getByLabel("Перелистывание видео", { exact: true });
    await expect
      .poll(() =>
        scroll.evaluate((node) => Math.abs(node.scrollLeft - node.clientWidth)),
      )
      .toBeLessThan(2);
    await expect(
      page.locator('[data-post-photo-frame] img[src*="gallery.svg"]'),
    ).toHaveCount(1);
    await page.screenshot({
      path: info.outputPath("video-carousel-mobile.png"),
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await scroll.scrollIntoViewIfNeeded();
    const box = (await scroll.boundingBox())!;
    await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.4);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.4, {
      steps: 12,
    });
    await page.mouse.up();
    await expect(region.getByText("3 / 3", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/feed$/);
    await page.screenshot({
      path: info.outputPath("video-carousel-desktop.png"),
    });
  });
  test("one saved video retains its existing presentation without carousel controls", async ({
    page,
  }) => {
    await fixture(page, 1, [gallery]);
    await gotoWithSession(page, "/feed");
    await expect(carousel(page)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Открыть видео", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Следующее видео", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-post-photo-frame] img[src*="gallery.svg"]'),
    ).toHaveCount(1);
  });
});

test.describe("mobile video carousel", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  test("native swipe changes previews, and overlay dots allow leaving an open VK player", async ({
    page,
    browserName,
  }, info) => {
    test.skip(
      browserName !== "chromium",
      "Native touch movement uses Chromium CDP.",
    );
    await fixture(page);
    await gotoWithSession(page, "/feed");
    const region = carousel(page);
    const session = await page.context().newCDPSession(page);
    async function swipe(target: Locator, forward = true) {
      await target.scrollIntoViewIfNeeded();
      const box = (await target.boundingBox())!;
      const start = box.x + box.width * (forward ? 0.85 : 0.15),
        end = box.x + box.width * (forward ? 0.15 : 0.85),
        y = box.y + box.height * 0.5;
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: start, y }],
      });
      for (let i = 1; i <= 12; i++) {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: start + ((end - start) * i) / 12, y }],
        });
        await page.waitForTimeout(30);
      }
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      // The counter updates while scrolling; wait for native snap to finish
      // before starting the next independent gesture or tapping the player.
      await expect
        .poll(() =>
          region
            .getByLabel("Перелистывание видео", { exact: true })
            .evaluate((node) =>
              Math.abs(
                node.scrollLeft -
                  Math.round(node.scrollLeft / node.clientWidth) *
                    node.clientWidth,
              ),
            ),
        )
        .toBeLessThan(1);
    }
    await swipe(region.getByLabel("Перелистывание видео", { exact: true }));
    await expect(region.getByText("2 / 3", { exact: true })).toBeVisible();
    await swipe(
      region.getByLabel("Свайпните для переключения видео", { exact: true }),
    );
    await expect(region.getByText("3 / 3", { exact: true })).toBeVisible();
    // Chromium briefly suppresses compatibility clicks after a synthetic native
    // fling. Check a fresh tap once that suppression has expired.
    await page.waitForTimeout(1200);
    await region
      .getByRole("button", { name: "Открыть видео", exact: true })
      .tap();
    await expect(region.getByTitle("VK Видео", { exact: true })).toBeVisible();
    await swipe(
      region.getByLabel("Свайпните для переключения видео", { exact: true }),
      false,
    );
    await expect(region.getByText("2 / 3", { exact: true })).toBeVisible();
    await expect(region.locator("iframe,video")).toHaveCount(0);
    await swipe(region.getByLabel("Перелистывание видео", { exact: true }));
    await expect(region.getByText("3 / 3", { exact: true })).toBeVisible();
    await swipe(
      region.getByLabel("Свайпните для переключения видео", { exact: true }),
      false,
    );
    await expect(region.getByText("2 / 3", { exact: true })).toBeVisible();
    await expect(
      region.getByRole("button", { name: /Следующее видео|Предыдущее видео/ }),
    ).toHaveCount(0);
    await expect(page).toHaveURL(/\/feed$/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath("video-carousel-touch.png"),
    });
  });
});
