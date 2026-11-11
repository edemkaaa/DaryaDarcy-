import { expect, test, type Locator, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

/** Находим активный промобаннер по доступному имени, не привязываясь к его декоративной разметке. */
function banner(page: Page) {
  return page.getByRole("button", { name: /^Перейти: / });
}

/** Открываем главную с синтетическими API и дожидаемся начального слайда перед жестами. */
async function openHome(page: Page) {
  await layoutApi(page);
  await gotoWithSession(page, "/");
  await banner(page).scrollIntoViewIfNeeded();
  await expect(banner(page)).toHaveAccessibleName("Перейти: Клуб Darcy");
}

/** Совершаем реальное перетаскивание мышью внутри баннера; направление и расстояние задаются относительно его ширины. */
async function drag(page: Page, direction = -1, distance = 0.5) {
  const box = (await banner(page).boundingBox())!;
  const x = box.x + box.width * (direction < 0 ? 0.8 : 0.2);
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + direction * box.width * distance, y, { steps: 12 });
  await page.mouse.up();
}

/** Посылаем последовательность native touch через CDP, включая отмену и вертикальный жест для проверки разграничения прокрутки. */
async function touchSwipe(
  page: Page,
  target: Locator,
  dx: number,
  dy = 0,
  cancel = false,
) {
  await target.scrollIntoViewIfNeeded();
  const box = (await target.boundingBox())!;
  const x = box.x + box.width * (dx < 0 ? 0.85 : 0.15);
  const y = box.y + box.height / 2;
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  for (let step = 1; step <= 12; step++) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + (dx * step) / 12, y: y + (dy * step) / 12 }],
    });
  }
  await session.send("Input.dispatchTouchEvent", {
    type: cancel ? "touchCancel" : "touchEnd",
    touchPoints: [],
  });
  await session.detach();
}

/** Мышь проверяет циклическое листание, click после жеста, потерю фокуса и перенос срока автоматической смены после ручного действия. */
test.describe("homepage promo mouse dragging", () => {
  test.use({ viewport: { width: 1440, height: 1000 }, hasTouch: false });

  test("swipes both ways, wraps, and preserves normal clicks without extra controls", async ({
    page,
  }, info) => {
    await openHome(page);
    await drag(page);
    await expect(banner(page)).toHaveAccessibleName(
      "Перейти: Тест на эстетику",
    );
    await expect(page).toHaveURL("/");
    await drag(page, 1);
    await expect(banner(page)).toHaveAccessibleName("Перейти: Клуб Darcy");
    await drag(page, 1);
    await expect(banner(page)).toHaveAccessibleName("Перейти: Лента");
    const block = banner(page).locator("..");
    await expect(block.getByRole("button")).toHaveCount(1);
    await expect(block.locator("img").last()).toBeVisible();
    await block.screenshot({ path: info.outputPath("home-promo-desktop.png") });
    await banner(page).click();
    await expect(page).toHaveURL("/feed");
  });

  test("short drags and losing focus do not navigate; releasing outside still swipes", async ({
    page,
  }) => {
    await openHome(page);
    await drag(page, -1, 0.02);
    await expect(banner(page)).toHaveAccessibleName("Перейти: Клуб Darcy");
    await expect(page).toHaveURL("/");
    const box = (await banner(page).boundingBox())!;
    await page.mouse.move(box.x + 300, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 50, box.y + 100, { steps: 10 });
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await page.mouse.up();
    await expect(banner(page)).toHaveAccessibleName("Перейти: Клуб Darcy");
    await page.mouse.move(box.x + 300, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x - 10, box.y + 100, { steps: 12 });
    await page.mouse.up();
    await expect(banner(page)).toHaveAccessibleName(
      "Перейти: Тест на эстетику",
    );
    await expect(page).toHaveURL("/");
  });

  test("manual interaction cancels a pending automatic transition and restarts its interval", async ({
    page,
  }) => {
    await page.clock.install();
    await openHome(page);
    await page.clock.runFor(6100);
    await drag(page);
    await expect(banner(page)).toHaveAccessibleName(
      "Перейти: Тест на эстетику",
    );
    await page.clock.runFor(5900);
    await expect(banner(page)).toHaveAccessibleName(
      "Перейти: Тест на эстетику",
    );
    await page.clock.runFor(1400);
    await expect(banner(page)).toHaveAccessibleName("Перейти: Лента");
  });
});

/** Касание проверяет смену слайдов и обычный tap отдельно от вертикального scroll и отменённого жеста. */
test.describe("homepage promo touch swiping", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });

  test("native finger swipes change slides in both directions and a fresh tap follows the link", async ({
    page,
  }, info) => {
    await openHome(page);
    await banner(page)
      .locator("..")
      .screenshot({ path: info.outputPath("home-promo-mobile.png") });
    await touchSwipe(page, banner(page), -230);
    await expect(banner(page)).toHaveAccessibleName(
      "Перейти: Тест на эстетику",
    );
    await expect(page).toHaveURL("/");
    await touchSwipe(page, banner(page), 230);
    await expect(banner(page)).toHaveAccessibleName("Перейти: Клуб Darcy");
    // Chromium suppresses compatibility clicks briefly after synthetic flings.
    // Test an independent tap once that native gesture has settled.
    await page.waitForTimeout(1200);
    await banner(page).tap();
    await expect(page).toHaveURL("/club");
  });

  test("vertical finger scrolling and cancelled swipes keep the selected slide", async ({
    page,
  }) => {
    await openHome(page);
    await touchSwipe(page, banner(page), -180, 0, true);
    await expect(banner(page)).toHaveAccessibleName("Перейти: Клуб Darcy");
    const before = (await banner(page).boundingBox())!.y;
    await touchSwipe(page, banner(page), 4, -120);
    await expect
      .poll(async () => (await banner(page).boundingBox())!.y)
      .toBeLessThan(before - 30);
    await expect(banner(page)).toHaveAccessibleName("Перейти: Клуб Darcy");
    await expect(page).toHaveURL("/");
    await touchSwipe(page, banner(page), -230);
    await expect(banner(page)).toHaveAccessibleName(
      "Перейти: Тест на эстетику",
    );
  });
});
