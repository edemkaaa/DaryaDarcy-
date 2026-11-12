import { expect, test, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";
import { ok } from "./editor-fixtures";

const scroll = (page: Page) =>
  page.locator("main .ui-scroll:not(.ui-scroll-horizontal):visible").first();
const menu = (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: "Разделы", exact: true })
    .getByRole("link", { name, exact: true });
const home = (page: Page) =>
  page
    .locator('header[aria-label="Навигация профиля"]')
    .getByRole("link", { name: "На главную", exact: true });

async function moveDown(page: Page) {
  await scroll(page).evaluate((node) => {
    node.scrollTop = 600;
  });
  await expect
    .poll(() => scroll(page).evaluate((node) => node.scrollTop))
    .toBeGreaterThan(300);
}

async function revealHeader(page: Page) {
  await scroll(page).evaluate((node) => {
    node.scrollTop -= 80;
  });
  await expect(home(page)).toBeInViewport();
}

async function capture(page: Page, name: string) {
  if (!process.env.SECTION_SCROLL_SCREENSHOTS) return;
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() =>
      page.locator("img:visible").evaluateAll((images) =>
        images
          .filter((img) => {
            const rect = img.getBoundingClientRect();
            const bounds = img.closest("main")?.getBoundingClientRect();
            return (
              rect.bottom > (bounds?.top ?? 0) &&
              rect.top < (bounds?.bottom ?? innerHeight) &&
              rect.right > (bounds?.left ?? 0) &&
              rect.left < (bounds?.right ?? innerWidth)
            );
          })
          .every((img) => (img as HTMLImageElement).complete),
      ),
    )
    .toBe(true);
  await page
    .locator("img:visible")
    .evaluateAll((images) =>
      Promise.all(
        images
          .filter((img) => (img as HTMLImageElement).complete)
          .map((img) =>
            (img as HTMLImageElement).decode().catch(() => undefined),
          ),
      ),
    );
  await page.screenshot({
    path: `${process.env.SECTION_SCROLL_SCREENSHOTS}/${name}.png`,
    animations: "disabled",
  });
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 320, height: 400 },
]) {
  test(`home icon opens the retained home at the top (${viewport.width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await layoutApi(page);
    await gotoWithSession(page, "/");
    await moveDown(page);
    await menu(page, "Магазин").click();
    await expect(page).toHaveURL("/shop");
    await home(page).click();
    await expect(page).toHaveURL("/");
    await capture(page, `home-return-${viewport.width}`);
    await expect
      .poll(() => scroll(page).evaluate((node) => node.scrollTop))
      .toBe(0);
  });

  test(`menu opens the retained shop at the top (${viewport.width}px)`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await layoutApi(page);
    await gotoWithSession(page, "/shop");
    await moveDown(page);
    await menu(page, "Библиотека").click();
    await expect(page).toHaveURL("/library");
    await menu(page, "Магазин").click();
    await expect(page).toHaveURL("/shop");
    await capture(page, `shop-return-${viewport.width}`);
    await expect
      .poll(() => scroll(page).evaluate((node) => node.scrollTop))
      .toBe(0);
  });
}

for (const path of ["/", "/shop"]) {
  test(`reselecting ${path} resets only its vertical scroll`, async ({
    page,
  }) => {
    await layoutApi(page);
    await gotoWithSession(page, path);
    await moveDown(page);
    if (path === "/") {
      await revealHeader(page);
      await home(page).click();
    } else await menu(page, "Магазин").click();
    await expect
      .poll(() => scroll(page).evaluate((node) => node.scrollTop))
      .toBe(0);
  });
}

test("browser back keeps the former section position", async ({ page }) => {
  await layoutApi(page);
  await gotoWithSession(page, "/");
  await moveDown(page);
  const position = await scroll(page).evaluate((node) => node.scrollTop);
  await menu(page, "Магазин").click();
  await expect(page).toHaveURL("/shop");
  await page.goBack();
  await expect(page).toHaveURL("/");
  await expect
    .poll(() => scroll(page).evaluate((node) => node.scrollTop))
    .toBe(position);
});

test("returning from a product keeps the shop position", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 400 });
  await layoutApi(page);
  await gotoWithSession(page, "/shop");
  const product = page.getByRole("button", {
    name: "Открыть товар: Пособие по атмосферной фотографии",
    exact: true,
  });
  await product.scrollIntoViewIfNeeded();
  const position = await scroll(page).evaluate((node) => node.scrollTop);
  expect(position).toBeGreaterThan(100);
  await product.click();
  await expect(page).toHaveURL(/\/shop\/[^/]+$/);
  await page
    .getByRole("button", { name: "Вернуться назад", exact: true })
    .click();
  await expect(page).toHaveURL("/shop");
  await expect
    .poll(() => scroll(page).evaluate((node) => node.scrollTop))
    .toBe(position);
});

test("opening a section in a new tab does not reset the current section", async ({
  page,
  context,
}) => {
  await layoutApi(page);
  await gotoWithSession(page, "/shop");
  await moveDown(page);
  const position = await scroll(page).evaluate((node) => node.scrollTop);
  const popup = context.waitForEvent("page");
  await menu(page, "Магазин").click({ modifiers: ["Control"] });
  const opened = await popup;
  await opened.close();
  await expect(page).toHaveURL("/shop");
  expect(await scroll(page).evaluate((node) => node.scrollTop)).toBe(position);
});

for (const back of ["header", "browser"]) {
  test(`returning from a post with ${back} back keeps position and search`, async ({
    page,
  }) => {
    let searchReady = false;
    await layoutApi(page, false, (name, input) => {
      if (name === "feed.listPaginated" && input.search === "проверка")
        searchReady = true;
      return name === "feed.getById"
        ? ok({
            id: input.id,
            text: "Публикация для проверки возврата",
            photos: [],
            media: [],
            tags: [],
            richText: null,
            target: "feed",
            likeCount: 0,
            commentCount: 0,
            createdAt: "2026-11-12T12:00:00Z",
            publishedAt: "2026-11-12T12:00:00Z",
          })
        : undefined;
    });
    await gotoWithSession(page, "/feed");
    await page.getByPlaceholder("Поиск...", { exact: true }).fill("Проверка");
    await expect.poll(() => searchReady).toBe(true);
    const card = page
      .locator(
        '[data-tab-screen="/feed"] article[aria-label="Открыть публикацию"]',
      )
      .nth(6);
    await expect(card).toBeVisible();
    await card.scrollIntoViewIfNeeded();
    await card.evaluate((node) => {
      node.addEventListener(
        "click",
        () => {
          Object.assign(window, {
            postDepartureScroll: node.closest(".ui-scroll")!.scrollTop,
          });
        },
        { capture: true, once: true },
      );
    });
    await card.click();
    await expect(page).toHaveURL(/\/post\/\d+$/);
    const position = await page.evaluate(
      () =>
        (window as unknown as { postDepartureScroll: number })
          .postDepartureScroll,
    );
    expect(position).toBeGreaterThan(100);
    if (back === "browser") await page.goBack();
    else
      await page
        .getByRole("button", { name: "Вернуться назад", exact: true })
        .click();
    await expect(page).toHaveURL("/feed");
    await expect
      .poll(() => scroll(page).evaluate((node) => node.scrollTop))
      .toBe(position);
    await expect(
      page.getByPlaceholder("Поиск...", { exact: true }),
    ).toHaveValue("Проверка");
  });
}
