import { expect, test } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

for (const width of [390, 320]) {
  test(`home hero keeps one image and its geometry over time at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.clock.install({ time: new Date("2026-11-12T12:00:00Z") });
    await layoutApi(page);
    await gotoWithSession(page, "/");
    await page.evaluate(() => document.fonts.ready);
    const hero = page.locator('[class*="slideshowOverlay"]').locator("..");
    await hero
      .locator("img")
      .evaluateAll((images) =>
        Promise.all(images.map((img) => (img as HTMLImageElement).decode())),
      );
    await expect(hero.locator("img")).toHaveCount(1);
    const box = await hero.boundingBox();
    expect(box?.width).toBe(width);
    expect(box?.height).toBeCloseTo(width * 0.6, 0);
    for (const [index, elapsed] of [4000, 2000, 2000].entries()) {
      await page.clock.runFor(elapsed);
      await expect(hero).toBeInViewport();
      expect(await hero.boundingBox()).toEqual(box);
      if (process.env.HOME_HERO_SCREENSHOTS) {
        await page.screenshot({
          path: `${process.env.HOME_HERO_SCREENSHOTS}/home-${width}-frame-${index}.png`,
          animations: "disabled",
        });
      }
    }
    await expect(
      page.getByRole("navigation", { name: "Разделы", exact: true }),
    ).toBeInViewport();
  });
}
