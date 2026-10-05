import { test, expect, type Page, type Route } from "@playwright/test";
import { layoutApi } from "./layout-fixtures";

test.setTimeout(45_000);
const ok = (data: unknown) => ({ result: { data: { json: data } } });
const failure = (status = 400) => ({
  error: {
    json: {
      message:
        status === 400
          ? "Тестовая ошибка сохранения"
          : "PRIVATE_INTERNAL_DETAILS",
      code: -32603,
      data: {
        code: status === 400 ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR",
        httpStatus: status,
      },
    },
  },
});
async function editorApi(
  page: Page,
  answer?: (
    name: string,
    input: Record<string, unknown>,
    route: Route,
  ) => Promise<unknown> | unknown,
) {
  await layoutApi(page, true);
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: 101,
          openId: "test-admin",
          name: "Тест",
          email: "test@example.test",
          role: "admin",
          lastSignedIn: "2026-10-04T10:00:00Z",
        },
      },
    }),
  );
  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const names = url.pathname.split("/api/trpc/")[1].split(",");
    const encoded =
      route.request().postData() ?? url.searchParams.get("input") ?? "{}";
    const inputs = JSON.parse(encoded);
    const results = await Promise.all(
      names.map(async (name, index) => {
        const input = inputs[index]?.json ?? {};
        const custom = await answer?.(name, input, route);
        if (custom !== undefined) return custom;
        if (name === "feed.userInteractions")
          return ok({ likedIds: [], savedIds: [] });
        if (name === "feed.listPaginated" || name === "club.list")
          return ok({ posts: [], nextCursor: null });
        if (name === "admin.createPost" || name === "admin.createArticle")
          return ok(42);
        if (name === "admin.updatePost") return ok({ success: true });
        if (name === "admin.updateArticle") return ok({ ok: true });
        return ok([]);
      }),
    );
    await route
      .fulfill({
        json: url.searchParams.get("batch") === "1" ? results : results[0],
      })
      .catch(() => {});
  });
}
async function openQuickEditor(page: Page) {
  await page.goto("/feed");
  await page.getByRole("button", { name: "Новый пост", exact: true }).click();
  await expect(
    page.getByPlaceholder("Текст поста… Enter — новый абзац"),
  ).toBeVisible();
}

test("a failed save keeps editor text and an explicit retry sends one write", async ({
  page,
}) => {
  let calls = 0;
  let fail = true;
  await editorApi(page, (name) => {
    if (name === "admin.createPost") {
      calls++;
      return fail ? failure() : ok(42);
    }
  });
  await openQuickEditor(page);
  const field = page.getByPlaceholder("Текст поста… Enter — новый абзац");
  await field.fill("UNSAVED_EDITOR_TEXT");
  const messages: string[] = [];
  page.on("dialog", async (dialog) => {
    messages.push(dialog.message());
    await dialog.accept();
  });
  await page
    .getByRole("button", { name: "Опубликовать", exact: true })
    .first()
    .click();
  await expect.poll(() => messages.length).toBe(1);
  await expect(field).toHaveValue("UNSAVED_EDITOR_TEXT");
  expect(calls).toBe(1);
  fail = false;
  await page
    .getByRole("button", { name: "Опубликовать", exact: true })
    .first()
    .click();
  await expect(field).toHaveCount(0);
  expect(calls).toBe(2);
});

test("audio upload rejection leaves the post untouched and retry commits it once", async ({
  page,
}) => {
  const writes: { name: string; input: Record<string, unknown> }[] = [];
  let failUpload = true;
  await editorApi(page, (name, input) => {
    if (
      ["admin.createPost", "admin.updatePost", "admin.uploadMedia"].includes(
        name,
      )
    )
      writes.push({ name, input });
    if (name === "admin.uploadMedia")
      return failUpload
        ? failure()
        : ok({ url: "https://example.test/audio.mp3", mediaId: 7 });
  });
  await openQuickEditor(page);
  await page
    .getByPlaceholder("Текст поста… Enter — новый абзац")
    .fill("POST_WITH_AUDIO");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Аудио", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "test.mp3",
    mimeType: "audio/mpeg",
    buffer: Buffer.from("test audio"),
  });
  await expect(page.getByText("test.mp3", { exact: true })).toBeVisible();
  const messages: string[] = [];
  page.on("dialog", async (dialog) => {
    messages.push(dialog.message());
    await dialog.accept();
  });
  await page
    .getByRole("button", { name: "Опубликовать", exact: true })
    .first()
    .click();
  await expect.poll(() => messages.length).toBe(1);
  expect(writes.map((w) => w.name)).toEqual(["admin.uploadMedia"]);
  expect(writes[0].input).not.toHaveProperty("postId");
  await expect(
    page.getByPlaceholder("Текст поста… Enter — новый абзац"),
  ).toHaveValue("POST_WITH_AUDIO");
  failUpload = false;
  await page
    .getByRole("button", { name: "Опубликовать", exact: true })
    .first()
    .click();
  await expect(
    page.getByPlaceholder("Текст поста… Enter — новый абзац"),
  ).toHaveCount(0);
  expect(writes.filter((w) => w.name === "admin.createPost")).toHaveLength(1);
  expect(writes.at(-1)).toMatchObject({
    name: "admin.createPost",
    input: {
      status: "published",
      attachments: [expect.objectContaining({ filename: "test.mp3" })],
    },
  });
});

test("an unconfirmed save is never automatically repeated", async ({
  page,
}) => {
  let calls = 0;
  await editorApi(page, (name) => {
    if (name === "admin.createPost") {
      calls++;
      return failure(500);
    }
  });
  await openQuickEditor(page);
  await page
    .getByPlaceholder("Текст поста… Enter — новый абзац")
    .fill("UNCERTAIN_POST");
  const messages: string[] = [];
  page.on("dialog", async (dialog) => {
    messages.push(dialog.message());
    await dialog.accept();
  });
  await page
    .getByRole("button", { name: "Опубликовать", exact: true })
    .first()
    .click();
  await expect.poll(() => messages.length).toBe(1);
  await page
    .getByRole("button", { name: "Опубликовать", exact: true })
    .first()
    .click();
  await expect.poll(() => messages.length).toBe(2);
  expect(calls).toBe(1);
  expect(messages.join(" ")).not.toContain("PRIVATE_INTERNAL_DETAILS");
});

test("closing and reopening an editor ignores a late save response", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false;
  await editorApi(page, async (name) => {
    if (name === "admin.createPost") {
      started = true;
      await held;
      return ok(42);
    }
  });
  await page.goto("/admin");
  await page.getByRole("button", { name: /Новый$/ }).click();
  await page
    .getByPlaceholder("Текст поста… Enter — новый абзац")
    .fill("OLD_TEXT");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect.poll(() => started).toBe(true);
  page.on("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Закрыть редактор", exact: true })
    .click();
  await page.getByRole("button", { name: /Новый$/ }).click();
  const field = page.getByPlaceholder("Текст поста… Enter — новый абзац");
  await field.fill("NEW_TEXT");
  release();
  await expect(field).toHaveValue("NEW_TEXT");
  await expect(
    page.getByRole("button", { name: "Сохранить", exact: true }),
  ).toBeEnabled();
});

test("a video upload returning HTML 413 shows its size error and adds no video", async ({
  page,
}) => {
  await editorApi(page);
  await page.route("**/api/admin/upload-video?*", (route) =>
    route.fulfill({
      status: 413,
      contentType: "text/html",
      body: "<html>PRIVATE_DETAILS</html>",
    }),
  );
  await openQuickEditor(page);
  const messages: string[] = [];
  page.on("dialog", async (dialog) => {
    messages.push(dialog.message());
    await dialog.accept();
  });
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Выбрать видеофайл", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "test.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("test video"),
  });
  await expect.poll(() => messages.length).toBe(1);
  expect(messages[0]).toContain("слишком большое");
  expect(messages[0]).not.toMatch(/PRIVATE_DETAILS|already been read/);
  await expect(page.getByText("Видео (0)", { exact: true })).toBeVisible();
});

test("editing an unpublished article preserves its status", async ({
  page,
}) => {
  let submitted: Record<string, unknown> | null = null;
  await editorApi(page, (name, input) => {
    if (name === "admin.articles")
      return ok([
        {
          id: 7,
          title: "Скрытая статья",
          coverUrl: null,
          access: "club",
          published: false,
          sections: [{ type: "text", text: "Начальный текст" }],
        },
      ]);
    if (name === "admin.updateArticle") {
      submitted = input;
      return ok({ ok: true });
    }
  });
  await page.goto("/admin");
  await page.getByRole("button", { name: "Статьи", exact: true }).click();
  await page.getByRole("button", { name: "Править", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Статус: черновик", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect.poll(() => submitted).toMatchObject({ id: 7, published: false });
});

const contentPost = (extra: Record<string, unknown> = {}) => ({
  id: 1,
  text: "INTERACTION_TEST_POST",
  photos: [],
  tags: [],
  media: [],
  target: "feed",
  likeCount: 0,
  commentCount: 0,
  richText: null,
  createdAt: "2026-10-04T10:00:00Z",
  publishedAt: "2026-10-04T10:00:00Z",
  ...extra,
});

test("a rejected attachment upload cannot unpublish an existing post; retry saves it once", async ({
  page,
}) => {
  const post = contentPost({ status: "published", published: true });
  const edits: Record<string, unknown>[] = [];
  let failUpload = true;
  await editorApi(page, (name, input) => {
    if (name === "feed.listPaginated")
      return ok({ posts: [post], nextCursor: null });
    if (name === "admin.uploadMedia")
      return failUpload
        ? failure()
        : ok({ url: "https://example.test/audio.mp3" });
    if (name === "admin.updatePost") {
      edits.push(input);
      return ok({ success: true });
    }
  });
  await page.goto("/feed");
  await page
    .getByRole("button", { name: "Действия с постом", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Редактировать пост", exact: true })
    .click();
  const field = page.getByPlaceholder("Текст поста… Enter — новый абзац");
  await field.fill("EDITED_PUBLISHED_POST");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Аудио", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "test.mp3",
    mimeType: "audio/mpeg",
    buffer: Buffer.from("test audio"),
  });
  const messages: string[] = [];
  page.on("dialog", async (dialog) => {
    messages.push(dialog.message());
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect.poll(() => messages.length).toBe(1);
  expect(edits).toEqual([]);
  await expect(field).toHaveValue("EDITED_PUBLISHED_POST");
  failUpload = false;
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(field).toHaveCount(0);
  expect(edits).toEqual([
    expect.objectContaining({
      id: 1,
      text: "EDITED_PUBLISHED_POST",
      status: "published",
      published: true,
      attachments: [
        expect.objectContaining({ url: "https://example.test/audio.mp3" }),
      ],
    }),
  ]);
});

test("a failed like rolls back and requires a read before repeating an unconfirmed write", async ({
  page,
}) => {
  let calls = 0;
  await editorApi(page, (name) => {
    if (name === "feed.getById") return ok(contentPost());
    if (name === "feed.toggleLike") {
      calls++;
      return failure(500);
    }
  });
  await page.goto("/post/1");
  const like = page.getByRole("button", { name: "Нравится", exact: true });
  await expect(like).toBeEnabled();
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("alert").filter({ hasText: "Сервис временно недоступен" }),
  ).toBeVisible();
  expect(calls).toBe(1);
  await expect(like).toBeDisabled();
  await page
    .getByRole("button", { name: "Обновить отметки", exact: true })
    .click();
  await expect(like).toBeEnabled();
  expect(calls).toBe(1);
});

test("two synchronous like clicks send one mutation and confirmed count comes from the post", async ({
  page,
}) => {
  let calls = 0;
  let liked = false;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await editorApi(page, async (name) => {
    if (name === "feed.getById")
      return ok(contentPost({ likeCount: liked ? 1 : 0 }));
    if (name === "feed.userInteractions")
      return ok({ likedIds: liked ? [1] : [], savedIds: [] });
    if (name === "feed.toggleLike") {
      calls++;
      await held;
      liked = true;
      return ok(true);
    }
  });
  await page.goto("/post/1");
  const like = page.getByRole("button", { name: "Нравится", exact: true });
  await expect(like).toBeEnabled();
  await like.evaluate((node) => {
    (node as HTMLButtonElement).click();
    (node as HTMLButtonElement).click();
  });
  await expect.poll(() => calls).toBe(1);
  await expect(like).toBeDisabled();
  release();
  await expect(like).toBeEnabled();
  await expect(like).toHaveAttribute("aria-pressed", "true");
  await expect(like).toContainText("1");
  expect(calls).toBe(1);
});

test("an empty saved category does not show posts from the other category", async ({
  page,
}) => {
  await editorApi(page, (name) =>
    name === "feed.savedPosts"
      ? ok([contentPost({ target: "club" })])
      : undefined,
  );
  await page.goto("/profile");
  await expect(
    page.getByText("Здесь будут сохранённые посты из ленты", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Из клуба", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /INTERACTION_TEST_POST/ }),
  ).toBeVisible();
});

test("the photo viewer preserves the chosen photo when the viewport changes", async ({
  page,
}) => {
  const photos = [1, 2, 3].map(
    (index) => `https://example.test/photo${index}.png`,
  );
  await editorApi(page, (name) =>
    name === "feed.getById" ? ok(contentPost({ photos })) : undefined,
  );
  await page.route("https://example.test/photo*.png", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="beige"/></svg>',
    }),
  );
  await page.goto("/post/1");
  await page.locator('img[src="https://example.test/photo3.png"]').click();
  await expect(page.getByText("3 / 3", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByText("3 / 3", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".ui-scroll-horizontal")
        .last()
        .evaluate((node) => node.scrollLeft),
    )
    .toBe(750);
});

test("a rejected audio play does not display playing state", async ({
  page,
}) => {
  await editorApi(page, (name) =>
    name === "feed.getById"
      ? ok(
          contentPost({
            media: [
              {
                id: 1,
                type: "audio",
                url: "https://example.test/audio.mp3",
                filename: "test.mp3",
              },
            ],
          }),
        )
      : undefined,
  );
  await page.addInitScript(() => {
    HTMLMediaElement.prototype.play = () =>
      Promise.reject(new DOMException("Autoplay denied", "NotAllowedError"));
  });
  await page.route("https://example.test/audio.mp3", (route) =>
    route.fulfill({ contentType: "audio/mpeg", body: "test audio" }),
  );
  await page.goto("/post/1");
  await page
    .getByRole("button", { name: "Воспроизвести аудио", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Не удалось воспроизвести аудио" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Воспроизвести аудио", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Приостановить аудио", exact: true }),
  ).toHaveCount(0);
});

test("a failed comment photo upload keeps the text and reports its error", async ({
  page,
}) => {
  let uploads = 0;
  await editorApi(page, (name) => {
    if (name === "club.list")
      return ok({
        posts: [
          contentPost({
            target: "club",
            tags: ["community"],
            createdAt: new Date().toISOString(),
          }),
        ],
        nextCursor: null,
      });
    if (name === "club.uploadCommentPhoto") {
      uploads++;
      return failure();
    }
  });
  await page.goto("/club");
  const field = page.getByPlaceholder("Написать комментарий...");
  await field.fill("UNSENT_COMMENT");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Фото (0/2)", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "test.gif",
    mimeType: "image/gif",
    buffer: Buffer.from("GIF89a_test_image"),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "Тестовая ошибка сохранения" }),
  ).toBeVisible();
  await expect(field).toHaveValue("UNSENT_COMMENT");
  expect(uploads).toBe(1);
});

test("a failed article list offers retry instead of showing an empty list", async ({
  page,
}) => {
  let fail = true;
  await editorApi(page, (name) =>
    name === "admin.articles" ? (fail ? failure(500) : ok([])) : undefined,
  );
  await page.goto("/admin");
  await page.getByRole("button", { name: "Статьи", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Не удалось загрузить статьи" }),
  ).toBeVisible();
  await expect(
    page.getByText("Пока нет статей — напишите подборку, гид или «обо мне».", {
      exact: true,
    }),
  ).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(
    page.getByText("Пока нет статей — напишите подборку, гид или «обо мне».", {
      exact: true,
    }),
  ).toBeVisible();
});

test("shared image picker decoding errors are caught by its existing profile consumer", async ({
  page,
}) => {
  await editorApi(page);
  const uncaught: string[] = [];
  const messages: string[] = [];
  page.on("pageerror", (error) => uncaught.push(error.message));
  page.on("dialog", async (dialog) => {
    messages.push(dialog.message());
    await dialog.accept();
  });
  await page.goto("/profile");
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Выбрать фото профиля", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "corrupt.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("NOT_AN_IMAGE"),
  });
  await expect.poll(() => messages.length).toBe(1);
  expect(messages[0]).toContain("Не удалось прочитать фото");
  expect(uncaught).toEqual([]);
});

test("an expired session during an editor write closes private UI before any error dialog", async ({
  page,
}) => {
  let authenticated = true;
  const messages: string[] = [];
  await editorApi(page, (name) => {
    if (name === "admin.createPost") {
      authenticated = false;
      return failure(401);
    }
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: authenticated
          ? {
              id: 101,
              openId: "test-admin",
              role: "admin",
              name: "Тест",
              email: "test@example.test",
              lastSignedIn: "2026-10-04T10:00:00Z",
            }
          : null,
      },
    }),
  );
  page.on("dialog", async (dialog) => {
    messages.push(dialog.message());
    await dialog.accept();
  });
  await page.goto("/admin");
  await page.getByRole("button", { name: /Новый$/ }).click();
  await page
    .getByPlaceholder("Текст поста… Enter — новый абзац")
    .fill("PRIVATE_TEST_DRAFT");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Войти", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByPlaceholder("Текст поста… Enter — новый абзац"),
  ).toHaveCount(0);
  expect(messages).toEqual([]);
});
