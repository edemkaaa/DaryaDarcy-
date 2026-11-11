import { test, expect } from "@playwright/test";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

/** В обоих редакторах неопределённый исход не разрешает новую запись автоматически: нужны Retry-After или явная проверка статуса прежней операции. */
for (const mode of ["full", "quick"] as const) {
  /** На границе двух секунд проверяем ожидание без auto-retry, затем статус notRecorded и повтор upload с тем же ключом; create остаётся отдельным действием. */
  test(`${mode}: video 429 waits for Retry-After and manually recovers the original upload`, async ({
    page,
  }) => {
    const uploads: string[] = [];
    const creates: Record<string, unknown>[] = [];
    let statusReads = 0;
    const messages: string[] = [];
    page.on("dialog", async (dialog) => {
      messages.push(dialog.message());
      await dialog.accept();
    });
    await editorApi(page, (name, input) => {
      if (name === "admin.createPost") {
        creates.push(input);
        return ok(42);
      }
      if (name === "admin.privateAttachmentStatus") {
        statusReads++;
        expect(input.idempotencyKey).toBe(uploads[0]);
        return ok({ state: "notRecorded" });
      }
    });
    await page.route("**/api/admin/private-video-uploads?*", (route) => {
      uploads.push(route.request().headers()["idempotency-key"]);
      return uploads.length === 1
        ? route.fulfill({
            status: 429,
            headers: { "Retry-After": "2" },
            body: "",
          })
        : route.fulfill({
            json: {
              state: "ready",
              assetId: "3af23d8c-140f-454b-a123-123456789abc",
              type: "video",
              filename: "chosen.webm",
              mimeType: "video/webm",
              fileSize: 13,
            },
          });
    });
    await gotoWithSession(page, mode === "full" ? "/admin" : "/feed");
    await page.getByRole("button", { name: "Новый пост", exact: true }).click();
    const form = page.getByRole("dialog", { name: "Редактор публикации" });
    await expect(
      form.getByText("Черновик сохранён на этом устройстве", { exact: true }),
    ).toBeVisible();
    await form
      .getByPlaceholder("Текст поста… Enter — новый абзац")
      .fill("BUSY_VIDEO");
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
    await expect(
      form.getByText("Черновик сохранён на этом устройстве", { exact: true }),
    ).toBeVisible();
    const now = Date.now();
    await page.clock.setFixedTime(now);
    const submit = form
      .getByRole("button", {
        name: mode === "full" ? "Сохранить" : "Опубликовать",
        exact: true,
      })
      .first();
    await submit.click();
    const retry = form.getByRole("button", {
      name: "Проверить сохранение",
      exact: true,
    });
    await expect(retry).toBeDisabled();
    await expect(form.getByText(/Повтор через 2 с/)).toBeVisible();
    await expect
      .poll(() =>
        messages.some((message) => message.includes("другую видеозагрузку")),
      )
      .toBe(true);
    await page.clock.setFixedTime(now + 1999);
    await expect(form.getByText(/Повтор через 1 с/)).toBeVisible();
    await expect(retry).toBeDisabled();
    expect(uploads).toHaveLength(1);
    expect(statusReads).toBe(0);
    expect(creates).toHaveLength(0);
    await page.clock.setFixedTime(now + 2000);
    await expect(retry).toBeEnabled();
    expect(uploads).toHaveLength(1);
    await retry.click();
    await expect(submit).toBeEnabled();
    expect(statusReads).toBe(1);
    expect(uploads).toEqual([uploads[0], uploads[0]]);
    expect(creates).toHaveLength(0);
    await submit.click();
    await expect(form).toHaveCount(0);
    expect(creates).toHaveLength(1);
    expect(creates[0].privateAssetIds).toEqual([
      "3af23d8c-140f-454b-a123-123456789abc",
    ]);
    expect(page.url()).not.toContain("/login");
  });
  /** Закрытие редактора после неопределённого create не сбрасывает черновик и не разрешает второй create. */
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
        name: "Новый пост",
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
  /** Выбранный File и ключ переживают reload; неуспешная ручная проверка не повторяет upload, а удаление локальной копии требует отдельного подтверждения. */
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
    /** Повторно открываем исходный маршрут после полной навигации, чтобы восстановление шло из durable-журнала, а не памяти прежнего диалога. */
    const open = async () => {
      await gotoWithSession(page, path);
      await page
        .getByRole("button", {
          name: "Новый пост",
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
