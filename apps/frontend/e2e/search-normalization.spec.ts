import { expect, test } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

test("library searches ignore edge spaces and letter case without rewriting the input", async ({
  page,
}) => {
  await layoutApi(page);
  await gotoWithSession(page, "/library");
  const search = page.getByRole("textbox", { name: "Поиск по библиотеке" });
  await search.fill("  ОБО МНЕ  ");
  await expect(search).toHaveValue("  ОБО МНЕ  ");
  await expect(page.getByText("Обо мне", { exact: true })).toBeVisible();
  await expect(page.getByText("Гид по эстетикам", { exact: true })).toHaveCount(
    0,
  );
  if (process.env.SEARCH_SCREENSHOTS) {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `${process.env.SEARCH_SCREENSHOTS}/library-spaces.png`,
      animations: "disabled",
    });
  }
  await search.fill("   ");
  await expect(page.getByText("Обо мне", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Гид по эстетикам", { exact: true }),
  ).toBeVisible();
  await search.fill("обо мне");
  await expect(page.getByText("Обо мне", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Очистить поиск" }).click();
  await expect(search).toHaveValue("");
  await expect(
    page.getByText("Гид по эстетикам", { exact: true }),
  ).toBeVisible();
});

test("feed sends trimmed case-normalized search and preserves the typed text", async ({
  page,
}) => {
  const searches: unknown[] = [];
  await layoutApi(page, false, (name, input) => {
    if (name !== "feed.listPaginated") return undefined;
    searches.push(input.search);
    return { result: { data: { json: { posts: [], nextCursor: null } } } };
  });
  await gotoWithSession(page, "/feed");
  const search = page.getByRole("textbox", { name: "Поиск по ленте" });
  await search.fill("  САД  ");
  await expect.poll(() => searches.includes("сад")).toBe(true);
  await expect(search).toHaveValue("  САД  ");
  await search.fill("  ДОМ  ");
  await expect.poll(() => searches.includes("дом")).toBe(true);
  expect(
    searches
      .filter((value): value is string => typeof value === "string")
      .every(
        (value) => value === value.trim().toLowerCase() && value.length > 0,
      ),
  ).toBe(true);
  await page.getByRole("button", { name: "Очистить поиск" }).click();
  await expect(search).toHaveValue("");
});
