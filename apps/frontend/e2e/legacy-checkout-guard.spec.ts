import { expect, test, type Page } from "@playwright/test";
import { gotoWithSession, layoutApi } from "./layout-fixtures";
import { failure, ok } from "./editor-fixtures";

test.skip(
  process.env.NORMAL_CHECKOUT_UI_ENABLED === "true",
  "Existing NORMAL/GUEST uses its own recovery protocol.",
);
const testMode = process.env.PRODAMUS_RETURN_UI_ENABLED === "true";
const mode = testMode ? "prodamus-test" : "legacy";
const slot = `darcy:guest:${mode}:checkout-guard:v1`;
const destination = testMode
  ? "https://testpage1.payform.ru/?demo_mode=1&payments_limit=1&sum=790.00&currency=rub&order_id=club-test-101-00000000-0000-4000-8000-000000000001"
  : "https://payments.example.test/legacy-guard";
const pay = (page: Page) =>
  page
    .getByRole("button", {
      name: testMode ? "Открыть тестовую оплату" : "Оплатить 790 ₽",
      exact: true,
    })
    .first();
async function fixture(page: Page) {
  await layoutApi(page);
  const state = { writes: 0, success: false };
  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const names = url.pathname.split("/api/trpc/")[1].split(",");
    if (!names.includes("club.createCheckout")) return route.fallback();
    expect(names).not.toContain("club.createNormalCheckout");
    state.writes++;
    await route.fulfill({
      json: names.map(() =>
        state.success ? ok({ url: destination, user: null }) : failure(503),
      ),
    });
  });
  await page.route(destination, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "Synthetic provider page",
    }),
  );
  return state;
}
async function form(page: Page) {
  await gotoWithSession(page, "/club");
  await page
    .getByPlaceholder("Почта для чека и входа")
    .first()
    .fill("guest@example.test");
  await page
    .getByRole("textbox", { name: "Номер телефона", exact: true })
    .first()
    .fill("+79991234567");
  await expect(pay(page)).toBeEnabled();
}
const saved = (page: Page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), slot);
test("unknown checkout survives reload and cancellation sends no new request", async ({
  page,
}) => {
  const state = await fixture(page);
  await form(page);
  await pay(page).click();
  await expect(page.getByRole("alert").first()).toContainText(
    "Создание ссылки не подтверждено",
  );
  const intent = await saved(page);
  await form(page);
  await expect(page.getByRole("alert").first()).toContainText(
    "Создание ссылки не подтверждено",
  );
  page.once("dialog", (dialog) => dialog.dismiss());
  await pay(page).click();
  expect(state.writes).toBe(1);
  expect(await saved(page)).toEqual(intent);
  state.success = true;
  page.once("dialog", (dialog) => dialog.accept());
  await pay(page).click();
  await expect(page).toHaveURL(destination);
  expect(state.writes).toBe(2);
});
test("another tab sees the same unknown request and cannot silently replace it", async ({
  page,
  context,
}) => {
  const first = await fixture(page);
  await form(page);
  await pay(page).click();
  await expect(page.getByRole("alert").first()).toContainText(
    "Создание ссылки не подтверждено",
  );
  const second = await context.newPage();
  const secondState = await fixture(second);
  await form(second);
  await expect(second.getByRole("alert").first()).toContainText(
    "Создание ссылки не подтверждено",
  );
  expect(await saved(second)).toEqual(await saved(page));
  second.once("dialog", (dialog) => dialog.dismiss());
  await pay(second).click();
  expect(first.writes).toBe(1);
  expect(secondState.writes).toBe(0);
  await second.close();
});
test("unavailable storage blocks checkout before sending bytes", async ({
  page,
}) => {
  const state = await fixture(page);
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.includes(":checkout-guard:"))
        throw new DOMException("Quota", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await form(page);
  await pay(page).click();
  await expect(page.getByRole("alert").first()).toContainText(
    "Не удалось надёжно сохранить заявку",
  );
  expect(state.writes).toBe(0);
});
