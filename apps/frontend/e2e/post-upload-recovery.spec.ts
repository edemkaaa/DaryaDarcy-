import { test, expect } from "@playwright/test";
import sharp from "sharp";
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
  for (const kind of ["photo", "video"] as const) {
    test(`${mode}: an unknown ${kind} upload blocks partial publication until explicitly discarded`, async ({
      page,
    }) => {
      const creates: Record<string, unknown>[] = [];
      let uploads = 0;
      const messages: string[] = [];
      page.on("dialog", async (dialog) => {
        messages.push(dialog.message());
        await dialog.accept();
      });
      await editorApi(page, (name, input) => {
        if (name === "admin.createPost") creates.push(input);
        if (name === "admin.uploadPhoto") {
          uploads++;
          return failure(503);
        }
      });
      await page.route("**/api/admin/upload-video?*", (route) => {
        uploads++;
        return route.fulfill({ status: 503, json: { error: "Unavailable" } });
      });
      await gotoWithSession(page, mode === "full" ? "/admin" : "/feed");
      await page
        .getByRole("button", {
          name: mode === "full" ? "Новый" : "Новый пост",
          exact: true,
        })
        .click();
      const form = page.getByRole("dialog", { name: "Редактор публикации" });
      // The visible editor remains inert until its local draft is read.
      await expect(
        form.getByText("Черновик сохранён на этом устройстве", { exact: true }),
      ).toBeVisible();
      await form
        .getByPlaceholder("Текст поста… Enter — новый абзац")
        .fill("KEEP_SELECTED_MEDIA");
      await expect(
        form.getByPlaceholder("Текст поста… Enter — новый абзац"),
      ).toHaveValue("KEEP_SELECTED_MEDIA");
      await expect(
        form.getByText("Черновик сохранён на этом устройстве", { exact: true }),
      ).toBeVisible();
      const chooser = page.waitForEvent("filechooser");
      await form
        .getByRole("button", {
          name: kind === "photo" ? "Выбрать из галереи" : "Выбрать видеофайл",
          exact: true,
        })
        .click();
      await (
        await chooser
      ).setFiles({
        name: kind === "photo" ? "chosen.png" : "chosen.webm",
        mimeType: kind === "photo" ? "image/png" : "video/webm",
        buffer:
          kind === "photo"
            ? await sharp({
                create: {
                  width: 10,
                  height: 10,
                  channels: 3,
                  background: "red",
                },
              })
                .png()
                .toBuffer()
            : Buffer.from("video fixture"),
      });
      await expect.poll(() => uploads).toBe(1);
      await expect.poll(() => messages.length).toBe(1);
      await form
        .getByRole("button", {
          name: mode === "full" ? "Сохранить" : "Опубликовать",
          exact: true,
        })
        .first()
        .click();
      await expect.poll(() => creates.length + messages.length).toBe(2);
      await expect(form).toBeVisible();
      expect(creates).toEqual([]);
      await expect(form.getByRole("alert")).toContainText(
        kind === "photo" ? "chosen.png" : "chosen.webm",
      );
      await expect(
        form.getByText("Черновик сохранён на этом устройстве", { exact: true }),
      ).toBeVisible();
      await gotoWithSession(page, mode === "full" ? "/admin" : "/feed");
      await page
        .getByRole("button", {
          name: mode === "full" ? "Новый" : "Новый пост",
          exact: true,
        })
        .click();
      await form
        .getByRole("button", { name: "Восстановить черновик", exact: true })
        .click();
      await expect(
        form.getByPlaceholder("Текст поста… Enter — новый абзац"),
      ).toHaveValue("KEEP_SELECTED_MEDIA");
      await expect(form.getByRole("alert")).toContainText(
        kind === "photo" ? "chosen.png" : "chosen.webm",
      );
      expect(uploads).toBe(1);
      expect(creates).toEqual([]);
      await form
        .getByRole("button", {
          name: "Отказаться от выбранных файлов",
          exact: true,
        })
        .click();
      await form
        .getByRole("button", {
          name: mode === "full" ? "Сохранить" : "Опубликовать",
          exact: true,
        })
        .first()
        .click();
      await expect(form).toHaveCount(0);
      expect(creates).toHaveLength(1);
      expect(creates[0]).toMatchObject({
        text: "KEEP_SELECTED_MEDIA",
        photos: [],
        videos: [],
      });
      expect(uploads).toBe(1);
    });
  }
}
