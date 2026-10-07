import { test, expect } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

type Frame = {
  header: { opacity: number; y: number };
  card?: { opacity: number; y: number };
};

for (const width of [390, 1440]) {
  test(`first entry fades from its initial frame without resetting visible content (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await layoutApi(page);
    await page.addInitScript(() => {
      const records: Record<string, Frame[]> = {};
      Object.assign(window, { entryFrames: records });
      document.addEventListener(
        "click",
        (event) => {
          const path = (event.target as Element)
            .closest("nav a[href]")
            ?.getAttribute("href");
          if (!path || !["/videos", "/interactive"].includes(path)) return;
          const frames: Frame[] = (records[path] = []);
          const start = performance.now();
          const sample = () => {
            const panel = document.querySelector(
              `[data-tab-screen="${path}"]:not([hidden])`,
            );
            const header = panel?.querySelector('[class*="headerSection"]');
            const card = panel?.querySelector(
              '[class*="cardsContainer"] > div',
            );
            const rect = (node: Element) => ({
              opacity: Number(getComputedStyle(node).opacity),
              y: node.getBoundingClientRect().y,
            });
            if (header)
              frames.push({
                header: rect(header),
                card: card ? rect(card) : undefined,
              });
            if (performance.now() - start < 1600) requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        },
        true,
      );
    });
    await gotoWithSession(page, "/");
    await page.evaluate(() => document.fonts.ready);
    for (const path of ["/videos", "/interactive"]) {
      await page.locator(`nav a[href="${path}"]`).click();
      await expect
        .poll(() =>
          page.evaluate((path) => {
            const frames = (
              window as unknown as {
                entryFrames: Record<string, Frame[]>;
              }
            ).entryFrames[path];
            return frames?.at(-1)?.header.opacity;
          }, path),
        )
        .toBe(1);
      const frames = await page.evaluate(
        (path) =>
          (window as unknown as { entryFrames: Record<string, Frame[]> })
            .entryFrames[path],
        path,
      );
      expect(frames[0].header.opacity).toBeLessThan(0.3);
      for (let index = 1; index < frames.length; index++) {
        expect(frames[index].header.opacity).toBeGreaterThanOrEqual(
          frames[index - 1].header.opacity - 0.02,
        );
        expect(frames[index].header.y).toBeCloseTo(frames[0].header.y, 0);
      }
      if (path === "/interactive") {
        await expect
          .poll(() =>
            page.evaluate(
              () =>
                (
                  window as unknown as { entryFrames: Record<string, Frame[]> }
                ).entryFrames["/interactive"].at(-1)?.card?.opacity,
            ),
          )
          .toBe(1);
        const cards = await page.evaluate(() =>
          (
            window as unknown as { entryFrames: Record<string, Frame[]> }
          ).entryFrames["/interactive"].flatMap((frame) =>
            frame.card ? [frame.card] : [],
          ),
        );
        expect(cards[0].opacity).toBe(0);
        expect(cards[0].y - cards.at(-1)!.y).toBeCloseTo(25, 0);
        for (let index = 1; index < cards.length; index++) {
          expect(cards[index].opacity).toBeGreaterThanOrEqual(
            cards[index - 1].opacity - 0.02,
          );
          expect(cards[index].y).toBeLessThanOrEqual(cards[index - 1].y + 0.5);
        }
      }
    }
  });

  test(`nonempty video data preserves both placeholder card positions (${width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await layoutApi(page);
    await page.addInitScript(() => {
      const opacity: number[] = [];
      Object.assign(window, { videoBodyOpacity: opacity });
      const observer = new MutationObserver(() => {
        const item = document.querySelector(
          '[data-tab-screen="/videos"]:not([hidden]) .ui-collection-item',
        );
        if (!item) return;
        observer.disconnect();
        const body = item.parentElement!;
        const sample = () => {
          const value = Number(getComputedStyle(body).opacity);
          opacity.push(value);
          if (value < 1) requestAnimationFrame(sample);
        };
        sample();
      });
      observer.observe(document, { childList: true, subtree: true });
    });
    let finish!: () => void;
    const held = new Promise<void>((resolve) => {
      finish = resolve;
    });
    await page.route("**/api/trpc/videos.list**", async (route) => {
      await held;
      await route.fulfill({
        json: [
          {
            result: {
              data: {
                json: [1, 2].map((id) => ({
                  id,
                  youtubeId: "fixture",
                  title: "Тёплые воспоминания",
                  thumbnailUrl: "/assets/interactive/quiz-cover.jpg",
                  videoUrl: null,
                  views: "1200",
                  publishedText: "2026",
                  duration: "12:30",
                  sortOrder: id,
                  published: true,
                  createdAt: "2026-10-01",
                  updatedAt: "2026-10-01",
                })),
              },
            },
          },
        ],
      });
    });
    try {
      await gotoWithSession(page, "/");
      await page.locator('nav a[href="/videos"]').click();
      const placeholder = page.locator('[data-content-placeholder="video"]');
      await expect(placeholder).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const before = await placeholder
        .locator('[aria-hidden="true"] > div')
        .evaluateAll((nodes) =>
          nodes.map((node) => {
            const { x, y, width, height } = node.getBoundingClientRect();
            return { x, y, width, height };
          }),
        );
      finish();
      await expect(placeholder).toHaveCount(0);
      const cards = page.locator(
        '[data-tab-screen="/videos"] .ui-collection-item > button',
      );
      await expect(cards).toHaveCount(2);
      const after = await cards.evaluateAll((nodes) =>
        nodes.map((node) => {
          const { x, y, width, height } = node.getBoundingClientRect();
          return { x, y, width, height };
        }),
      );
      expect(after).toEqual(before);
      await expect
        .poll(() =>
          page.evaluate(() =>
            (
              window as unknown as { videoBodyOpacity: number[] }
            ).videoBodyOpacity.at(-1),
          ),
        )
        .toBe(1);
      const opacity = await page.evaluate(
        () =>
          (window as unknown as { videoBodyOpacity: number[] })
            .videoBodyOpacity,
      );
      expect(opacity[0]).toBeLessThan(0.3);
      for (let index = 1; index < opacity.length; index++)
        expect(opacity[index]).toBeGreaterThanOrEqual(
          opacity[index - 1] - 0.02,
        );
    } finally {
      finish();
    }
  });
}

test("reduced motion shows the real screen immediately with no entrance animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await layoutApi(page);
  await gotoWithSession(page, "/interactive");
  const panel = page.locator('[data-tab-screen="/interactive"]');
  await expect(panel.locator('[class*="headerSection"]')).toHaveCSS(
    "opacity",
    "1",
  );
  await expect(panel.locator('[class*="cardsContainer"] > div')).toHaveCSS(
    "opacity",
    "1",
  );
  expect(
    await panel.evaluate(
      (node) => node.getAnimations({ subtree: true }).length,
    ),
  ).toBe(0);
});
