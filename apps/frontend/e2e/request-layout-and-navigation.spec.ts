import { test, expect, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

const menu = 'nav[aria-label="Разделы"]';

/** Измеряем всю карточку ошибки внутри QueryRetryState, а не декоративную иконку; проверяем центрирование, overflow и hit-testing кнопки между шапкой и меню. */
async function centeredError(page: Page) {
  const alert = page.locator("main").getByRole("alert");
  await expect(alert).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const group = await alert.evaluate((node) => {
    // StatusNotice's first .ui-text is the decorative icon. Center the whole
    // notice inside QueryRetryState, not that icon and the right-aligned button.
    const card = node.getBoundingClientRect();
    const area = node.parentElement!.getBoundingClientRect();
    const button = node.querySelector("button")!;
    const control = button.getBoundingClientRect();
    return {
      centerY: card.top + card.height / 2,
      areaCenterY: area.top + area.height / 2,
      centerX: card.left + card.width / 2,
      areaCenterX: area.left + area.width / 2,
      overflow: node.scrollWidth > node.clientWidth + 1,
      actionable: button.contains(
        document.elementFromPoint(
          control.x + control.width / 2,
          control.y + control.height / 2,
        ),
      ),
    };
  });
  expect(Math.abs(group.centerY - group.areaCenterY)).toBeLessThanOrEqual(2);
  expect(Math.abs(group.centerX - group.areaCenterX)).toBeLessThanOrEqual(2);
  expect(group.overflow).toBe(false);
  expect(group.actionable).toBe(true);
  const card = (await alert.boundingBox())!;
  const header = (await page
    .getByRole("banner", { name: "Навигация профиля" })
    .boundingBox())!;
  const tabs = (await page.locator(menu).boundingBox())!;
  expect(card.y).toBeGreaterThanOrEqual(header.y + header.height);
  expect(card.y + card.height).toBeLessThanOrEqual(tabs.y);
}

/** Начальная API-ошибка в ленте и видео сохраняет геометрию шапки и доступный recovery; soft-check не мешает проверить действие повтора. */
for (const [width, height] of [
  [390, 844],
  [1440, 844],
  [320, 400],
]) {
  for (const path of ["/feed", "/videos"]) {
    test(`${path} keeps its header above a centered initial error at ${width}x${height}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await layoutApi(page);
      let fail = true;
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("**/api/trpc/**", async (route) => {
        if (!fail) return route.fallback();
        await held;
        return route.fulfill({
          status: 503,
          json: { error: "TEST_UNAVAILABLE" },
        });
      });
      try {
        await gotoWithSession(page, path);
        const header = page.locator(
          'header[aria-label="Навигация профиля"]:visible',
        );
        await expect(header).toBeVisible();
        const headerTop = (await header.boundingBox())!.y;
        release();
        const alert = page.locator("main").getByRole("alert");
        await centeredError(page);
        expect((await header.boundingBox())!.y).toBe(headerTop);
        expect((await alert.boundingBox())!.y).toBeGreaterThan(
          (await header.boundingBox())!.y,
        );
        const main = (await page.locator("main").boundingBox())!;
        const area = (await alert.locator("..").boundingBox())!;
        if (Math.abs(area.y + area.height - main.y - main.height) >= 0.5) {
          await test.info().attach("request-state-bounds", {
            contentType: "application/json",
            body: JSON.stringify({
              main,
              area,
              card: await alert.boundingBox(),
            }),
          });
          await page.screenshot({
            path: test.info().outputPath("request-state-bounds.png"),
          });
        }
        // Keep the geometry failure while still checking the real recovery action.
        expect.soft(area.y + area.height).toBeCloseTo(main.y + main.height, 0);
        await expect(
          alert.getByRole("button", { name: "Повторить" }),
        ).toBeInViewport();
        fail = false;
        await alert.getByRole("button", { name: "Повторить" }).click();
        await expect(alert).toHaveCount(0);
        expect((await header.boundingBox())!.y).toBe(headerTop);
        if (path === "/feed")
          await expect(
            page.getByText(/Проверка длинной публикации/).first(),
          ).toBeVisible();
      } finally {
        release();
      }
    });
  }
}

/** Ошибка проверки сессии профиля/клуба занимает доступную область контента и оставляет навигацию. */
for (const path of ["/profile", "/club"]) {
  test(`session failure remains centered in the available ${path} content area`, async ({
    page,
  }) => {
    await layoutApi(page);
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({ status: 503, json: {} }),
    );
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await centeredError(page);
    const viewport = await page
      .locator("main")
      .getByRole("alert")
      .evaluate((node) => {
        const box = node.closest(".ui-scroll")!.getBoundingClientRect();
        return { y: box.y, bottom: box.bottom };
      });
    const main = (await page.locator("main").boundingBox())!;
    const header = (await page
      .getByRole("banner", { name: "Навигация профиля" })
      .boundingBox())!;
    expect(viewport.y).toBe(header.y + header.height);
    expect(viewport.bottom).toBe(main.y + main.height);
  });
}

/** Разделяем задержку RSC-перехода и destination-query: меню даёт немедленный feedback, отменяемая смена раздела не двигает его и не ждёт API. */
test("a delayed tab transition gives feedback without shifting the menu or waiting for API data", async ({
  page,
}) => {
  await layoutApi(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let releaseApi!: () => void;
  const heldApi = new Promise<void>((resolve) => {
    releaseApi = resolve;
  });
  await page.route(/\/videos\?_rsc=/, async (route) => {
    await held;
    await route.continue().catch(() => {});
  });
  // The destination query remains pending after its route is released.
  await page.route("**/api/trpc/videos.list**", async (route) => {
    await heldApi;
    await route.abort().catch(() => {});
  });
  try {
    await gotoWithSession(page, "/feed");
    await page.evaluate(() => document.fonts.ready);
    const nav = (await page.locator(menu).elementHandle())!;
    const before = await page.locator(menu).boundingBox();
    const target = page.locator(`${menu} a[href="/videos"]`);
    await target.click();
    await expect(target.locator('[aria-busy="true"]')).toHaveCount(1);
    await expect(target.getByRole("status")).toHaveText(
      "Открывается раздел «Видео»",
    );
    await expect(page.locator(`${menu} a[href="/feed"]`)).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(await page.locator(menu).boundingBox()).toEqual(before);
    await page.locator(`${menu} a[href="/shop"]`).click();
    await expect(page).toHaveURL(/\/shop$/);
    await expect(target.locator('[aria-busy="true"]')).toHaveCount(0);
    release();
    await target.click();
    await expect(page).toHaveURL(/\/videos$/);
    await expect(target).toHaveAttribute("aria-current", "page");
    await expect(
      page.locator('[data-content-placeholder="video"]'),
    ).toBeVisible();
    await expect(target.locator('[aria-busy="true"]')).toHaveCount(0);
    expect(await page.locator(menu).boundingBox()).toEqual(before);
    expect(await nav.evaluate((node) => node.isConnected)).toBe(true);
  } finally {
    release();
    releaseApi();
  }
});
