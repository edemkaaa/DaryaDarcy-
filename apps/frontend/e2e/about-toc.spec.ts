import { expect, test, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

/** Ждём завершения плавной прокрутки, включая вложенные области и окно. */
async function waitForScroll(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const started = performance.now();
        let previous = "";
        let stableFrames = 0;
        const tick = () => {
          const positions = [
            scrollX,
            scrollY,
            ...Array.from(document.querySelectorAll(".ui-scroll")).map(
              (element) => element.scrollTop,
            ),
          ].join(",");
          stableFrames = positions === previous ? stableFrames + 1 : 0;
          previous = positions;
          if (
            (stableFrames >= 10 && performance.now() - started > 300) ||
            performance.now() - started > 4000
          ) {
            resolve();
          } else requestAnimationFrame(tick);
        };
        tick();
      }),
  );
}

/** Возвращаемся к оглавлению, не затрагивая фотокарусель и оболочку вкладок. */
async function returnToContents(page: Page) {
  await page
    .locator('[class*="partHeading"]')
    .first()
    .evaluate((heading) =>
      heading.closest(".ui-scroll")!.scrollTo({ top: 0, behavior: "instant" }),
    );
  await waitForScroll(page);
}

/** Проверяем видимый заголовок и отсутствие прокрутки внешних контейнеров. */
async function expectChapter(page: Page, index: number) {
  const geometry = await page
    .locator('[class*="partHeading"]')
    .nth(index)
    .evaluate((heading) => {
      const scroll = heading.closest(".ui-scroll")!;
      const box = heading.getBoundingClientRect();
      const outerPositions = [];
      let parent = scroll.parentElement;
      while (parent) {
        outerPositions.push([parent.scrollLeft, parent.scrollTop]);
        parent = parent.parentElement;
      }
      const hit = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + Math.min(8, box.height / 2),
      );
      return {
        gap: box.top - scroll.getBoundingClientRect().top,
        visible: hit === heading || Boolean(hit && heading.contains(hit)),
        windowPosition: [window.scrollX, window.scrollY],
        outerPositions,
      };
    });
  expect(
    Math.abs(geometry.gap - 20),
    `chapter ${index + 1} offset`,
  ).toBeLessThanOrEqual(1);
  expect(geometry.visible, `chapter ${index + 1} is not covered`).toBe(true);
  expect(geometry.windowPosition).toEqual([0, 0]);
  expect(geometry.outerPositions.every(([x, y]) => x === 0 && y === 0)).toBe(
    true,
  );
}

for (const viewport of [
  { width: 320, height: 400 },
  { width: 390, height: 844 },
  { width: 480, height: 844 },
]) {
  test(`all 11 contents links keep their target visible at ${viewport.width}px after toggles and resize`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await layoutApi(page);
    await gotoWithSession(page, "/library/about-me");
    await page.evaluate(() => document.fonts.ready);
    await page.setViewportSize(viewport);
    await waitForScroll(page);
    const toggle = page.getByRole("button", { name: "ОГЛАВЛЕНИЕ" });
    await toggle.click();
    await toggle.click();
    await toggle.click();
    const titles = await page
      .locator('[class*="partHeading"]')
      .allTextContents();
    expect(titles).toHaveLength(11);
    const carousel = page.locator(".ui-scroll-horizontal").first();
    await carousel.evaluate((element) => {
      element.scrollLeft = element.clientWidth;
    });
    await waitForScroll(page);
    const carouselPosition = await carousel.evaluate(
      (element) => element.scrollLeft,
    );
    for (let index = 0; index < titles.length; index++) {
      await returnToContents(page);
      if (index === 5) {
        await toggle.click();
        await toggle.click();
      }
      const link = page.getByRole("button", {
        name: titles[index],
        exact: true,
      });
      if (index === 10) {
        await link.focus();
        await link.press("Enter");
      } else await link.click();
      await waitForScroll(page);
      await expectChapter(page, index);
      expect(await carousel.evaluate((element) => element.scrollLeft)).toBe(
        carouselPosition,
      );
      if (index === 7 && process.env.F08_SCREENSHOTS) {
        await page.screenshot({
          path: `${process.env.F08_SCREENSHOTS}/after-${viewport.width}.png`,
        });
      }
    }
    await page.getByRole("button", { name: "Наверх" }).click();
    await waitForScroll(page);
    await expect
      .poll(() =>
        page
          .locator('[class*="partHeading"]')
          .first()
          .evaluate((heading) => heading.closest(".ui-scroll")!.scrollTop),
      )
      .toBe(0);
    await expect(carousel).toBeInViewport();
    expect(await carousel.evaluate((element) => element.scrollLeft)).toBe(
      carouselPosition,
    );
  });
}
