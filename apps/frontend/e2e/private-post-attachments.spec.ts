import { expect, test, type Page, type Locator } from "@playwright/test";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

type Mode = "full" | "quick";
const assetId = "3af23d8c-140f-454b-a123-123456789abc";
const existing = {
  id: 7,
  text: "ORIGINAL",
  photos: [],
  tags: [],
  status: "published",
  published: true,
  target: "feed",
  sortOrder: 35,
  scheduledAt: null,
  richText: null,
  createdAt: "2026-10-04T10:00:00Z",
  publishedAt: "2026-10-04T10:00:00Z",
  likeCount: 0,
  commentCount: 0,
  media: [
    {
      id: 9,
      type: "document",
      url: "https://example.test/old.pdf",
      filename: "old.pdf",
      mimeType: "application/pdf",
      duration: null,
      posterUrl: null,
      fileSize: null,
      postId: 7,
      sortOrder: 0,
      createdAt: "2026-10-04T10:00:00Z",
    },
  ],
};
/** Адресуем текст текущего экземпляра редактора после reload или смены аккаунта. */
const field = (form: Locator) =>
  form.getByPlaceholder("Текст поста… Enter — новый абзац");
/** Выбираем фактическое действие create/edit в полном либо быстром редакторе. */
const submit = (form: Locator, mode: Mode, edit = false) =>
  form
    .getByRole("button", {
      name: mode === "full" || edit ? "Сохранить" : "Опубликовать",
      exact: true,
    })
    .first();
/** Открываем create/edit через соответствующий интерфейс и ждём чтения account-scoped черновика. */
async function open(page: Page, mode: Mode, edit = false) {
  await gotoWithSession(page, mode === "full" ? "/admin" : "/feed");
  if (edit && mode === "quick")
    await page
      .getByRole("button", { name: "Действия с постом", exact: true })
      .first()
      .click();
  await page
    .getByRole("button", {
      name: edit ? "Редактировать пост" : "Новый пост",
      exact: true,
    })
    .first()
    .click();
  const form = page.getByRole("dialog", { name: "Редактор публикации" });
  await expect(form).toBeVisible();
  await expect(form.getByText("Проверяем сохранённый черновик…")).toHaveCount(
    0,
  );
  return form;
}
/** Выбираем небольшой синтетический документ и ждём его локального появления; выбор не должен отправлять upload. */
async function choose(page: Page, form: Locator) {
  const chooser = page.waitForEvent("filechooser");
  await form.getByRole("button", { name: "Документ", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "kept.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("private original bytes"),
  });
  await expect(form.getByText("kept.txt", { exact: true })).toBeVisible();
}
const receipt = {
  state: "ready",
  assetId,
  type: "document",
  filename: "kept.txt",
  mimeType: "text/plain",
  fileSize: 22,
};

/** Оба редактора проверяют отказ legacy DOC, изоляцию поздних receipt между аккаунтами и восстановление document upload после reload. */
for (const mode of ["full", "quick"] as const) {
  test(`${mode}: unsupported legacy DOC stays local and sends no private/public upload`, async ({
    page,
  }) => {
    const writes: string[] = [];
    const messages: string[] = [];
    page.on("dialog", async (dialog) => {
      messages.push(dialog.message());
      await dialog.accept();
    });
    await editorApi(page, (name) => {
      if (/admin\.(upload|createPost)/.test(name)) writes.push(name);
    });
    const form = await open(page, mode);
    const chooser = page.waitForEvent("filechooser");
    await form.getByRole("button", { name: "Документ", exact: true }).click();
    await (
      await chooser
    ).setFiles({
      name: "legacy.doc",
      mimeType: "application/msword",
      buffer: Buffer.from("legacy fixture"),
    });
    await expect.poll(() => messages.length).toBe(1);
    await expect(form.getByText("legacy.doc", { exact: true })).toHaveCount(0);
    expect(writes).toEqual([]);
  });
  /** Меняем личность отдельно при ожидающем upload и при status-read: receipt старого владельца нельзя привязать к новому черновику. */
  for (const stage of ["upload", "status"] as const) {
    test(`${mode}: account switch during ${stage} drops late receipt and preserves only original owner's draft`, async ({
      page,
    }) => {
      let owner = 101;
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      let uploads = 0;
      let statuses = 0;
      let writes = 0;
      const messages: string[] = [];
      page.on("dialog", async (dialog) => {
        messages.push(dialog.message());
        await dialog.accept();
      });
      await editorApi(page, async (name) => {
        if (name === "admin.uploadPrivateAttachment") {
          uploads++;
          if (stage === "status") return failure(503);
          await held;
          return ok(receipt);
        }
        if (name === "admin.privateAttachmentStatus") {
          statuses++;
          await held;
          return ok(receipt);
        }
        if (name === "admin.createPost" || name === "admin.updatePost")
          writes++;
      });
      await page.route("**/api/auth/me", (route) =>
        route.fulfill({
          json: {
            user: {
              id: owner,
              openId: `test-${owner}`,
              role: "admin",
              name: "Admin",
              email: `${owner}@example.test`,
              lastSignedIn: "2026-10-15T10:00:00Z",
            },
          },
        }),
      );
      let form = await open(page, mode);
      await field(form).fill("OWNER_101_PRIVATE");
      await choose(page, form);
      await submit(form, mode).click();
      await expect.poll(() => uploads).toBe(1);
      if (stage === "status") {
        await expect.poll(() => messages.length).toBe(1);
        await form
          .getByRole("button", { name: "Проверить сохранение", exact: true })
          .click();
        await expect.poll(() => statuses).toBe(1);
      }
      owner = 202;
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await expect(form).toHaveCount(0);
      await page
        .getByRole("button", {
          name: "Новый пост",
          exact: true,
        })
        .first()
        .click();
      form = page.getByRole("dialog", { name: "Редактор публикации" });
      await expect(
        form.getByText("Проверяем сохранённый черновик…"),
      ).toHaveCount(0);
      await expect(field(form)).toHaveValue("");
      await expect(form.getByText("kept.txt", { exact: true })).toHaveCount(0);
      release();
      await expect(
        form.getByText("Черновик сохранён на этом устройстве", { exact: true }),
      ).toBeVisible();
      expect(writes).toBe(0);
      expect(uploads).toBe(1);
      owner = 101;
      form = await open(page, mode);
      await form
        .getByRole("button", { name: "Восстановить черновик", exact: true })
        .click();
      await expect(field(form)).toHaveValue("OWNER_101_PRIVATE");
      await expect(form.getByText("kept.txt", { exact: true })).toBeVisible();
      await expect(submit(form, mode)).toBeDisabled();
      expect(writes).toBe(0);
    });
  }
  /** Create/edit и ready/notRecorded различают принятие готового receipt и повтор исходных байтов с тем же ключом; публикация остаётся отдельным действием. */
  for (const edit of [false, true]) {
    for (const outcome of ["ready", "notRecorded"] as const) {
      test(`${mode}/${edit ? "edit" : "create"}: lost upload ACK + reload + ${outcome} retains bytes/key and binds once`, async ({
        page,
      }) => {
        const uploads: Record<string, unknown>[] = [];
        const writes: Record<string, unknown>[] = [];
        const statuses: Record<string, unknown>[] = [];
        let publicUploads = 0;
        const messages: string[] = [];
        page.on("dialog", async (dialog) => {
          if (dialog.type() === "alert") messages.push(dialog.message());
          await dialog.accept();
        });
        await editorApi(page, (name, input) => {
          if (name === "admin.posts") return ok([existing]);
          if (name === "feed.listPaginated")
            return ok({ posts: [existing], nextCursor: null });
          if (name === "admin.uploadMedia") {
            publicUploads++;
            return failure(503);
          }
          if (name === "admin.uploadPrivateAttachment") {
            uploads.push(input);
            return uploads.length === 1 ? failure(503) : ok(receipt);
          }
          if (name === "admin.privateAttachmentStatus") {
            statuses.push(input);
            return ok(outcome === "ready" ? receipt : { state: "notRecorded" });
          }
          if (name === "admin.createPost" || name === "admin.updatePost")
            writes.push(input);
        });
        let form = await open(page, mode, edit);
        await field(form).fill("PRIVATE_RECOVERY");
        await choose(page, form);
        await submit(form, mode, edit).click();
        await expect.poll(() => messages.length).toBe(1);
        expect(uploads).toHaveLength(1);
        expect(publicUploads).toBe(0);
        expect(writes).toHaveLength(0);
        await expect(submit(form, mode, edit)).toBeDisabled();
        await page.reload({ waitUntil: "domcontentloaded" });
        form = await open(page, mode, edit);
        await form
          .getByRole("button", { name: "Восстановить черновик", exact: true })
          .click();
        await expect(field(form)).toHaveValue("PRIVATE_RECOVERY");
        await expect(form.getByText("kept.txt", { exact: true })).toBeVisible();
        await form
          .getByRole("button", { name: "Проверить сохранение", exact: true })
          .click();
        await expect(submit(form, mode, edit)).toBeEnabled();
        expect(statuses).toEqual([
          { idempotencyKey: uploads[0].idempotencyKey },
        ]);
        expect(uploads).toHaveLength(outcome === "ready" ? 1 : 2);
        if (outcome === "notRecorded") expect(uploads[1]).toEqual(uploads[0]);
        expect(uploads[0]).toEqual({
          idempotencyKey: expect.stringMatching(/^[A-Za-z0-9._:-]{16,128}$/),
          type: "document",
          filename: "kept.txt",
          mimeType: "text/plain",
          base64: "cHJpdmF0ZSBvcmlnaW5hbCBieXRlcw==",
        });
        expect(writes).toHaveLength(0); // Upload recovery does not publish.
        await submit(form, mode, edit).click();
        await expect(form).toHaveCount(0);
        expect(writes).toHaveLength(1);
        expect(writes[0]).toMatchObject({
          privateAssetIds: [assetId],
          text: "PRIVATE_RECOVERY",
        });
        expect(writes[0]).not.toHaveProperty("attachments");
        expect(writes[0]).not.toHaveProperty("removedMediaIds"); // old.pdf stays attached.
        if (edit) {
          expect(writes[0]).not.toHaveProperty("videos");
          expect(writes[0]).not.toHaveProperty("sortOrder");
        }
        expect(publicUploads).toBe(0);
      });
    }
  }
}
