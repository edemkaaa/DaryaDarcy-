import { test, expect, type Page, type Locator } from "@playwright/test";
import { editorApi, ok, failure } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

test.setTimeout(45_000);
const post = () => ({
  id: 1,
  text: "EXISTING_POST_WITH_ATTACHMENTS",
  photos: [],
  videos: [],
  tags: [],
  target: "feed",
  status: "published",
  published: true,
  sortOrder: 0,
  scheduledAt: null,
  createdAt: "2026-10-04T10:00:00Z",
  publishedAt: "2026-10-04T10:00:00Z",
  richText: null,
  media: [
    {
      id: 7,
      type: "audio",
      url: "https://example.test/existing.mp3",
      filename: "existing.mp3",
      mimeType: "audio/mpeg",
    },
    {
      id: 8,
      type: "document",
      url: "https://example.test/existing.pdf",
      filename: "existing.pdf",
      mimeType: "application/pdf",
    },
    {
      id: 9,
      type: "video",
      url: "https://example.test/existing.mp4",
      filename: "existing.mp4",
      mimeType: "video/mp4",
    },
  ],
});
type Write = { name: string; input: Record<string, unknown> };
async function api(page: Page, answer?: Parameters<typeof editorApi>[1]) {
  await editorApi(page, answer);
  // Media availability is a separate acceptance check; decoration must not delay these editor checks.
  await page.route("https://s3.twcstorage.ru/**", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="200"><rect width="480" height="200" fill="beige"/></svg>',
    }),
  );
}
const editor = (page: Page) =>
  page.getByRole("dialog", { name: "Редактор публикации" });
async function open(
  page: Page,
  mode: "full" | "quick" = "full",
  editing = false,
) {
  await gotoWithSession(page, mode === "full" ? "/admin" : "/feed");
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
  return editor(page);
}
async function choose(
  page: Page,
  form: Locator,
  kind: "Аудио" | "Документ",
  name: string,
  mimeType: string,
  buffer = Buffer.from("fixture attachment"),
) {
  const chooser = page.waitForEvent("filechooser");
  await form.getByRole("button", { name: kind, exact: true }).click();
  await (await chooser).setFiles({ name, mimeType, buffer });
}
function alerts(page: Page) {
  const messages: string[] = [];
  page.on("dialog", async (dialog) => {
    messages.push(dialog.message());
    await dialog.accept();
  });
  return messages;
}

test("the full editor restores existing attachments without reuploading or removing them", async ({
  page,
}) => {
  const writes: Write[] = [];
  await api(page, (name, input) => {
    if (name === "admin.posts") return ok([post()]);
    if (name === "admin.uploadMedia" || name === "admin.updatePost")
      writes.push({ name, input });
  });
  const form = await open(page, "full", true);
  await expect(form.getByText("existing.mp3", { exact: true })).toBeVisible();
  await expect(form.getByText("existing.pdf", { exact: true })).toBeVisible();
  await expect(
    form.getByText("Аудио и документы (2)", { exact: true }),
  ).toBeVisible();
  await form.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(form).toHaveCount(0);
  expect(writes).toEqual([
    {
      name: "admin.updatePost",
      input: expect.objectContaining({
        id: 1,
        published: true,
        status: "published",
        videos: ["https://example.test/existing.mp4"],
      }),
    },
  ]);
  expect(writes[0].input).not.toHaveProperty("attachments");
  expect(writes[0].input).not.toHaveProperty("removedMediaIds");
});

test("removing and adding attachments commits once and the reopened editor reads the saved media", async ({
  page,
}) => {
  let current = post();
  const writes: Write[] = [];
  await api(page, (name, input) => {
    if (name === "admin.posts") return ok([current]);
    if (name === "admin.uploadMedia") {
      writes.push({ name, input });
      return ok({ url: "https://example.test/new.pdf" });
    }
    if (name === "admin.updatePost") {
      writes.push({ name, input });
      current = {
        ...current,
        text: String(input.text),
        media: [
          current.media[1],
          current.media[2],
          {
            id: 10,
            type: "document",
            filename: "new.pdf",
            mimeType: "application/pdf",
            url: "https://example.test/new.pdf",
          },
        ],
      };
    }
  });
  const form = await open(page, "full", true);
  await form
    .getByRole("button", { name: "Удалить вложение existing.mp3", exact: true })
    .click();
  await choose(page, form, "Документ", "new.pdf", "application/pdf");
  await form
    .getByPlaceholder("Текст поста… Enter — новый абзац")
    .fill("UPDATED_WITH_DOCUMENT");
  expect(writes).toEqual([]);
  await form.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(form).toHaveCount(0);
  expect(writes.map((write) => write.name)).toEqual([
    "admin.uploadMedia",
    "admin.updatePost",
  ]);
  expect(writes[0].input).not.toHaveProperty("postId");
  expect(writes[1].input).toMatchObject({
    id: 1,
    text: "UPDATED_WITH_DOCUMENT",
    published: true,
    status: "published",
    removedMediaIds: [7],
    attachments: [
      {
        type: "document",
        filename: "new.pdf",
        url: "https://example.test/new.pdf",
      },
    ],
  });
  await expect(
    page.getByText("UPDATED_WITH_DOCUMENT", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Редактировать пост", exact: true })
    .click();
  await expect(form.getByText("existing.pdf", { exact: true })).toBeVisible();
  await expect(form.getByText("new.pdf", { exact: true })).toBeVisible();
  await expect(form.getByText("existing.mp3", { exact: true })).toHaveCount(0);
});

test("an attachment-only full post previews filenames at mobile and desktop widths and then saves", async ({
  page,
}, testInfo) => {
  const writes: Write[] = [];
  await api(page, (name, input) => {
    if (name === "admin.uploadMedia") {
      writes.push({ name, input });
      return ok({ url: `https://example.test/${input.filename}` });
    }
    if (name === "admin.createPost") writes.push({ name, input });
  });
  const form = await open(page);
  const documentName =
    "Подробные материалы для работы с публикацией и вложениями.pdf";
  await choose(page, form, "Аудио", "lesson.mp3", "audio/mpeg");
  await choose(page, form, "Документ", documentName, "application/pdf");
  await form.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  await expect(form.getByText("Текст поста...", { exact: true })).toHaveCount(
    0,
  );
  const hiddenRemove = form
    .getByRole("button", { name: /^Удалить вложение / })
    .first();
  await hiddenRemove.evaluate((button) => button.focus());
  await expect(hiddenRemove).not.toBeFocused();
  await form.getByRole("button", { name: "Предпросмотр", exact: true }).focus();
  for (let step = 0; step < 8; step++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => document.activeElement?.closest("[inert]") != null,
      ),
    ).toBe(false);
  }
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(
      form.getByText("lesson.mp3", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      form.getByText(documentName, { exact: true }).first(),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`attachments-preview-${width}.png`),
    });
  }
  await form.getByRole("button", { name: "Редактор", exact: true }).click();
  await form.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(form).toHaveCount(0);
  expect(writes.map((write) => write.name)).toEqual([
    "admin.uploadMedia",
    "admin.uploadMedia",
    "admin.createPost",
  ]);
  expect(writes[2].input).toMatchObject({
    status: "published",
    published: true,
    attachments: [
      expect.objectContaining({ type: "audio" }),
      expect.objectContaining({ type: "document" }),
    ],
  });
});

test("partial upload failure retains files and reuses the confirmed upload on explicit retry", async ({
  page,
}) => {
  let fail = true;
  const writes: Write[] = [];
  await api(page, (name, input) => {
    if (name === "admin.posts") return ok([post()]);
    if (name === "admin.uploadMedia") {
      writes.push({ name, input });
      return input.filename === "second.mp3" && fail
        ? failure()
        : ok({ url: `https://example.test/${input.filename}` });
    }
    if (name === "admin.updatePost") writes.push({ name, input });
  });
  const messages = alerts(page);
  const form = await open(page, "full", true);
  await choose(page, form, "Аудио", "first.mp3", "audio/mpeg");
  await choose(page, form, "Аудио", "second.mp3", "audio/mpeg");
  await form.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect.poll(() => messages.length).toBe(1);
  await expect(form.getByText("first.mp3", { exact: true })).toBeVisible();
  await expect(form.getByText("second.mp3", { exact: true })).toBeVisible();
  expect(writes.map((write) => write.name)).toEqual([
    "admin.uploadMedia",
    "admin.uploadMedia",
  ]);
  await form
    .getByPlaceholder("Текст поста… Enter — новый абзац")
    .fill("TEXT_SURVIVES_RETRY");
  fail = false;
  await form.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(form).toHaveCount(0);
  expect(
    writes.filter((write) => write.input.filename === "first.mp3"),
  ).toHaveLength(1);
  expect(
    writes.filter((write) => write.input.filename === "second.mp3"),
  ).toHaveLength(2);
  expect(writes.filter((write) => write.name === "admin.updatePost")).toEqual([
    {
      name: "admin.updatePost",
      input: expect.objectContaining({
        text: "TEXT_SURVIVES_RETRY",
        published: true,
        attachments: expect.any(Array),
      }),
    },
  ]);
});

test("an unconfirmed full editor write is not repeated and keeps the attachment", async ({
  page,
}) => {
  const writes: Write[] = [];
  await api(page, (name, input) => {
    if (name === "admin.posts") return ok([post()]);
    if (name === "admin.uploadMedia") {
      writes.push({ name, input });
      return ok({ url: "https://example.test/new.mp3" });
    }
    if (name === "admin.updatePost") {
      writes.push({ name, input });
      return failure(500);
    }
  });
  const messages = alerts(page);
  const form = await open(page, "full", true);
  await choose(page, form, "Аудио", "new.mp3", "audio/mpeg");
  await form.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect.poll(() => messages.length).toBe(1);
  expect(messages[0]).toContain("не подтверждён");
  await form.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect.poll(() => messages.length).toBe(2);
  await expect(form.getByText("new.mp3", { exact: true })).toBeVisible();
  expect(writes.map((write) => write.name)).toEqual([
    "admin.uploadMedia",
    "admin.updatePost",
  ]);
});

test("closing during upload ignores a late result and resets attachments and preview for a new draft", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let uploads = 0;
  const creates: unknown[] = [];
  await api(page, async (name, input) => {
    if (name === "admin.uploadMedia") {
      uploads++;
      await held;
      return ok({ url: "https://example.test/late.mp3" });
    }
    if (name === "admin.createPost") creates.push(input.text);
  });
  alerts(page);
  const form = await open(page);
  await choose(page, form, "Аудио", "late.mp3", "audio/mpeg");
  await form.getByRole("button", { name: "Предпросмотр", exact: true }).click();
  await form.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect.poll(() => uploads).toBe(1);
  await form
    .getByRole("button", { name: "Закрыть редактор", exact: true })
    .click();
  await expect(form).toHaveCount(0);
  await page.getByRole("button", { name: "Новый", exact: true }).click();
  await expect(
    form.getByText("Аудио и документы (0)", { exact: true }),
  ).toBeVisible();
  await expect(form.getByText("late.mp3", { exact: true })).toHaveCount(0);
  await form
    .getByPlaceholder("Текст поста… Enter — новый абзац")
    .fill("NEW_DRAFT");
  release();
  await expect(
    form.getByPlaceholder("Текст поста… Enter — новый абзац"),
  ).toHaveValue("NEW_DRAFT");
  await form.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(form).toHaveCount(0);
  expect(creates).toEqual(["NEW_DRAFT"]);
});

for (const mode of ["full", "quick"] as const) {
  test(`${mode} attachment selection rejects empty, oversized and invalid documents before reading or uploading`, async ({
    page,
  }) => {
    let uploads = 0;
    await api(page, (name) => {
      if (name === "admin.uploadMedia") uploads++;
    });
    const messages = alerts(page);
    const form = await open(page, mode);
    await page.evaluate(() => {
      const read = FileReader.prototype.readAsDataURL;
      FileReader.prototype.readAsDataURL = function (blob) {
        document.documentElement.dataset.attachmentReads = "1";
        return read.call(this, blob);
      };
      const create = URL.createObjectURL;
      URL.createObjectURL = (blob) => {
        document.documentElement.dataset.attachmentUrls = "1";
        return create(blob);
      };
    });
    const cases = [
      {
        name: "empty.pdf",
        mime: "application/pdf",
        buffer: Buffer.alloc(0),
        message: "пуст",
      },
      {
        name: "huge.pdf",
        mime: "application/pdf",
        buffer: Buffer.alloc(32 * 1024 * 1024 + 1),
        message: "32 МБ",
      },
      {
        name: "invalid.exe",
        mime: "application/octet-stream",
        buffer: Buffer.from("invalid"),
        message: "PDF, DOC, DOCX или TXT",
      },
      {
        name: "invalid.pdf",
        mime: "text/html",
        buffer: Buffer.from("invalid"),
        message: "не соответствует",
      },
    ];
    for (const [index, item] of cases.entries()) {
      await choose(page, form, "Документ", item.name, item.mime, item.buffer);
      await expect.poll(() => messages.length).toBe(index + 1);
      expect(messages[index]).toContain(item.message);
    }
    await expect(
      form.getByText("Аудио и документы (0)", { exact: true }),
    ).toBeVisible();
    expect(uploads).toBe(0);
    expect(
      await page.evaluate(() => ({
        reads: document.documentElement.dataset.attachmentReads,
        urls: document.documentElement.dataset.attachmentUrls,
      })),
    ).toEqual({ reads: undefined, urls: undefined });
  });

  test(`${mode} infers MIME for files with missing or generic browser types`, async ({
    page,
  }, testInfo) => {
    const uploads: Record<string, unknown>[] = [];
    await api(page, (name, input) => {
      if (name === "admin.uploadMedia") {
        uploads.push(input);
        return ok({ url: `https://example.test/${input.filename}` });
      }
    });
    const form = await open(page, mode);
    await page.evaluate(() => {
      const type = Object.getOwnPropertyDescriptor(
        Blob.prototype,
        "type",
      )!.get!;
      Object.defineProperty(File.prototype, "type", {
        configurable: true,
        get() {
          return this.name === "mime-less.wav" ? "" : type.call(this);
        },
      });
    });
    await choose(page, form, "Аудио", "mime-less.wav", "audio/wav");
    await expect(
      form.getByText("mime-less.wav", { exact: true }),
    ).toBeVisible();
    await choose(page, form, "Документ", "generic.docx", "application/zip");
    await form
      .getByText("Аудио и документы (2)", { exact: true })
      .scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath(`attachments-field-${mode}.png`),
    });
    await form
      .getByRole("button", {
        name: mode === "full" ? "Сохранить" : "Опубликовать",
        exact: true,
      })
      .first()
      .click();
    await expect(form).toHaveCount(0);
    expect(uploads).toEqual([
      expect.objectContaining({
        filename: "mime-less.wav",
        mimeType: "audio/wav",
        type: "audio",
      }),
      expect.objectContaining({
        filename: "generic.docx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        type: "document",
      }),
    ]);
  });
}
