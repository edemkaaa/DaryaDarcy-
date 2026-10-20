import { expect, test } from "@playwright/test";
import { editorApi } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

test("calendar opens an independent scheduled club editor and a subsequent new post starts with its defaults", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-10T12:00:00Z"));
  const created: Record<string, unknown>[] = [];
  await editorApi(page, (name, input) => {
    if (name === "admin.createPost") created.push(input);
  });
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Календарь", exact: true }).click();
  await page
    .getByRole("button", { name: /15 октября 2026.*создать публикацию/ })
    .click();
  const form = page.getByRole("dialog", { name: "Редактор публикации" });
  const input = form.getByPlaceholder("Текст поста… Enter — новый абзац");
  await expect(form.getByText("Проверяем сохранённый черновик…")).toHaveCount(
    0,
  );
  await input.fill("Scheduled from calendar");
  await form.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(form).toHaveCount(0);
  expect(created[0]).toMatchObject({
    text: "Scheduled from calendar",
    status: "scheduled",
    target: "club",
  });
  const chosen = new Date(created[0].scheduledAt as string);
  const parts = await page.evaluate((value) => {
    const date = new Date(value);
    return [
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
    ];
  }, chosen.toISOString());
  expect(parts).toEqual([2026, 9, 15, 10]);
  await page.getByRole("button", { name: "Новый пост", exact: true }).click();
  await expect(form.getByText("Проверяем сохранённый черновик…")).toHaveCount(
    0,
  );
  await expect(input).toHaveValue("");
  await input.fill("Fresh ordinary post");
  await form.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(form).toHaveCount(0);
  expect(created[1]).toMatchObject({
    text: "Fresh ordinary post",
    status: "published",
    target: "feed",
    scheduledAt: null,
  });
});
