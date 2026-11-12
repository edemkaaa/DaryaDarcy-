import { expect, test, type Page } from "@playwright/test";
import { join } from "node:path";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const form = (page: Page) =>
  page.getByRole("dialog", { name: "Редактор публикации" });
const input = (page: Page) =>
  form(page).getByPlaceholder("Текст поста… Enter — новый абзац");
async function open(page: Page, mode: "quick" | "full") {
  await gotoWithSession(page, mode === "quick" ? "/feed" : "/admin");
  await page.getByRole("button", { name: "Новый пост", exact: true }).click();
  await expect(
    form(page).getByText("Черновик сохранён на этом устройстве", {
      exact: true,
    }),
  ).toBeVisible();
}
async function capture(page: Page, name: string) {
  if (process.env.NOTICE_SCREENSHOTS) {
    await expect(
      page.getByText("Сохраняем черновик…", { exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: join(process.env.NOTICE_SCREENSHOTS, `${name}.png`),
      animations: "disabled",
    });
  }
}
for (const mode of ["quick", "full"] as const) {
  test(`${mode}: draft notifications stay below the form and do not move its fields`, async ({
    page,
  }) => {
    await editorApi(page);
    await open(page, mode);
    await capture(page, `${mode}-draft`);
    const slot = form(page).locator("[data-background-notice]");
    await expect(slot).toHaveCount(1);
    // Measure layout within the content, independently of focus scrolling on short screens.
    const fieldTop = () =>
      input(page).evaluate(
        (element) =>
          element.getBoundingClientRect().top -
          element.closest(".ui-scroll-content")!.getBoundingClientRect().top,
      );
    const first = await fieldTop();
    await input(page).fill("Черновик для проверки уведомлений");
    await expect(
      form(page).getByText("Черновик сохранён на этом устройстве", {
        exact: true,
      }),
    ).toBeVisible();
    expect(await fieldTop()).toBeCloseTo(first, 0);
    const card = await slot.getByRole("status").boundingBox();
    const bounds = await form(page).boundingBox();
    const grid = await input(page).evaluate((element) => {
      const content = element.closest(".ui-scroll-content")!;
      const bounds = content.getBoundingClientRect();
      const style = getComputedStyle(content);
      return {
        left: bounds.left + parseFloat(style.paddingLeft),
        right: bounds.right - parseFloat(style.paddingRight),
      };
    });
    expect(card!.x).toBeCloseTo(grid.left, 0);
    expect(card!.x + card!.width).toBeCloseTo(grid.right, 0);
    expect(bounds!.y + bounds!.height - card!.y - card!.height).toBeCloseTo(
      12,
      0,
    );
    expect(
      await slot.evaluate((element) => element.closest("[inert]") === null),
    ).toBe(true);
    await page.keyboard.press("Escape");
    // Unsaved edits must keep their existing confirmation, not turn into a dismissible toast.
  });
}
test("modal recovery actions remain clickable and keyboard accessible", async ({
  page,
}) => {
  let writes = 0;
  let committed = false;
  const keys: unknown[] = [];
  await editorApi(page, (name, payload) => {
    if (name === "admin.createPost") {
      writes++;
      keys.push(payload.idempotencyKey);
      return committed ? ok(77) : failure(500);
    }
  });
  page.on("dialog", (dialog) => dialog.dismiss());
  await open(page, "quick");
  await input(page).fill("Проверка неизвестного результата записи");
  await form(page)
    .getByRole("button", { name: "Опубликовать", exact: true })
    .first()
    .click();
  const slot = form(page).locator("[data-background-notice]");
  await expect(slot).toContainText(
    "Результат предыдущего сохранения не подтверждён",
  );
  const check = slot.getByRole("button", {
    name: "Проверить сохранение",
    exact: true,
  });
  await expect(check).toBeEnabled();
  await check.focus();
  await expect(check).toBeFocused();
  const recoveryActions = await slot.getByRole("button").all();
  for (const action of recoveryActions) {
    expect((await action.boundingBox())!.height).toBeLessThanOrEqual(32);
  }
  if (page.viewportSize()!.width >= 390) {
    expect((await recoveryActions[0].boundingBox())!.y).toBeCloseTo(
      (await recoveryActions[1].boundingBox())!.y,
      0,
    );
  }
  await capture(page, "modal-recovery");
  expect(writes).toBe(1);
  // Only the explicit recovery action may replay the same idempotent creation.
  committed = true;
  await check.press("Enter");
  await expect(form(page)).toHaveCount(0);
  expect(writes).toBe(2);
  expect(keys[1]).toBe(keys[0]);
  expect(keys[0]).toEqual(expect.any(String));
});
test("a nested dialog hides parent notices and returns them on close", async ({
  page,
}) => {
  await editorApi(page);
  await open(page, "quick");
  const parent = form(page);
  await input(page).fill("Текст ссылки");
  await input(page).evaluate((element: HTMLTextAreaElement) => {
    element.focus();
    element.setSelectionRange(0, element.value.length);
    element.dispatchEvent(new Event("select", { bubbles: true }));
  });
  await parent
    .getByRole("button", { name: "Добавить ссылку", exact: true })
    .click();
  const nested = page.getByRole("dialog", { name: "Ссылка в публикации" });
  await expect(nested).toBeVisible();
  await expect(parent.locator("[data-background-notice]")).not.toBeVisible();
  await page.keyboard.press("Escape");
  await expect(nested).toHaveCount(0);
  await expect(parent.locator("[data-background-notice]")).toBeVisible();
});

test("date validation stays by the field without shifting the following content", async ({
  page,
}) => {
  await editorApi(page);
  await open(page, "quick");
  await form(page)
    .getByRole("button", { name: "Отложить", exact: true })
    .click();
  const date = form(page).locator('input[type="datetime-local"]').first();
  await date.fill("2040-01-01T10:00");
  const before = await input(page).boundingBox();
  await date.fill("2020-01-01T10:00");
  await expect(
    form(page).getByText("Выберите дату и время в будущем", { exact: true }),
  ).toBeVisible();
  await capture(page, "date-validation");
  expect((await input(page).boundingBox())!.y).toBeCloseTo(before!.y, 0);
  await date.fill("2040-01-01T10:00");
  expect((await input(page).boundingBox())!.y).toBeCloseTo(before!.y, 0);
});
