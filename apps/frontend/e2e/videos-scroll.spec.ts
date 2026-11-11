import { test, expect } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

/** Профили мобильных браузеров и desktop проверяют настоящую прокрутку до последней карточки, закреплённую шапку Видео и сохранение позиции при возврате. */
for (const device of [
  { name: "iPhone", viewport: { width: 375, height: 812 }, isMobile: true },
  { name: "Android", viewport: { width: 412, height: 915 }, isMobile: true },
  { name: "desktop", viewport: { width: 1440, height: 900 }, isMobile: false },
]) {
  test.describe(device.name, () => {
    test.use({
      viewport: device.viewport,
      isMobile: device.isMobile,
      hasTouch: device.isMobile,
    });

    test("videos scroll to the last card and retain their position on return", async ({
      page,
      browserName,
    }) => {
      await layoutApi(page);
      await page.route("**/api/trpc/videos.list**", (route) =>
        route.fulfill({
          json: [
            {
              result: {
                data: {
                  json: Array.from({ length: 8 }, (_, index) => ({
                    id: index + 1,
                    youtubeId: "fixture",
                    title: `Материал ${index + 1}`,
                    thumbnailUrl: "/assets/interactive/quiz-cover.jpg",
                    videoUrl: null,
                    views: "1200",
                    publishedText: "2026",
                    duration: "12:30",
                    sortOrder: index + 1,
                    published: true,
                    createdAt: "2026-10-01T12:00:00Z",
                    updatedAt: "2026-10-01T12:00:00Z",
                  })),
                },
              },
            },
          ],
        }),
      );
      await gotoWithSession(page, "/");
      await page.locator('nav a[href="/videos"]').click();
      const panel = page.locator('[data-tab-screen="/videos"]');
      const scroll = panel.locator(".ui-scroll");
      const last = panel.getByRole("button", { name: /Материал 8/ });
      await expect(panel.locator(".ui-collection-item")).toHaveCount(8);
      await page.evaluate(() => document.fonts.ready);
      await expect(scroll).toHaveCSS("overflow-y", "auto");
      const menu = page.getByRole("navigation", { name: "Разделы" });
      const menuBefore = await menu.boundingBox();
      const header = page.locator("header");
      const headerBefore = await header.boundingBox();
      if (device.isMobile && browserName === "chromium") {
        // Native browser touch input, rather than synthetic DOM touch events.
        const input = await page.context().newCDPSession(page);
        const rect = (await scroll.boundingBox())!;
        const x = rect.x + rect.width / 2;
        const y = rect.y + rect.height * 0.65;
        await input.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y }],
        });
        for (let step = 1; step <= 8; step++) {
          await input.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x, y: y - step * 30 }],
          });
          await page.waitForTimeout(16);
        }
        await input.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await input.detach();
      } else if (device.isMobile) {
        // Playwright cannot send wheel or swipe input to mobile WebKit.
        // Exercise its native scroll container directly instead.
        await scroll.evaluate((node) => node.scrollBy({ top: 500 }));
      } else {
        await scroll.hover();
        await page.mouse.wheel(0, 500);
      }
      await expect
        .poll(() => scroll.evaluate((node) => node.scrollTop))
        .toBeGreaterThan(0);
      await expect(header).toHaveAttribute("data-hidden", "false");
      await expect(header).not.toHaveAttribute("inert");
      expect(await header.boundingBox()).toEqual(headerBefore);
      await scroll.evaluate((node) => {
        node.scrollTop = node.scrollHeight;
      });
      await expect(last).toBeInViewport();
      await expect(header).toHaveAttribute("data-hidden", "false");
      const [card, bottomMenu] = await Promise.all([
        last.boundingBox(),
        menu.boundingBox(),
      ]);
      expect(card!.y + card!.height).toBeLessThanOrEqual(bottomMenu!.y);
      expect(bottomMenu).toEqual(menuBefore);
      const position = await scroll.evaluate((node) => node.scrollTop);
      await page.locator('nav a[href="/interactive"]').click();
      await expect(page.getByText("ИНТЕРАКТИВ", { exact: true })).toBeVisible();
      await page.locator('nav a[href="/videos"]').click();
      await expect
        .poll(() => scroll.evaluate((node) => node.scrollTop))
        .toBe(position);
      await expect(last).toBeInViewport();
      // A section with a sliding header still slides; returning to Videos
      // resets it even when that section's scroll position was retained.
      await page.locator('nav a[href="/feed"]').click();
      const feedScroll = page.locator(
        '[data-tab-screen="/feed"] .ui-scroll:not(.ui-scroll-horizontal)',
      );
      await expect(page.getByPlaceholder("Поиск...")).toBeVisible();
      await feedScroll.evaluate((node) => {
        node.scrollTop = 300;
      });
      await expect(header).toHaveAttribute("data-hidden", "true");
      await page.locator('nav a[href="/videos"]').click();
      await expect(header).toHaveAttribute("data-hidden", "false");
      await expect(header).not.toHaveAttribute("inert");
      await expect
        .poll(() => scroll.evaluate((node) => node.scrollTop))
        .toBe(position);
      await expect(last).toBeInViewport();
    });
  });
}
