import { expect, test } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

for (const width of [390, 1440]) {
  test(`visited routes reuse their client payload on tab and detail returns (${width}px)`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await layoutApi(page);
    const routes: string[] = [];
    let documents = 0;
    page.on("request", (request) => {
      if (request.isNavigationRequest()) documents++;
      if (request.headers()["rsc"] === "1")
        routes.push(new URL(request.url()).pathname);
    });
    await gotoWithSession(page, "/library");
    const search = page.getByPlaceholder("Поиск материалов...");
    await search.fill("Сборник");
    await page.locator('nav a[href="/shop"]').click();
    await expect(page.getByText("МАГАЗИН", { exact: true })).toBeVisible();
    await page.locator('nav a[href="/library"]').click();
    await expect(search).toHaveValue("Сборник");
    await page.locator('nav a[href="/shop"]').click();
    await expect(page.getByText("МАГАЗИН", { exact: true })).toBeVisible();
    const warmRequests = [...routes];
    await page.locator('nav a[href="/library"]').click();
    await expect(search).toHaveValue("Сборник");
    await info.attach("warm-navigation-requests", {
      body: JSON.stringify({ before: warmRequests, after: routes, documents }),
      contentType: "application/json",
    });
    expect(routes).toEqual(warmRequests);
    expect(documents).toBe(1);

    await search.fill("Обо мне");
    await page.getByRole("button", { name: "Читать →", exact: true }).click();
    await expect(page).toHaveURL(/\/library\/about-me$/);
    await page
      .locator("header")
      .getByRole("button", { name: "Вернуться назад" })
      .click();
    await expect(search).toHaveValue("Обо мне");
    const beforeDetail = [...routes];
    await page.getByRole("button", { name: "Читать →", exact: true }).click();
    await expect(page).toHaveURL(/\/library\/about-me$/);
    expect(routes).toEqual(beforeDetail);
    expect(documents).toBe(1);
  });

  test(`home retains its DOM, decoded images and scroll after leaving (${width}px)`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 844 });
    await layoutApi(page);
    await gotoWithSession(page, "/");
    const scroll = (await page
      .locator("main .ui-scroll:visible")
      .first()
      .elementHandle())!;
    await scroll.evaluate((node) => {
      node.scrollTop = 600;
    });
    const originalScroll = await scroll.evaluate((node) => node.scrollTop);
    const hero = (await page
      .locator('img[src*="hero_header"]')
      .first()
      .elementHandle())!;
    await page.locator('nav a[href="/library"]').click();
    await expect(page.getByPlaceholder("Поиск материалов...")).toBeVisible();
    await page.getByRole("link", { name: "На главную", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await scroll.evaluate((node) => node.isConnected)).toBe(true);
    expect(await hero.evaluate((node) => node.isConnected)).toBe(true);
    expect(await scroll.evaluate((node) => node.scrollTop)).toBe(
      originalScroll,
    );
    await page.screenshot({
      path: info.outputPath(`home-return-${width}.png`),
    });
  });
}
