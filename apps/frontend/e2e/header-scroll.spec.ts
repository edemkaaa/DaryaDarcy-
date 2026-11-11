import { test, expect, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

const headerSelector = 'header[aria-label="Навигация профиля"]';
const screenSelector = "main .ui-scroll:not(.ui-scroll-horizontal):visible";

/** Меняем scroll только видимого основного контейнера, не горизонтальных или вложенных областей. */
async function scrollTo(page: Page, y: number) {
  await page
    .locator(screenSelector)
    .first()
    .evaluate((node, top) => {
      node.scrollTop = top;
    }, y);
}

/** Сверяем визуальную границу и inert со значением data-hidden: скрытая шапка не должна оставаться доступной фокусу. */
async function expectHidden(page: Page, hidden: boolean) {
  const header = page.locator(headerSelector);
  await expect(header).toHaveAttribute("data-hidden", String(hidden));
  await expect
    .poll(() => header.evaluate((node) => node.hasAttribute("inert")))
    .toBe(hidden);
  await expect
    .poll(() =>
      header.evaluate((node, isHidden) => {
        const rect = node.getBoundingClientRect();
        return isHidden ? rect.bottom <= 0 : Math.abs(rect.top) < 0.1;
      }, hidden),
    )
    .toBe(true);
}

/** Три эмулированных профиля проверяют направление, неизменность контента/меню и независимость от nested/horizontal scroll. */
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

    test("header slides out and back without moving content or the bottom menu", async ({
      page,
    }) => {
      await layoutApi(page);
      await gotoWithSession(page, "/feed");
      await expect(page.locator("main .ui-spinner")).toHaveCount(0);
      const header = page.locator(headerSelector);
      const main = await page.locator("main").boundingBox();
      const tabs = await page
        .getByRole("navigation", { name: "Разделы" })
        .boundingBox();
      await expectHidden(page, false);
      await scrollTo(page, 300);
      await expectHidden(page, true);
      expect(await page.locator("main").boundingBox()).toEqual(main);
      expect(
        await page.getByRole("navigation", { name: "Разделы" }).boundingBox(),
      ).toEqual(tabs);
      await scrollTo(page, 280);
      await expectHidden(page, false);
      await expect(
        header.getByRole("link", { name: "Открыть профиль" }),
      ).toBeInViewport();
      await scrollTo(page, 500);
      await expectHidden(page, true);
      await scrollTo(page, 0);
      await expectHidden(page, false);
      // The full safe-area height, not a fixed pixel offset, moves out of view.
      await header.evaluate((node) => {
        node.style.height = "90px";
      });
      await scrollTo(page, 300);
      await expectHidden(page, true);
      await header.evaluate((node) => {
        node.style.removeProperty("height");
      });
      await page.screenshot({
        path: test.info().outputPath("header-hidden.png"),
      });
      await scrollTo(page, 280);
      await expectHidden(page, false);
      await page.screenshot({
        path: test.info().outputPath("header-visible.png"),
      });
    });

    test("navigation resets the header; horizontal and nested scrolling leave it alone", async ({
      page,
    }) => {
      await layoutApi(page, true);
      await gotoWithSession(page, "/club");
      await expect(page.locator("main .ui-spinner")).toHaveCount(0);
      await page.getByRole("button", { name: "Открыть фильтры клуба" }).click();
      const drawer = page.getByRole("region", { name: "Фильтры клуба" });
      await drawer.locator(".ui-scroll").evaluate((node) => {
        node.scrollTop = node.scrollHeight;
        node.dispatchEvent(new Event("scroll"));
      });
      await expectHidden(page, false);
      await page.getByRole("button", { name: "Закрыть фильтры клуба" }).click();
      await scrollTo(page, 300);
      await expectHidden(page, true);
      // A sideways gallery and a nested vertical area must not reveal the header.
      await page
        .locator(screenSelector)
        .first()
        .evaluate((node) => {
          for (const className of [
            "ui-scroll ui-scroll-horizontal",
            "ui-scroll",
          ]) {
            const child = document.createElement("div");
            child.className = className;
            node.appendChild(child);
            child.dispatchEvent(new Event("scroll"));
            child.remove();
          }
        });
      await expectHidden(page, true);
      await page
        .getByRole("navigation", { name: "Разделы" })
        .getByRole("link", { name: "Лента" })
        .click();
      await expect(page).toHaveURL(/\/feed$/);
      await expectHidden(page, false);
    });
  });
}

/** Клавиатурная навигация возвращает шапку, а фокус внутри управляющих элементов удерживает её видимой. */
test("keyboard navigation reveals the header and focused controls stay accessible", async ({
  page,
}) => {
  await layoutApi(page);
  await gotoWithSession(page, "/feed");
  await expect(page.locator("main .ui-spinner")).toHaveCount(0);
  await scrollTo(page, 300);
  await expectHidden(page, true);
  await page.keyboard.press("Tab");
  await expectHidden(page, false);
  await page
    .locator(headerSelector)
    .getByRole("link", { name: "Открыть профиль" })
    .focus();
  await scrollTo(page, 500);
  await expectHidden(page, false);
});

/** Предпочтение reduced-motion снимает переход, сохраняя правило показа по направлению. */
test("reduced motion disables the slide while retaining direction behavior", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await layoutApi(page);
  await gotoWithSession(page, "/feed");
  await expect(page.locator("main .ui-spinner")).toHaveCount(0);
  const header = page.locator(headerSelector);
  await expect
    .poll(() =>
      header.evaluate((node) => getComputedStyle(node).transitionDuration),
    )
    .toBe("0s");
  await scrollTo(page, 300);
  await expectHidden(page, true);
  await scrollTo(page, 280);
  await expectHidden(page, false);
});

test("clicking a header link does not pin it on the next screen", async ({
  page,
}) => {
  await layoutApi(page);
  await gotoWithSession(page, "/feed");
  await page
    .locator(headerSelector)
    .getByRole("link", { name: "На главную" })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expectHidden(page, false);
  await scrollTo(page, 300);
  await expectHidden(page, true);
});

/** Отдельно проверяем настоящий wheel, чтобы программные scrollTop-пробы не скрыли ошибку обработки пользовательского события. */
test("native wheel scrolling drives the header in both directions", async ({
  page,
}) => {
  await layoutApi(page);
  await gotoWithSession(page, "/feed");
  await expect(page.locator("main .ui-spinner")).toHaveCount(0);
  const box = (await page.locator(screenSelector).first().boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 150);
  await page.mouse.wheel(0, 300);
  await expectHidden(page, true);
  await page.mouse.wheel(0, -100);
  await expectHidden(page, false);
});

/** Touch-путь запускается только в Chromium с CDP и разделяет samples кадрами. */
test.describe("touch gestures", () => {
  test.use({
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
  });
  test("native touch swipes drive the header in both directions", async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(
      browserName !== "chromium",
      "Touch swipe injection uses the Chromium device protocol.",
    );
    await layoutApi(page);
    await gotoWithSession(page, "/feed");
    await expect(page.locator("main .ui-spinner")).toHaveCount(0);
    const client = await context.newCDPSession(page);
    /** Посылаем движение пальца в восемь шагов между animation-frame, затем завершаем жест. */
    const swipe = async (from: number, to: number) => {
      await client.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: 206, y: from }],
      });
      for (let step = 1; step <= 8; step++) {
        await client.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: 206, y: from + ((to - from) * step) / 8 }],
        });
        // Separate gesture samples across frames, as a finger moves on a screen.
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() => resolve()),
            ),
        );
      }
      await client.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    };
    await swipe(650, 350);
    await expectHidden(page, true);
    await swipe(350, 550);
    await expectHidden(page, false);
  });
});
