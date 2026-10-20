import { test, expect } from "@playwright/test";
import { editorApi, failure } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

for (const mode of ["full", "quick"] as const) {
  test(`${mode}: closing an unconfirmed create cannot reset the draft and create it twice`, async ({
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
        return failure(503);
      }
    });
    await gotoWithSession(page, mode === "full" ? "/admin" : "/feed");
    await page
      .getByRole("button", {
        name: mode === "full" ? "Новый" : "Новый пост",
        exact: true,
      })
      .click();
    const form = page.getByRole("dialog", { name: "Редактор публикации" });
    await expect(
      form.getByText("Черновик сохранён на этом устройстве", { exact: true }),
    ).toBeVisible();
    await form
      .getByPlaceholder("Текст поста… Enter — новый абзац")
      .fill("UNCONFIRMED_DRAFT");
    const submit = form
      .getByRole("button", {
        name: mode === "full" ? "Сохранить" : "Опубликовать",
        exact: true,
      })
      .first();
    await submit.click();
    await expect.poll(() => creates.length).toBe(1);
    await expect
      .poll(() =>
        messages.some((message) =>
          message.includes("Результат сохранения не подтверждён"),
        ),
      )
      .toBe(true);
    await form
      .getByRole("button", { name: "Закрыть редактор", exact: true })
      .click();
    await expect(form).toBeVisible();
    await expect(
      form.getByPlaceholder("Текст поста… Enter — новый абзац"),
    ).toHaveValue("UNCONFIRMED_DRAFT");
    await expect(submit).toBeDisabled();
    await expect(
      form.getByRole("button", { name: "Проверить сохранение", exact: true }),
    ).toBeVisible();
    expect(creates).toHaveLength(1);
  });
  test(`${mode}: a lost private video upload response survives reload and requires an explicit recovery action`, async ({
    page,
  }) => {
    const creates: Record<string, unknown>[] = [];
    const uploads: string[] = [];
    let statusReads = 0;
    const messages: string[] = [];
    page.on("dialog", async (dialog) => {
      messages.push(dialog.message());
      await dialog.accept();
    });
    await editorApi(page, (name, input) => {
      if (name === "admin.createPost") creates.push(input);
      if (name === "admin.privateAttachmentStatus") {
        statusReads++;
        return failure(503);
      }
    });
    await page.route("**/api/admin/private-video-uploads?*", (route) => {
      uploads.push(route.request().headers()["idempotency-key"]);
      return route.fulfill({ status: 503, json: { error: "Unavailable" } });
    });
    const path = mode === "full" ? "/admin" : "/feed";
    const open = async () => {
      await gotoWithSession(page, path);
      await page
        .getByRole("button", {
          name: mode === "full" ? "Новый" : "Новый пост",
          exact: true,
        })
        .click();
    };
    await open();
    const form = page.getByRole("dialog", { name: "Редактор публикации" });
    const submit = form
      .getByRole("button", {
        name: mode === "full" ? "Сохранить" : "Опубликовать",
        exact: true,
      })
      .first();
    await expect(
      form.getByText("Черновик сохранён на этом устройстве", { exact: true }),
    ).toBeVisible();
    await form
      .getByPlaceholder("Текст поста… Enter — новый абзац")
      .fill("KEEP_SELECTED_MEDIA");
    const chooser = page.waitForEvent("filechooser");
    await form
      .getByRole("button", { name: "Выбрать видеофайл", exact: true })
      .click();
    await (
      await chooser
    ).setFiles({
      name: "chosen.webm",
      mimeType: "video/webm",
      buffer: Buffer.from("video fixture"),
    });
    // Picking journals the original File/key; uploading belongs to the save.
    await expect(
      form.getByText("Черновик сохранён на этом устройстве", { exact: true }),
    ).toBeVisible();
    expect(uploads).toEqual([]);
    await submit.click();
    await expect.poll(() => uploads.length).toBe(1);
    expect(uploads[0]).toMatch(/^[a-f0-9-]{36}$/);
    await expect.poll(() => messages.length).toBe(1);
    await expect(submit).toBeDisabled();
    await expect(form.getByRole("alert")).toContainText(
      "Новая отправка заблокирована",
    );
    expect(creates).toEqual([]);
    await open();
    await form
      .getByRole("button", { name: "Восстановить черновик", exact: true })
      .click();
    await expect(
      form.getByPlaceholder("Текст поста… Enter — новый абзац"),
    ).toHaveValue("KEEP_SELECTED_MEDIA");
    await expect(form.getByRole("alert")).toContainText(
      "Новая отправка заблокирована",
    );
    await expect(submit).toBeDisabled();
    expect(uploads).toHaveLength(1);
    expect(statusReads).toBe(0);
    await form
      .getByRole("button", { name: "Проверить сохранение", exact: true })
      .click();
    await expect.poll(() => statusReads).toBe(1);
    await expect(
      form.getByRole("button", { name: "Проверить сохранение", exact: true }),
    ).toBeEnabled();
    await expect(submit).toBeDisabled();
    expect(uploads).toHaveLength(1);
    expect(creates).toEqual([]);
    await form
      .getByRole("button", {
        name: "Проверил список — удалить локальную копию",
        exact: true,
      })
      .click();
    await expect(form).toHaveCount(0);
    await open();
    await expect(
      form.getByText("Черновик сохранён на этом устройстве", { exact: true }),
    ).toBeVisible();
    await expect(
      form.getByPlaceholder("Текст поста… Enter — новый абзац"),
    ).toHaveValue("");
    await form
      .getByPlaceholder("Текст поста… Enter — новый абзац")
      .fill("NEW_EXPLICIT_POST");
    await submit.click();
    await expect(form).toHaveCount(0);
    expect(creates).toHaveLength(1);
    expect(creates[0]).toMatchObject({ text: "NEW_EXPLICIT_POST", videos: [] });
    expect(uploads).toHaveLength(1);
  });
}
