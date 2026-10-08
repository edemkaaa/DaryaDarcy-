import { expect, test, type Page, type Locator } from "@playwright/test";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

test.setTimeout(45_000);
type Mode = "full" | "quick";
const editor = (page: Page) =>
  page.getByRole("dialog", { name: "Редактор публикации" });
const field = (form: Locator) =>
  form.getByPlaceholder("Текст поста… Enter — новый абзац");
const submit = (form: Locator, mode: Mode, editing = false) =>
  form
    .getByRole("button", {
      name: mode === "full" || editing ? "Сохранить" : "Опубликовать",
      exact: true,
    })
    .first();
async function open(page: Page, mode: Mode, editing = false) {
  await gotoWithSession(page, mode === "full" ? "/admin" : "/feed");
  if (editing && mode === "quick")
    await page
      .getByRole("button", { name: "Действия с постом", exact: true })
      .first()
      .click();
  await page
    .getByRole("button", {
      name: editing
        ? "Редактировать пост"
        : mode === "full"
          ? "Новый"
          : "Новый пост",
      exact: true,
    })
    .first()
    .click();
  await expect(editor(page)).toBeVisible();
  await expect(
    editor(page).getByText("Проверяем сохранённый черновик…"),
  ).toHaveCount(0);
  return editor(page);
}
async function saved(form: Locator) {
  await expect(
    form.getByText("Черновик сохранён на этом устройстве", { exact: true }),
  ).toBeVisible();
}
async function choose(
  page: Page,
  form: Locator,
  kind: "Аудио" | "Документ",
  name: string,
  mimeType: string,
) {
  const chooser = page.waitForEvent("filechooser");
  await form.getByRole("button", { name: kind, exact: true }).click();
  await (
    await chooser
  ).setFiles({ name, mimeType, buffer: Buffer.from("attachment fixture") });
  await expect(form.getByText(name, { exact: true })).toBeVisible();
}
function dialogs(page: Page) {
  const messages: string[] = [];
  page.on("dialog", async (dialog) => {
    if (dialog.type() === "alert") messages.push(dialog.message());
    await dialog.accept();
  });
  return messages;
}
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
  media: [
    {
      id: 9,
      type: "document",
      url: "https://example.test/old.pdf",
      filename: "old.pdf",
      mimeType: "application/pdf",
    },
  ],
};

for (const mode of ["full", "quick"] as const) {
  test(`${mode}: reload restores text, formatting and selected Files without sending anything`, async ({
    page,
  }) => {
    const writes: string[] = [];
    let created: Record<string, unknown> | undefined;
    await editorApi(page, (name, input) => {
      if (/admin\.(createPost|updatePost|uploadMedia)/.test(name))
        writes.push(name);
      if (name === "admin.createPost") created = input;
    });
    dialogs(page);
    let form = await open(page, mode);
    await field(form).fill("RELOAD_DRAFT");
    await field(form).evaluate((node: HTMLTextAreaElement) => {
      node.focus();
      node.setSelectionRange(0, node.value.length);
      node.dispatchEvent(new Event("select", { bubbles: true }));
    });
    await form.getByRole("button", { name: "К", exact: true }).click();
    await form.getByRole("button", { name: "Проверить", exact: true }).click();
    await expect(form.locator("[class*='italic']")).toContainText(
      "RELOAD_DRAFT",
    );
    const bold = form.getByRole("button", { name: "Ж", exact: true });
    await bold.focus();
    await bold.press("Enter");
    await expect(form.locator("[class*='bold']")).toContainText("RELOAD_DRAFT");
    for (const [start, end, url] of [
      [0, 6, "https://example.test/first"],
      [7, 12, "https://example.test/second"],
    ] as const) {
      await field(form).evaluate(
        (node: HTMLTextAreaElement, range) => {
          node.focus();
          node.setSelectionRange(range[0], range[1]);
          node.dispatchEvent(new Event("select", { bubbles: true }));
        },
        [start, end],
      );
      await form
        .getByRole("button", { name: "Добавить ссылку", exact: true })
        .click();
      const link = page.getByRole("dialog", { name: "Ссылка в публикации" });
      await link.getByPlaceholder("https://...").fill(url);
      await link.getByRole("button", { name: "Добавить", exact: true }).click();
      await expect(link).toHaveCount(0);
    }
    await choose(page, form, "Аудио", "kept.wav", "audio/wav");
    await choose(page, form, "Документ", "kept.txt", "text/plain");
    await saved(form);
    await page.reload({ waitUntil: "domcontentloaded" });
    form = await open(page, mode);
    expect(
      await field(form).evaluate((node) => Boolean(node.closest("[inert]"))),
    ).toBe(true); // The offered copy cannot be overwritten.
    expect(writes).toEqual([]);
    await form
      .getByRole("button", { name: "Восстановить черновик", exact: true })
      .click();
    await expect(field(form)).toHaveValue("RELOAD_DRAFT");
    await expect(form.getByText("kept.wav", { exact: true })).toBeVisible();
    await expect(form.getByText("kept.txt", { exact: true })).toBeVisible();
    await saved(form);
    expect(writes).toEqual([]);
    // Actual IndexedDB File cloning is exercised by the browser, then by FileReader.
    await page.route("**/api/trpc/admin.uploadMedia*", async (route) => {
      writes.push("admin.uploadMedia");
      const input = JSON.parse(route.request().postData() || "{}")[0].json;
      expect(input.base64).toBe(
        Buffer.from("attachment fixture").toString("base64"),
      );
      await route.fulfill({
        json: [
          ok({
            url: `https://example.test/${input.filename}`,
            mimeType: input.mimeType,
            fileSize: 18,
          }),
        ],
      });
    });
    await submit(form, mode).click();
    await expect(form).toHaveCount(0);
    expect(writes).toEqual([
      "admin.uploadMedia",
      "admin.uploadMedia",
      "admin.createPost",
    ]);
    expect(JSON.stringify(created?.richText)).toContain('"italic":true');
    expect(JSON.stringify(created?.richText)).toContain('"bold":true');
    expect(JSON.stringify(created?.richText)).toContain(
      "https://example.test/first",
    );
    expect(JSON.stringify(created?.richText)).toContain(
      "https://example.test/second",
    );
  });

  test(`${mode}: lost create response recovers with the identical key, payload and uploaded metadata`, async ({
    page,
  }) => {
    const creates: Record<string, unknown>[] = [];
    let uploads = 0;
    await editorApi(page, (name, input) => {
      if (name === "admin.uploadMedia") {
        uploads++;
        return ok({
          url: "https://example.test/song",
          mimeType: "audio/wav",
          fileSize: 46,
        });
      }
      if (name === "admin.createPost") {
        creates.push(input);
        return creates.length === 1 ? failure(503) : ok(42);
      }
    });
    const messages = dialogs(page);
    let form = await open(page, mode);
    await field(form).fill("EXACT_RECOVERY");
    await expect(field(form)).toHaveValue("EXACT_RECOVERY");
    await choose(page, form, "Аудио", "song.mp3", "audio/mpeg");
    await submit(form, mode).click();
    await expect.poll(() => messages.length).toBe(1);
    await expect(submit(form, mode)).toBeDisabled();
    const durable = await page.evaluate(
      (slot) =>
        new Promise<{
          editor: { draft: { text: string } };
          save: { creationIntent: { payloadJson: string } };
        }>((resolve, reject) => {
          const request = indexedDB.open("darcy-post-drafts", 1);
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction("drafts", "readonly");
            const read = tx.objectStore("drafts").get(`101:${slot}`);
            read.onsuccess = () => resolve(read.result);
            tx.oncomplete = () => db.close();
            tx.onerror = () => reject(tx.error);
          };
          request.onerror = () => reject(request.error);
        }),
      mode === "full" ? "full:new" : "quick:new:feed",
    );
    expect(JSON.parse(durable.save.creationIntent.payloadJson).text).toBe(
      "EXACT_RECOVERY",
    );
    expect(durable.editor.draft.text).toBe("EXACT_RECOVERY");
    await page.reload({ waitUntil: "domcontentloaded" });
    form = await open(page, mode);
    await form
      .getByRole("button", { name: "Восстановить черновик", exact: true })
      .click();
    await expect(field(form)).toHaveValue("EXACT_RECOVERY");
    await expect(submit(form, mode)).toBeDisabled();
    await expect(
      form.getByRole("button", { name: "Проверить сохранение", exact: true }),
    ).toBeVisible();
    if (mode === "full") {
      await page.screenshot({ path: "/tmp/daryadarcy-recovery-mobile.png" });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.screenshot({ path: "/tmp/daryadarcy-recovery-desktop.png" });
      await page.setViewportSize({ width: 390, height: 844 });
    }
    expect(creates).toHaveLength(1);
    expect(uploads).toBe(1);
    await form
      .getByRole("button", { name: "Проверить сохранение", exact: true })
      .click();
    await expect(form).toHaveCount(0);
    expect(creates).toHaveLength(2);
    expect(creates[1]).toEqual(creates[0]);
    expect(creates[1].attachments).toEqual([
      {
        type: "audio",
        filename: "song.mp3",
        url: "https://example.test/song",
        mimeType: "audio/wav",
        fileSize: 46,
      },
    ]);
    expect(uploads).toBe(1);
    form = await open(page, mode);
    await expect(
      form.getByRole("button", { name: "Восстановить черновик", exact: true }),
    ).toHaveCount(0);
  });

  test(`${mode}: a definite rejection survives reload without reuploading its confirmed files`, async ({
    page,
  }) => {
    const creates: Record<string, unknown>[] = [];
    let uploads = 0;
    await editorApi(page, (name, input) => {
      if (name === "admin.uploadMedia") {
        uploads++;
        return ok({
          url: "https://example.test/file",
          mimeType: "text/plain",
          fileSize: 18,
        });
      }
      if (name === "admin.createPost") {
        creates.push(input);
        return creates.length === 1 ? failure(400) : ok(42);
      }
    });
    const messages = dialogs(page);
    let form = await open(page, mode);
    await field(form).fill("DEFINITE_REJECTION");
    await choose(page, form, "Документ", "kept.txt", "text/plain");
    await submit(form, mode).click();
    await expect.poll(() => messages.length).toBe(1);
    await saved(form);
    await page.reload({ waitUntil: "domcontentloaded" });
    form = await open(page, mode);
    await form
      .getByRole("button", { name: "Восстановить черновик", exact: true })
      .click();
    await submit(form, mode).click();
    await expect(form).toHaveCount(0);
    expect(creates[1]).toEqual(creates[0]);
    expect(uploads).toBe(1);
  });

  test(`${mode}: unknown attachment upload stays blocked after reload`, async ({
    page,
  }) => {
    let uploads = 0;
    let creates = 0;
    await editorApi(page, (name) => {
      if (name === "admin.uploadMedia") {
        uploads++;
        return failure(503);
      }
      if (name === "admin.createPost") creates++;
    });
    const messages = dialogs(page);
    let form = await open(page, mode);
    await field(form).fill("UNKNOWN_UPLOAD");
    await choose(page, form, "Документ", "uncertain.txt", "text/plain");
    await submit(form, mode).click();
    await expect.poll(() => messages.length).toBe(1);
    await page.reload({ waitUntil: "domcontentloaded" });
    form = await open(page, mode);
    await form
      .getByRole("button", { name: "Восстановить черновик", exact: true })
      .click();
    await expect(submit(form, mode)).toBeDisabled();
    await expect(
      form.getByText("uncertain.txt", { exact: true }),
    ).toBeVisible();
    await expect(
      form.getByRole("button", { name: "Проверить сохранение", exact: true }),
    ).toHaveCount(0);
    expect(uploads).toBe(1);
    expect(creates).toBe(0);
  });

  test(`${mode}: reload preserves an edit, attachment removal and unknown-update protection`, async ({
    page,
  }) => {
    const updates: Record<string, unknown>[] = [];
    await editorApi(page, (name, input) => {
      if (name === "admin.posts") return ok([existing]);
      if (name === "feed.listPaginated")
        return ok({ posts: [existing], nextCursor: null });
      if (name === "admin.updatePost") {
        updates.push(input);
        return failure(503);
      }
    });
    const messages = dialogs(page);
    let form = await open(page, mode, true);
    await field(form).fill("EDIT_AFTER_RELOAD");
    await form
      .getByRole("button", { name: "Удалить вложение old.pdf", exact: true })
      .click();
    await saved(form);
    await page.reload({ waitUntil: "domcontentloaded" });
    form = await open(page, mode, true);
    await form
      .getByRole("button", { name: "Восстановить черновик", exact: true })
      .click();
    await expect(field(form)).toHaveValue("EDIT_AFTER_RELOAD");
    await expect(form.getByText("old.pdf", { exact: true })).toHaveCount(0);
    await submit(form, mode, true).click();
    await expect.poll(() => messages.length).toBe(1);
    expect(updates[0]).toMatchObject({
      id: 7,
      text: "EDIT_AFTER_RELOAD",
      removedMediaIds: [9],
    });
    expect(updates[0]).not.toHaveProperty("videos");
    expect(updates[0]).not.toHaveProperty("sortOrder");
    await page.reload({ waitUntil: "domcontentloaded" });
    form = await open(page, mode, true);
    await form
      .getByRole("button", { name: "Восстановить черновик", exact: true })
      .click();
    await expect(submit(form, mode, true)).toBeDisabled();
    await expect(
      form.getByRole("button", { name: "Проверить сохранение", exact: true }),
    ).toHaveCount(0);
    expect(updates).toHaveLength(1);
  });
}

test("drafts belong to the authenticated account and return only to their original owner", async ({
  page,
}) => {
  await editorApi(page);
  dialogs(page);
  let form = await open(page, "full");
  await field(form).fill("OWNER_101_PRIVATE_DRAFT");
  await saved(form);
  const user = (id: number) => ({
    id,
    openId: `admin-${id}`,
    name: "Admin",
    email: `${id}@example.test`,
    role: "admin",
    lastSignedIn: "2026-10-04T10:00:00Z",
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user: user(202) } }),
  );
  form = await open(page, "full");
  await expect(
    form.getByRole("button", { name: "Восстановить черновик", exact: true }),
  ).toHaveCount(0);
  await expect(field(form)).toHaveValue("");
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user: user(101) } }),
  );
  form = await open(page, "full");
  await form
    .getByRole("button", { name: "Восстановить черновик", exact: true })
    .click();
  await expect(field(form)).toHaveValue("OWNER_101_PRIVATE_DRAFT");
});

test("another tab cannot overwrite the newer draft or send a stale creation", async ({
  page,
  context,
}) => {
  let creates = 0;
  await editorApi(page, (name) => {
    if (name === "admin.createPost") creates++;
  });
  dialogs(page);
  const first = await open(page, "full");
  await field(first).fill("FIRST_TAB");
  await saved(first);
  const secondPage = await context.newPage();
  await editorApi(secondPage);
  dialogs(secondPage);
  const second = await open(secondPage, "full");
  await second
    .getByRole("button", { name: "Восстановить черновик", exact: true })
    .click();
  await field(second).fill("NEWER_SECOND_TAB");
  await saved(second);
  await field(first).fill("STALE_FIRST_TAB");
  await expect(first.getByRole("alert")).toContainText("другой вкладке");
  await expect(submit(first, "full")).toBeDisabled();
  expect(creates).toBe(0);
  await secondPage.close();
});

test("failed local persistence blocks server writes and keeps input", async ({
  page,
}) => {
  let creates = 0;
  await editorApi(page, (name) => {
    if (name === "admin.createPost") creates++;
  });
  dialogs(page);
  const form = await open(page, "full");
  await field(form).fill("KEEP_ON_QUOTA_FAILURE");
  await saved(form);
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = () => {
      throw new DOMException("Storage full", "QuotaExceededError");
    };
  });
  await submit(form, "full").click();
  await expect(form.getByRole("alert")).toContainText(
    "Не удалось сохранить черновик",
  );
  await expect(field(form)).toHaveValue("KEEP_ON_QUOTA_FAILURE");
  expect(creates).toBe(0);
});

test("a corrupt draft is not overwritten or submitted and can be explicitly discarded", async ({
  page,
}) => {
  let creates = 0;
  await editorApi(page, (name) => {
    if (name === "admin.createPost") creates++;
  });
  dialogs(page);
  let form = await open(page, "full");
  await field(form).fill("PRESERVE_CORRUPT_COPY");
  await saved(form);
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("darcy-post-drafts", 1);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction("drafts", "readwrite");
          const store = tx.objectStore("drafts");
          const read = store.get("101:full:new");
          read.onsuccess = () =>
            store.put({ ...read.result, version: 99 }, "101:full:new");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
        request.onerror = () => reject(request.error);
      }),
  );
  form = await open(page, "full");
  await expect(form.getByRole("alert")).toContainText("повреждён");
  await expect(submit(form, "full")).toBeDisabled();
  await form
    .getByRole("button", {
      name: "Повторить сохранение черновика",
      exact: true,
    })
    .click();
  await expect(form.getByRole("alert")).toContainText("повреждён");
  expect(creates).toBe(0);
  await form
    .getByRole("button", {
      name: "Проверил список — удалить локальную копию",
      exact: true,
    })
    .click();
  await expect(form).toHaveCount(0);
  form = await open(page, "full");
  await expect(submit(form, "full")).toBeEnabled();
  await expect(field(form)).toHaveValue("");
});

test("a confirmed commit surviving local cleanup is finished without another server write", async ({
  page,
}) => {
  let creates = 0;
  await editorApi(page, (name) => {
    if (name === "admin.createPost") creates++;
  });
  const messages = dialogs(page);
  let form = await open(page, "quick");
  await field(form).fill("CONFIRMED_COMMIT");
  await saved(form);
  await page.evaluate(() => {
    IDBObjectStore.prototype.delete = () => {
      throw new DOMException("Unavailable", "UnknownError");
    };
  });
  await submit(form, "quick").click();
  await expect.poll(() => messages.length).toBe(1);
  expect(creates).toBe(1);
  form = await open(page, "quick");
  await form
    .getByRole("button", { name: "Восстановить черновик", exact: true })
    .click();
  await expect(
    form.getByText("Публикация №42 сохранена.", { exact: true }),
  ).toBeVisible();
  await expect(submit(form, "quick")).toBeDisabled();
  await form
    .getByRole("button", { name: "Завершить восстановление", exact: true })
    .click();
  await expect(form).toHaveCount(0);
  expect(creates).toBe(1);
});
