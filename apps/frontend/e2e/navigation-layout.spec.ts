import { test, expect, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

const headerSelector = 'header[aria-label="Навигация профиля"]:visible';
const tabsSelector = 'nav[aria-label="Разделы"]';
const scrollSelector = "main .ui-scroll:not(.ui-scroll-horizontal):visible";

test.setTimeout(90_000);
test.use({ viewport: { width: 390, height: 400 } });

async function checkChrome(page: Page) {
  const header = page.locator(headerSelector);
  const tabs = page.locator(tabsSelector);
  await expect(header).toHaveCount(1);
  await expect(tabs).toHaveCount(1);
  await expect(
    header.getByRole("link", { name: "На главную" }),
  ).toBeInViewport();
  await expect(
    header.getByRole("link", { name: "Открыть профиль" }),
  ).toBeInViewport();
  const top = (await header.boundingBox())!;
  const bottom = (await tabs.boundingBox())!;
  const main = (await page.locator("main").boundingBox())!;
  const path = new URL(page.url()).pathname;
  expect(top.y).toBe(0);
  expect(top.height).toBe(path === "/shop" ? 46 : 44);
  expect(bottom.height).toBe(76);
  expect(bottom.y + bottom.height).toBe(400);
  expect(main.y).toBe(0);
  expect(main.y + main.height).toBe(bottom.y);
  expect(
    await header.evaluate((node) => getComputedStyle(node).backgroundColor),
  ).toBe("rgba(0, 0, 0, 0)");
  return { top, bottom };
}

for (const subscribed of [false, true]) {
  test(`main screens preserve fixed headers and hide overlay headers while keeping bottom navigation (${subscribed ? "member" : "guest"})`, async ({
    page,
  }) => {
    await layoutApi(page, subscribed);
    for (const path of [
      "/",
      "/feed",
      "/videos",
      "/club",
      "/interactive",
      "/library",
      "/shop",
      "/profile",
    ]) {
      await gotoWithSession(page, path);
      const before = await checkChrome(page);
      expect(
        (await page
          .locator(headerSelector)
          .getByRole("link", { name: "На главную" })
          .boundingBox())!.x,
      ).toBe(14);
      const scroll = page.locator(scrollSelector).first();
      await expect(scroll).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("main .ui-spinner")).toHaveCount(0);
      expect(
        await scroll.evaluate((node) => {
          // Measure in the same frame: lazy covers can resize masonry later.
          node.scrollTop = node.scrollHeight;
          return Math.abs(
            node.scrollHeight - node.clientHeight - node.scrollTop,
          );
        }),
      ).toBeLessThanOrEqual(1);
      const position = await scroll.evaluate((node) => node.scrollTop);
      const fixedHeader = ["/videos", "/profile"].includes(path);
      if (fixedHeader) {
        await expect(page.locator(headerSelector)).toHaveAttribute(
          "data-hidden",
          "false",
        );
        expect(await page.locator(headerSelector).boundingBox()).toEqual(
          before.top,
        );
      } else if (position > 20) {
        await expect(page.locator(headerSelector)).toHaveAttribute(
          "data-hidden",
          "true",
        );
        await expect
          .poll(async () => {
            const box = (await page.locator(headerSelector).boundingBox())!;
            return box.y + box.height;
          })
          .toBeLessThanOrEqual(0);
      }
      await scroll.evaluate((node) => {
        node.scrollTop = 0;
      });
      await expect(page.locator(headerSelector)).toHaveAttribute(
        "data-hidden",
        "false",
      );
      await expect
        .poll(() => page.locator(headerSelector).boundingBox())
        .toEqual(before.top);
      expect(await page.locator(tabsSelector).boundingBox()).toEqual(
        before.bottom,
      );
      if (path === "/club")
        await expect(
          page.getByRole("button", { name: "Включить музыку" }),
        ).toBeVisible();
    }
  });
}

for (const [width, height] of [
  [390, 844],
  [1440, 844],
  [320, 400],
]) {
  test(`feed navigation overlays its original banner without adding a row at ${width}x${height}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await layoutApi(page);
    await gotoWithSession(page, "/feed");
    const header = page.locator(headerSelector);
    const banner = page.locator('main [class*="bannerContainer"] img').first();
    await expect(banner).toBeVisible();
    const image = (await banner.boundingBox())!;
    const top = (await header.boundingBox())!;
    expect(image.y).toBe(top.y);
    expect(image.height).toBeCloseTo(image.width / 5.595628415300546, 0);
    expect(await header.evaluate((node) => getComputedStyle(node).color)).toBe(
      "rgb(255, 255, 255)",
    );
    // Empty space in the overlay must pass pointer input to the page.
    expect(
      await header.evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return node.contains(
          document.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
          ),
        );
      }),
    ).toBe(false);
    for (const name of ["На главную", "Открыть профиль"]) {
      const link = header.getByRole("link", { name });
      expect(
        await link.evaluate((node) => {
          const rect = node.getBoundingClientRect();
          return node.contains(
            document.elementFromPoint(
              rect.x + rect.width / 2,
              rect.y + rect.height / 2,
            ),
          );
        }),
      ).toBe(true);
    }
  });
}

test("details, login, quiz, documents and missing pages all have an exit even when the API fails", async ({
  page,
}) => {
  await layoutApi(page);
  await page.route("**/api/trpc/**", (route) =>
    route.fulfill({ status: 503, json: {} }),
  );
  for (const path of [
    "/post/1",
    "/video/1",
    "/shop/1",
    "/library/about-me",
    "/library/aesthetics-guide",
    "/library/patterns",
    "/library/article/1",
    "/login",
    "/quiz",
    "/admin",
    "/legal",
    "/legal/offer",
    "/privacy",
    "/missing-page",
  ]) {
    await gotoWithSession(page, path);
    await checkChrome(page);
    await expect(
      page
        .locator(headerSelector)
        .getByRole("button", { name: "Вернуться назад" }),
    ).toBeInViewport();
  }
  await page
    .locator(headerSelector)
    .getByRole("link", { name: "На главную" })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await checkChrome(page);
});

for (const [path, parent] of [
  ["/post/invalid", "/feed"],
  ["/video/invalid", "/videos"],
  ["/shop/invalid", "/shop"],
  ["/library/article/invalid", "/library"],
  ["/quiz", "/interactive"],
  ["/legal/offer", "/legal"],
  ["/profile", "/"],
]) {
  test(`direct entry ${path} returns to ${parent} instead of leaving the app`, async ({
    page,
  }) => {
    await layoutApi(page);
    await gotoWithSession(page, path);
    await page
      .locator(headerSelector)
      .getByRole("button", { name: "Вернуться назад" })
      .click();
    await expect(page).toHaveURL(new RegExp(`${parent}/?$`));
    await checkChrome(page);
  });
}

test("back preserves actual app history across reload and forward, with a fallback at the initial entry", async ({
  page,
}) => {
  await layoutApi(page);
  await gotoWithSession(page, "/library");
  await page.locator(tabsSelector).getByRole("link", { name: "Лента" }).click();
  await expect(page).toHaveURL(/\/feed$/);
  await page.locator(tabsSelector).getByRole("link", { name: "Видео" }).click();
  await expect(page).toHaveURL(/\/videos$/);
  await gotoWithSession(page, "/videos"); // Reload the current entry, preserving its history state.
  // Restored scroll positions can hide the auto-hiding header. Reveal it with
  // the same scroll gesture a user needs before pressing its Back button.
  const back = async () => {
    const button = page
      .locator(headerSelector)
      .getByRole("button", { name: "Вернуться назад" });
    // Wheel dispatch does not wait for the compositor's scroll. Observe both
    // positions before clicking; native wheel behavior has its own header suite.
    const scroll = page.locator(scrollSelector).first();
    const position = await scroll.evaluate((node) => {
      node.scrollTop = node.scrollHeight;
      return node.scrollTop;
    });
    if (position > 20)
      await expect(page.locator(headerSelector)).toHaveAttribute(
        "data-hidden",
        "true",
      );
    await scroll.evaluate((node) => {
      node.scrollTop = 0;
    });
    await expect(page.locator(headerSelector)).toHaveAttribute(
      "data-hidden",
      "false",
    );
    await expect(button).toBeInViewport({ ratio: 1 });
    await button.click();
  };
  await back();
  await expect(page).toHaveURL(/\/feed$/);
  await page.goForward({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/videos$/);
  await back();
  await expect(page).toHaveURL(/\/feed$/);
  await back();
  await expect(page).toHaveURL(/\/library$/);
  await back();
  await expect(page).toHaveURL(/\/$/);
});

test("session loading and failure keep home, back and the sections available", async ({
  page,
}) => {
  await layoutApi(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/auth/me", async (route) => {
    await held;
    await route.fulfill({ status: 503, json: {} });
  });
  try {
    await page.goto("/profile", { waitUntil: "domcontentloaded" });
    await checkChrome(page);
    release();
    await expect(page.locator("main").getByRole("alert")).toBeVisible();
    await checkChrome(page);
    await page
      .locator(headerSelector)
      .getByRole("link", { name: "На главную" })
      .click();
    await expect(page).toHaveURL(/\/$/);
  } finally {
    release();
  }
});

test("an external previous page is not used as the app's back destination", async ({
  page,
}) => {
  await layoutApi(page);
  await page.route("http://outside.example.test/landing", (route) =>
    route.fulfill({ contentType: "text/html", body: "<h1>External page</h1>" }),
  );
  await page.goto("http://outside.example.test/landing");
  await gotoWithSession(page, "/post/invalid");
  await page
    .locator(headerSelector)
    .getByRole("button", { name: "Вернуться назад" })
    .click();
  await expect(page).toHaveURL(/\/feed$/);
});

test("the login screen's header back has a safe direct-entry fallback", async ({
  page,
}) => {
  await layoutApi(page);
  await gotoWithSession(page, "/login");
  await page
    .getByRole("button", { name: "Вернуться назад", exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/);
});

test("the same navigation remains mounted between sections and details, with the correct active section", async ({
  page,
}) => {
  await layoutApi(page);
  await gotoWithSession(page, "/post/invalid");
  const header = (await page.locator(headerSelector).elementHandle())!;
  const tabs = (await page.locator(tabsSelector).elementHandle())!;
  await expect(
    page.locator(tabsSelector).getByRole("link", { name: "Лента" }),
  ).toHaveAttribute("aria-current", "page");
  await page.locator(tabsSelector).getByRole("link", { name: "Видео" }).click();
  await expect(page).toHaveURL(/\/videos$/);
  expect(await header.evaluate((node) => node.isConnected)).toBe(true);
  expect(await tabs.evaluate((node) => node.isConnected)).toBe(true);
  await page
    .locator(headerSelector)
    .getByRole("button", { name: "Вернуться назад" })
    .click();
  await expect(page).toHaveURL(/\/post\/invalid$/);
  expect(await header.evaluate((node) => node.isConnected)).toBe(true);
  expect(await tabs.evaluate((node) => node.isConnected)).toBe(true);
  // The same header action also handles the direct-entry fallback.
  await page
    .getByRole("button", { name: "Вернуться назад", exact: true })
    .click();
  await expect(page).toHaveURL(/\/feed$/);
});
