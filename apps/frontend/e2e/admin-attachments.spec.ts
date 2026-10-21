import { createHash } from "node:crypto";
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
function assetIdFor(input: Record<string, unknown>) {
  const hash = createHash("sha256")
    .update(`${input.type}:${input.filename}`)
    .digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}
function receipt(
  input: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) {
  return {
    state: "ready",
    assetId: assetIdFor(input),
    type: input.type,
    filename: input.filename,
    mimeType: input.mimeType,
    fileSize: Buffer.from(String(input.base64), "base64").length,
    ...extra,
  };
}
async function api(page: Page, answer?: Parameters<typeof editorApi>[1]) {
  await editorApi(page, async (name, input, route) => {
    const custom = await answer?.(name, input, route);
    if (custom !== undefined) return custom;
    if (name === "admin.privateAttachmentStatus")
      return ok({ state: "notRecorded" });
    if (name === "admin.uploadMedia")
      throw new Error("Unexpected public upload");
  });
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
  if (mode === "quick" && editing)
    await page
      .getByRole("button", { name: "Действия с постом", exact: true })
      .first()
      .click();
  await page
    .getByRole("button", {
      name: editing ? "Редактировать пост" : "Новый пост",
      exact: true,
    })
    .first()
    .click();
  await expect(editor(page)).toBeVisible();
  await expect(
    editor(page).getByText("Черновик сохранён на этом устройстве", {
      exact: true,
    }),
  ).toBeVisible();
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
  // The checkpoint notice can wrap onto another line and move the picker
  // between pointerdown and pointerup. Wait for this edit to be durable.
  await expect(
    form.getByText("Черновик сохранён на этом устройстве", { exact: true }),
  ).toBeVisible();
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
    if (name === "admin.uploadPrivateAttachment" || name === "admin.updatePost")
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
      }),
    },
  ]);
  expect(writes[0].input).not.toHaveProperty("videos");
  expect(writes[0].input).not.toHaveProperty("sortOrder");
  expect(writes[0].input).not.toHaveProperty("published");
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
    if (name === "admin.uploadPrivateAttachment") {
      writes.push({ name, input });
      return ok(receipt(input, { mimeType: "application/pdf" }));
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
    "admin.uploadPrivateAttachment",
    "admin.updatePost",
  ]);
  expect(writes[0].input).not.toHaveProperty("postId");
  expect(writes[1].input).toMatchObject({
    id: 1,
    text: "UPDATED_WITH_DOCUMENT",
    removedMediaIds: [7],
    privateAssetIds: [assetIdFor({ type: "document", filename: "new.pdf" })],
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
    if (name === "admin.uploadPrivateAttachment") {
      writes.push({ name, input });
      return ok(receipt(input, { mimeType: input.mimeType }));
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
    "admin.uploadPrivateAttachment",
    "admin.uploadPrivateAttachment",
    "admin.createPost",
  ]);
  expect(writes[2].input).toMatchObject({
    status: "published",
    published: true,
    privateAssetIds: [
      assetIdFor({ type: "audio", filename: "lesson.mp3" }),
      assetIdFor({ type: "document", filename: documentName }),
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
    if (name === "admin.uploadPrivateAttachment") {
      writes.push({ name, input });
      return input.filename === "second.mp3" && fail
        ? failure()
        : ok(receipt(input, { mimeType: input.mimeType }));
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
    "admin.uploadPrivateAttachment",
    "admin.uploadPrivateAttachment",
  ]);
  fail = false;
  await expect(
    form.getByRole("button", { name: "Сохранить", exact: true }),
  ).toBeDisabled();
  await form
    .getByRole("button", { name: "Проверить сохранение", exact: true })
    .click();
  await expect(
    form.getByRole("button", { name: "Сохранить", exact: true }),
  ).toBeEnabled();
  await form
    .getByPlaceholder("Текст поста… Enter — новый абзац")
    .fill("TEXT_SURVIVES_RETRY");
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
        privateAssetIds: expect.any(Array),
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
    if (name === "admin.uploadPrivateAttachment") {
      writes.push({ name, input });
      return ok(receipt(input, { mimeType: "audio/mpeg" }));
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
  await expect(
    form.getByRole("button", { name: "Сохранить", exact: true }),
  ).toBeDisabled();
  await expect(form.getByText("new.mp3", { exact: true })).toBeVisible();
  expect(writes.map((write) => write.name)).toEqual([
    "admin.uploadPrivateAttachment",
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
    if (name === "admin.uploadPrivateAttachment") {
      uploads++;
      await held;
      return ok(receipt(input, { mimeType: "audio/mpeg" }));
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
  await page.getByRole("button", { name: "Новый пост", exact: true }).click();
  await expect(
    form.getByText("Аудио и документы (0)", { exact: true }),
  ).toBeVisible();
  await expect(form.getByText("late.mp3", { exact: true })).toHaveCount(0);
  // Reopening starts draft recovery again; fill must not run inside the inert form.
  await expect(form.locator(".ui-scroll")).not.toHaveAttribute("inert", "");
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
      if (name === "admin.uploadPrivateAttachment") uploads++;
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
        message: "PDF, DOCX или TXT",
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
      if (name === "admin.uploadPrivateAttachment") {
        uploads.push(input);
        return ok(receipt(input, { mimeType: input.mimeType }));
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

for (const mode of ["full", "quick"] as const) {
  for (const editing of [false, true]) {
    test(`${mode} ${editing ? "update" : "create"} binds confirmed private assets after an explicit save retry`, async ({
      page,
    }) => {
      let uploads = 0;
      let fail = true;
      const writes: Record<string, unknown>[] = [];
      await api(page, (name, input) => {
        if (name === "admin.posts") return ok([post()]);
        if (name === "feed.listPaginated")
          return ok({ posts: [post()], nextCursor: null });
        if (name === "admin.uploadPrivateAttachment") {
          uploads++;
          return ok(
            receipt(input, {
              mimeType:
                input.type === "audio"
                  ? "audio/wav"
                  : "text/plain; charset=utf-8",
            }),
          );
        }
        if (name === (editing ? "admin.updatePost" : "admin.createPost")) {
          writes.push(input);
          return fail ? failure() : editing ? ok({ success: true }) : ok(42);
        }
      });
      const messages = alerts(page);
      const form = await open(page, mode, editing);
      await form
        .getByPlaceholder("Текст поста… Enter — новый абзац")
        .fill("SERVER_METADATA");
      await choose(page, form, "Аудио", "claimed.mp3", "audio/mpeg");
      await choose(
        page,
        form,
        "Документ",
        "notes.txt",
        "application/octet-stream",
      );
      const save = form
        .getByRole("button", {
          name: editing || mode === "full" ? "Сохранить" : "Опубликовать",
          exact: true,
        })
        .first();
      await save.click();
      await expect.poll(() => messages.length).toBe(1);
      fail = false;
      await save.click();
      await expect(form).toHaveCount(0);
      expect(uploads).toBe(2);
      expect(writes).toHaveLength(2);
      for (const input of writes) {
        expect(input.privateAssetIds).toEqual([
          assetIdFor({ type: "audio", filename: "claimed.mp3" }),
          assetIdFor({ type: "document", filename: "notes.txt" }),
        ]);
        expect(input).not.toHaveProperty("attachments");
      }
    });
  }
  test(`${mode} incomplete upload confirmation blocks saving and automatic replay`, async ({
    page,
  }) => {
    let uploads = 0;
    let saves = 0;
    await api(page, (name) => {
      if (name === "admin.uploadPrivateAttachment") {
        uploads++;
        return ok({ url: "https://example.test/incomplete" });
      }
      if (name === "admin.createPost" || name === "admin.updatePost") saves++;
    });
    const messages = alerts(page);
    const form = await open(page, mode);
    await form
      .getByPlaceholder("Текст поста… Enter — новый абзац")
      .fill("INCOMPLETE_METADATA");
    await choose(page, form, "Аудио", "claimed.mp3", "audio/mpeg");
    const save = form
      .getByRole("button", {
        name: mode === "full" ? "Сохранить" : "Опубликовать",
        exact: true,
      })
      .first();
    await save.click();
    await expect.poll(() => messages.length).toBe(1);
    await expect(save).toBeDisabled();
    expect(uploads).toBe(1);
    expect(saves).toBe(0);
    await expect(form).toBeVisible();
  });
}

for (const mode of ["full", "quick"] as const) {
  for (const removeVideo of [false, true]) {
    test(`${mode} edit ${removeVideo ? "explicitly removes the last video" : "preserves videos and order during a text edit"}`, async ({
      page,
    }) => {
      const current = { ...post(), sortOrder: 25 };
      const writes: Write[] = [];
      await api(page, (name, input) => {
        if (name === "admin.posts") return ok([current]);
        if (name === "feed.listPaginated")
          return ok({ posts: [current], nextCursor: null });
        if (
          name === "admin.uploadPrivateAttachment" ||
          name === "admin.updatePost"
        )
          writes.push({ name, input });
      });
      await page.route("https://example.test/**", (route) => route.abort());
      const form = await open(page, mode, true);
      await expect(
        form.getByText("existing.mp3", { exact: true }),
      ).toBeVisible();
      await expect(
        form.getByText("existing.pdf", { exact: true }),
      ).toBeVisible();
      if (removeVideo)
        await form
          .getByRole("button", { name: "Удалить видео 1", exact: true })
          .click();
      await form
        .getByPlaceholder("Текст поста… Enter — новый абзац")
        .fill("TEXT_ONLY_EDIT");
      await form
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      await expect(form).toHaveCount(0);
      expect(writes).toHaveLength(1);
      expect(writes[0].name).toBe("admin.updatePost");
      expect(writes[0].input).toMatchObject({ id: 1, text: "TEXT_ONLY_EDIT" });
      for (const field of [
        "sortOrder",
        "published",
        "status",
        "publishedAt",
        "scheduledAt",
        "attachments",
        "removedMediaIds",
      ])
        expect(writes[0].input).not.toHaveProperty(field);
      if (removeVideo) expect(writes[0].input.videos).toEqual([]);
      else expect(writes[0].input).not.toHaveProperty("videos");
    });
  }
  test(`${mode} editor shows a friendly attachment label without deriving it from URL`, async ({
    page,
  }) => {
    const current = {
      ...post(),
      media: post().media.map((item) => ({
        ...item,
        filename: null,
        url: `https://example.test/${item.type}/97b2a854-6f40-414d-a7b4-67e233031ee4`,
      })),
    };
    await api(page, (name) => {
      if (name === "admin.posts") return ok([current]);
      if (name === "feed.listPaginated")
        return ok({ posts: [current], nextCursor: null });
    });
    await page.route("https://example.test/**", (route) => route.abort());
    const form = await open(page, mode, true);
    await expect(
      form.getByRole("button", { name: "Удалить вложение Аудио", exact: true }),
    ).toBeVisible();
    await expect(
      form.getByRole("button", {
        name: "Удалить вложение Документ",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      form.getByText("97b2a854-6f40-414d-a7b4-67e233031ee4", { exact: true }),
    ).toHaveCount(0);
  });
  for (const mime of ["", "application/octet-stream"]) {
    test(`${mode} audio with ${mime || "empty"} MIME binds a server-confirmed private asset`, async ({
      page,
    }) => {
      const writes: Write[] = [];
      await api(page, (name, input) => {
        if (name === "admin.uploadPrivateAttachment") {
          writes.push({ name, input });
          return ok(receipt(input, { mimeType: "audio/wav" }));
        }
        if (name === "admin.createPost") writes.push({ name, input });
      });
      const form = await open(page, mode);
      await page.evaluate(
        (mime) =>
          Object.defineProperty(File.prototype, "type", {
            configurable: true,
            get() {
              return mime;
            },
          }),
        mime,
      );
      await choose(page, form, "Аудио", "recording.wav", "audio/wav");
      await expect(
        form.getByText("recording.wav", { exact: true }),
      ).toBeVisible();
      const submit =
        mode === "full"
          ? form.getByRole("button", { name: "Сохранить", exact: true })
          : form.getByLabel("Опубликовать", { exact: true });
      await submit.click();
      await expect(form).toHaveCount(0);
      expect(writes.map((write) => write.name)).toEqual([
        "admin.uploadPrivateAttachment",
        "admin.createPost",
      ]);
      expect(writes[1].input.privateAssetIds).toEqual([
        assetIdFor({ type: "audio", filename: "recording.wav" }),
      ]);
      expect(writes[1].input).not.toHaveProperty("attachments");
    });
  }
}
