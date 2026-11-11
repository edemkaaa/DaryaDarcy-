import { test, expect, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

const menu = 'nav[aria-label="Разделы"]';
const routes = [
  "/feed",
  "/videos",
  "/club",
  "/interactive",
  "/library",
  "/shop",
];

/** Снимаем координаты меню, SVG-иконок и подписей отдельно, чтобы поздний шрифт не маскировался неизменной общей высотой. */
async function menuGeometry(page: Page) {
  return page.locator(menu).evaluate((nav) => {
    /** Преобразуем DOMRect в сравнимые сериализуемые размеры и координаты. */
    const rect = (element: Element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };
    return {
      nav: rect(nav),
      tabs: Array.from(nav.querySelectorAll("a")).map((tab) => ({
        tab: rect(tab),
        icon: rect(tab.querySelector("svg")!),
        label: rect(tab.querySelector("span")!),
      })),
    };
  });
}

/** Задерживаем шрифты и проходим все основные разделы: меняется active-route, но сохраняются геометрия меню, DOM-узел и document-origin. */
for (const width of [320, 390, 480]) {
  test(`menu geometry stays fixed with delayed fonts and navigation at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await layoutApi(page);
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let fontRequests = 0;
    await page.route("**/assets/fonts/*.ttf", async (route) => {
      fontRequests++;
      await held;
      await route.continue().catch(() => {});
    });
    try {
      await gotoWithSession(page, "/feed");
      await expect(page.locator(`${menu} svg`)).toHaveCount(6);
      await expect.poll(() => fontRequests).toBeGreaterThan(0);
      const nav = (await page.locator(menu).elementHandle())!;
      const before = await menuGeometry(page);
      expect(before.nav.height).toBe(76);
      for (const tab of before.tabs) {
        expect(tab.icon.width).toBe(22);
        expect(tab.icon.height).toBe(22);
        expect(tab.label.height).toBe(width < 360 ? 10 : 13);
        // Coordinates measured from the original Expo menu at these widths.
        expect(tab.icon.y - before.nav.y).toBe(15);
        expect(tab.label.y - before.nav.y).toBe(39);
        expect(tab.label.y - tab.icon.y - tab.icon.height).toBe(2);
      }
      release();
      await page.evaluate(() => document.fonts.ready);
      expect(await menuGeometry(page)).toEqual(before);
      const origin = await page.evaluate(() => performance.timeOrigin);
      for (const path of [...routes.slice(1), "/feed"]) {
        await page.locator(`${menu} a[href="${path}"]`).click();
        await expect(page).toHaveURL(new RegExp(`${path}$`));
        await expect(page.locator(`${menu} a[href="${path}"]`)).toHaveAttribute(
          "aria-current",
          "page",
        );
        await page.evaluate(() => document.fonts.ready);
        expect(await menuGeometry(page)).toEqual(before);
        expect(await nav.evaluate((element) => element.isConnected)).toBe(true);
        expect(await page.evaluate(() => performance.timeOrigin)).toBe(origin);
      }
      if (width === 390) {
        await page.screenshot({
          path: test.info().outputPath("stable-menu.png"),
        });
      }
    } finally {
      release();
    }
  });
}

/** Эмулируем visibilityState и соответствующие события focus/blur без настоящего переключения приложения ОС. */
async function changeWindowFocus(page: Page, visible: boolean) {
  await page.evaluate((visible) => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: visible ? "visible" : "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event(visible ? "focus" : "blur"));
  }, visible);
}

/** Возврат проверяет доступ, сохраняя свежие закладки, экземпляр scroll-контейнера и позицию. */
test("profile focus checks access without reloading saved posts", async ({
  page,
}) => {
  await layoutApi(page, true);
  let savedCalls = 0;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.includes("feed.savedPosts"))
      savedCalls++;
  });
  await gotoWithSession(page, "/profile");
  await expect(
    page.getByText("member@example.test", { exact: true }),
  ).toBeVisible();
  await expect.poll(() => savedCalls).toBeGreaterThan(0);
  await page.waitForTimeout(200);
  const before = savedCalls;
  const screen = (await page
    .locator("main .ui-scroll")
    .first()
    .elementHandle())!;
  const scrollTop = await screen.evaluate((element) => {
    element.scrollTop = 200;
    return element.scrollTop;
  });
  await changeWindowFocus(page, false);
  const checked = page.waitForResponse((response) =>
    response.url().endsWith("/api/auth/me"),
  );
  await changeWindowFocus(page, true);
  await checked;
  await page.waitForTimeout(200);
  expect(savedCalls).toBe(before);
  expect(await screen.evaluate((element) => element.isConnected)).toBe(true);
  expect(await screen.evaluate((element) => element.scrollTop)).toBe(scrollTop);
});

/** Даже постоянный сбой проверки сессии не должен перезапускать публичный контент; удержанный повтор позволяет проверить состояние во время запроса. */
test("public pages retain their content and cache when every session check fails", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await layoutApi(page);
  let sessionCalls = 0;
  let holdSession: Promise<void> | undefined;
  await page.route("**/api/auth/me", async (route) => {
    sessionCalls++;
    await holdSession;
    await route.fulfill({ status: 503, json: { error: "TEST_UNAVAILABLE" } });
  });
  const contentCalls: string[] = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith("/api/") && path !== "/api/auth/me")
      contentCalls.push(path);
  });
  for (const path of ["/", ...routes.filter((route) => route !== "/club")]) {
    const settled = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/auth/me") && response.status() === 503,
    );
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await settled;
    await expect(page.locator("main .ui-spinner")).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    // Allow the tRPC batching timer to dispatch all initial screen queries.
    await page.waitForTimeout(200);
    const screen = (await page
      .locator("main .ui-scroll:not(.ui-scroll-horizontal)")
      .first()
      .elementHandle())!;
    const scrollTop = await screen.evaluate((element) => {
      element.scrollTop = 200;
      return element.scrollTop;
    });
    const origin = await page.evaluate(() => performance.timeOrigin);
    const beforeContent = [...contentCalls];
    const beforeSession = sessionCalls;
    let release!: () => void;
    holdSession = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      await changeWindowFocus(page, false);
      await page.waitForTimeout(100);
      expect(sessionCalls).toBe(beforeSession);
      expect(contentCalls).toEqual(beforeContent);
      await changeWindowFocus(page, true);
      await expect.poll(() => sessionCalls).toBe(beforeSession + 1);
      expect(await screen.evaluate((element) => element.isConnected)).toBe(
        true,
      );
      expect(await screen.evaluate((element) => element.scrollTop)).toBe(
        scrollTop,
      );
      const rechecked = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/auth/me") && response.status() === 503,
      );
      release();
      await rechecked;
      await page.waitForTimeout(200);
      expect(contentCalls).toEqual(beforeContent);
      expect(await screen.evaluate((element) => element.isConnected)).toBe(
        true,
      );
      expect(await screen.evaluate((element) => element.scrollTop)).toBe(
        scrollTop,
      );
      expect(await page.evaluate(() => performance.timeOrigin)).toBe(origin);
    } finally {
      release();
      holdSession = undefined;
    }
  }
});

/** Повторная проверка приватной сессии сохраняет прежний error-screen вместо краткого spinner-remount. */
test("a failed private session keeps its error screen during a focus recheck", async ({
  page,
}) => {
  await layoutApi(page);
  let release!: () => void;
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ status: 503, json: { error: "TEST_UNAVAILABLE" } }),
  );
  await page.goto("/profile", { waitUntil: "domcontentloaded" });
  const alert = page.locator("main").getByRole("alert");
  await expect(alert).toBeVisible();
  const screen = (await alert.elementHandle())!;
  const holdSession = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/auth/me", async (route) => {
    await holdSession;
    await route.fulfill({ status: 503, json: { error: "TEST_UNAVAILABLE" } });
  });
  const checking = page.waitForRequest((request) =>
    request.url().endsWith("/api/auth/me"),
  );
  try {
    await changeWindowFocus(page, false);
    await changeWindowFocus(page, true);
    await checking;
    await expect(alert).toBeVisible();
    await expect(page.locator("main .ui-spinner")).toHaveCount(0);
    expect(await screen.evaluate((element) => element.isConnected)).toBe(true);
    const settled = page.waitForResponse((response) =>
      response.url().endsWith("/api/auth/me"),
    );
    release();
    await settled;
    await expect(alert).toBeVisible();
    expect(await screen.evaluate((element) => element.isConnected)).toBe(true);
  } finally {
    release();
  }
});
