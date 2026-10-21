import { expect, test } from "@playwright/test";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

for (const mode of ["full", "quick"] as const) {
  for (const changed of [false, true]) {
    test(`${mode}: a definite rejection ${changed ? "starts a new intent for changed data" : "keeps the same creation intent"}`, async ({
      page,
    }) => {
      const creates: Record<string, unknown>[] = [];
      const messages: string[] = [];
      page.on("dialog", async (dialog) => {
        messages.push(dialog.message());
        await dialog.accept();
      });
      await editorApi(page, (name, input) => {
        if (name === "admin.createPost") {
          creates.push(input);
          return creates.length === 1 ? failure(400) : ok(42);
        }
      });
      await gotoWithSession(page, mode === "full" ? "/admin" : "/feed");
      const open = page.getByRole("button", {
        name: "Новый пост",
        exact: true,
      });
      await open.click();
      const form = page.getByRole("dialog", { name: "Редактор публикации" });
      await expect(form.locator(".ui-scroll")).not.toHaveAttribute("inert", "");
      const text = form.getByPlaceholder("Текст поста… Enter — новый абзац");
      const submit = form
        .getByRole("button", {
          name: mode === "full" ? "Сохранить" : "Опубликовать",
          exact: true,
        })
        .first();
      await text.fill("FIRST_INTENT");
      await submit.click();
      await expect.poll(() => messages.length).toBe(1);
      await expect(text).toHaveValue("FIRST_INTENT");
      expect(creates[0].idempotencyKey).toMatch(uuid);
      if (changed) await text.fill("CORRECTED_INTENT");
      await submit.click();
      await expect(form).toHaveCount(0);
      expect(creates).toHaveLength(2);
      expect(creates[1].idempotencyKey).toMatch(uuid);
      if (changed) {
        expect(creates[1].idempotencyKey).not.toBe(creates[0].idempotencyKey);
        expect(creates[1].text).toBe("CORRECTED_INTENT");
      } else {
        expect(creates[1]).toEqual(creates[0]);
      }
      // A confirmed creation terminates its intent even for identical text.
      await open.click();
      await expect(form.locator(".ui-scroll")).not.toHaveAttribute("inert", "");
      await text.fill(changed ? "CORRECTED_INTENT" : "FIRST_INTENT");
      await submit.click();
      await expect(form).toHaveCount(0);
      expect(creates).toHaveLength(3);
      expect(creates[2].idempotencyKey).toMatch(uuid);
      expect(creates[2].idempotencyKey).not.toBe(creates[1].idempotencyKey);
    });
  }
}
