import { test, expect } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

const headerSelector = 'header[aria-label="Навигация профиля"]';
const tabsSelector = 'nav[aria-label="Разделы"]';
const scrollSelector = "main .ui-scroll:not(.ui-scroll-horizontal)";

test.setTimeout(60_000);

test.use({ viewport: { width: 390, height: 400 } });

test("home header follows scroll direction while content reaches the bottom", async ({
  page,
}) => {
  await layoutApi(page);
  await gotoWithSession(page, "/");
  const header = page.locator(headerSelector);
  const scroll = page.locator(scrollSelector).first();
  await expect(header).toBeVisible();
  await scroll.evaluate((element) => {
    element.scrollTop = 250;
  });
  await expect(header).toHaveAttribute("data-hidden", "true");
  await expect
    .poll(() =>
      header.evaluate((element) => element.getBoundingClientRect().bottom),
    )
    .toBeLessThanOrEqual(1);
  await scroll.evaluate((element) => {
    element.scrollTop = 200;
  });
  await expect(header).toHaveAttribute("data-hidden", "false");
  await expect
    .poll(() =>
      header.evaluate((element) =>
        Math.abs(element.getBoundingClientRect().top),
      ),
    )
    .toBeLessThan(1);
  await scroll.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(
    await scroll.evaluate((element) =>
      Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop),
    ),
  ).toBeLessThanOrEqual(1);
  const tabs = await page.locator(tabsSelector).boundingBox();
  expect(tabs?.height).toBe(76);
  expect((tabs?.y || 0) + (tabs?.height || 0)).toBe(400);
});

test("feed and guest club headers scroll with their banners; library and shop headers stay fixed", async ({
  page,
}) => {
  await layoutApi(page);
  for (const path of ["/feed", "/club", "/library", "/shop", "/profile"]) {
    // Assert the UI below instead of waiting for every remote media resource.
    await page.goto(path, { waitUntil: "domcontentloaded" });
    // Streamed HTML can retain hidden nodes while the visible screen resolves.
    const header = page.locator(`${headerSelector}:visible`);
    await expect(header).toHaveCount(1);
    await expect(header).toBeVisible();
    const scroll = page.locator(scrollSelector).first();
    await expect(scroll).toBeVisible();
    await scroll.evaluate((element) => {
      element.scrollTop = 180;
    });
    if (["/feed", "/club", "/profile"].includes(path)) {
      await expect
        .poll(() =>
          header.evaluate((element) => element.getBoundingClientRect().top),
        )
        .toBeLessThan(0);
    } else {
      await expect
        .poll(() =>
          header.evaluate((element) =>
            Math.abs(element.getBoundingClientRect().top),
          ),
        )
        .toBeLessThan(1);
    }
    await expect(page.locator(tabsSelector)).toBeVisible();
  }
});

test("subscriber club hides the main tabs and keeps a route to the profile", async ({
  page,
}) => {
  await layoutApi(page, true);
  await gotoWithSession(page, "/club");
  const header = page.locator(headerSelector);
  await expect(header).toBeVisible();
  await expect(page.locator(tabsSelector)).toHaveCount(0);
  await expect
    .poll(() =>
      page
        .locator("main")
        .evaluate((element) => element.getBoundingClientRect().height),
    )
    .toBe(400);
  await page
    .locator(scrollSelector)
    .first()
    .evaluate((element) => {
      element.scrollTop = 180;
    });
  expect(
    await header.evaluate((element) => element.getBoundingClientRect().top),
  ).toBe(0);
  await header.getByRole("link", { name: "Открыть профиль" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.locator(tabsSelector)).toBeVisible();
});
