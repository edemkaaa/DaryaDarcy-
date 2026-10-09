import { test, expect, type Page } from "@playwright/test";
import { gotoWithSession } from "./layout-fixtures";
import { editorApi, ok, failure } from "./editor-fixtures";

test.setTimeout(45_000);

async function openQuickEditor(page: Page) {
  await gotoWithSession(page, "/feed");
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
        : ok({
            url: "https://example.test/audio.mp3",
            mediaId: 7,
            mimeType: "audio/mpeg",
            fileSize: 18,
          });
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
  await expect(
    page.getByRole("button", { name: "Опубликовать", exact: true }).first(),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Проверить сохранение", exact: true }),
  ).toBeVisible();
  expect(calls).toBe(1);
  expect(messages.join(" ")).not.toContain("PRIVATE_INTERNAL_DETAILS");
});

test("a pending final write cannot be abandoned; confirmed completion allows a fresh editor", async ({
  page,
}) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started = false;
  let calls = 0;
  await editorApi(page, async (name) => {
    if (name === "admin.createPost") {
      calls++;
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
  await expect(
    page.getByPlaceholder("Текст поста… Enter — новый абзац"),
  ).toHaveValue("OLD_TEXT");
  expect(calls).toBe(1);
  release();
  await expect(
    page.getByPlaceholder("Текст поста… Enter — новый абзац"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Новый$/ }).click();
  const field = page.getByPlaceholder("Текст поста… Enter — новый абзац");
  await field.fill("NEW_TEXT");
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
        : ok({
            url: "https://example.test/audio.mp3",
            mimeType: "audio/mpeg",
            fileSize: 18,
          });
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
  const form = page.getByRole("dialog", { name: "Редактор публикации" });
  // fill() can target a visible textarea before its inert recovery wrapper is
  // ready. Wait for the initial checkpoint before starting this edit.
  await expect(
    form.getByText("Черновик сохранён на этом устройстве", { exact: true }),
  ).toBeVisible();
  const field = page.getByPlaceholder("Текст поста… Enter — новый абзац");
  await field.fill("EDITED_PUBLISHED_POST");
  await expect(field).toHaveValue("EDITED_PUBLISHED_POST");
  await expect(
    form.getByText("Черновик сохранён на этом устройстве", { exact: true }),
  ).toBeVisible();
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
  expect(edits[0]).not.toHaveProperty("published");
  expect(edits[0]).not.toHaveProperty("status");
  expect(edits).toEqual([
    expect.objectContaining({
      id: 1,
      text: "EDITED_PUBLISHED_POST",
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
  await photoPostApi(page, 3);
  await gotoWithSession(page, "/post/1");
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

async function photoPostApi(page: Page, count: number) {
  const makePhotos = (length: number) =>
    Array.from(
      { length },
      (_, index) => `https://example.test/photo${index + 1}.png`,
    );
  let photos = makePhotos(count);
  await editorApi(page, (name) => {
    if (name === "feed.getById") return ok(contentPost({ photos }));
    if (name === "feed.listPaginated" || name === "club.list")
      return ok({
        posts: [
          contentPost({
            photos,
            target: name === "club.list" ? "club" : "feed",
          }),
        ],
        nextCursor: null,
      });
  });
  await page.route("https://example.test/photo*.png", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="beige"/></svg>',
    }),
  );
  return (nextCount: number) => {
    photos = makePhotos(nextCount);
  };
}

test("a photo scroll immediately followed by resize preserves the new selection", async ({
  page,
}) => {
  await photoPostApi(page, 3);
  await gotoWithSession(page, "/post/1");
  await page.locator('img[src="https://example.test/photo1.png"]').click();
  const viewer = page.getByRole("dialog", { name: "Просмотр фотографий" });
  const scroll = viewer.locator(".ui-scroll-horizontal");
  await expect(viewer.getByText("1 / 3", { exact: true })).toBeVisible();
  await scroll.evaluate(
    (node) =>
      new Promise<void>((resolve) => {
        node.addEventListener("scroll", () => resolve(), { once: true });
        node.scrollTo({ left: node.clientWidth * 2, behavior: "instant" });
      }),
  );
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(viewer.getByText("3 / 3", { exact: true })).toBeVisible();
  await expect(viewer.getByRole("img", { name: "Фото 3 из 3" })).toBeVisible();
  await expect
    .poll(() => scroll.evaluate((node) => node.scrollLeft))
    .toBe(1688);
});

for (const path of ["/post/1", "/feed", "/club"]) {
  test(`photo carousel dots, edges and resize work in ${path}`, async ({
    page,
  }) => {
    await photoPostApi(page, 10);
    await gotoWithSession(page, path);
    const carousel = page.getByRole("region", { name: "Фотографии поста" });
    const scroll = carousel.locator(".ui-scroll-horizontal");
    const dots = carousel.getByRole("img", { name: "Фото 1 из 10" });
    await expect(dots).toBeVisible();
    await expect(dots.locator("[aria-current=true]")).toHaveCount(1);
    await scroll.focus();
    await page.keyboard.press("End");
    await expect(carousel.getByText("10 / 10", { exact: true })).toBeVisible();
    await expect(
      carousel
        .getByRole("img", { name: "Фото 10 из 10" })
        .locator("[aria-current=true]"),
    ).toHaveCount(1);
    await page.keyboard.press("ArrowRight");
    await expect(carousel.getByText("10 / 10", { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(carousel.getByText("10 / 10", { exact: true })).toBeVisible();
    await expect
      .poll(() =>
        scroll.evaluate((node) =>
          Math.abs(node.scrollLeft - 9 * node.clientWidth),
        ),
      )
      .toBeLessThan(2);
    await page.keyboard.press("Home");
    await expect(
      carousel.getByRole("img", { name: "Фото 1 из 10" }),
    ).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(carousel.getByText("1 / 10", { exact: true })).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(
      carousel.getByRole("img", { name: "Фото 2 из 10" }),
    ).toBeVisible();
    await carousel
      .getByRole("button", { name: "Открыть фото 2 из 10" })
      .click();
    const viewer = page.getByRole("dialog", { name: "Просмотр фотографий" });
    await expect(
      viewer.getByRole("img", { name: "Фото 2 из 10" }),
    ).toBeVisible();
    const viewerScroll = viewer.locator(".ui-scroll-horizontal");
    await viewerScroll.focus();
    await page.keyboard.press("End");
    await expect(
      viewer.getByRole("img", { name: "Фото 10 из 10" }),
    ).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(viewer.getByText("10 / 10", { exact: true })).toBeVisible();
    for (const width of [1280, 320]) {
      await page.setViewportSize({ width, height: 568 });
      await expect(
        viewer.getByRole("img", { name: "Фото 10 из 10" }),
      ).toBeVisible();
      await expect
        .poll(() => viewerScroll.evaluate((node) => node.clientWidth))
        .toBe(width);
      await expect
        .poll(() => viewerScroll.evaluate((node) => node.scrollLeft))
        .toBe(9 * width);
    }
    await page.keyboard.press("Home");
    await expect(
      viewer.getByRole("img", { name: "Фото 1 из 10" }),
    ).toBeVisible();
    await viewer.getByRole("button", { name: "Закрыть фотографии" }).click();
    await expect(viewer).toHaveCount(0);
    await expect(
      carousel.getByRole("img", { name: "Фото 2 из 10" }),
    ).toBeVisible();
  });
}

test("a refreshed photo list clamps selection and removes empty indicators", async ({
  page,
}) => {
  const setPhotoCount = await photoPostApi(page, 12);
  await gotoWithSession(page, "/feed");
  const carousel = page.getByRole("region", { name: "Фотографии поста" });
  const scroll = carousel.locator(".ui-scroll-horizontal");
  await expect(carousel.getByText("1 / 12", { exact: true })).toBeVisible();
  await scroll.focus();
  await page.keyboard.press("End");
  await expect(carousel.getByText("12 / 12", { exact: true })).toBeVisible();
  const refresh = async () => {
    await page
      .locator(".ui-scroll:not(.ui-scroll-horizontal)")
      .filter({ has: carousel })
      .first()
      .evaluate((node) => {
        node.scrollTop = 0;
        node.dispatchEvent(
          new TouchEvent("touchstart", {
            bubbles: true,
            touches: [new Touch({ identifier: 1, target: node, clientY: 0 })],
          }),
        );
        node.dispatchEvent(
          new TouchEvent("touchend", {
            bubbles: true,
            changedTouches: [
              new Touch({ identifier: 1, target: node, clientY: 200 }),
            ],
          }),
        );
      });
  };
  setPhotoCount(10);
  await refresh();
  await expect(
    carousel.getByRole("img", { name: "Фото 10 из 10" }),
  ).toBeVisible();
  await expect
    .poll(() =>
      scroll.evaluate((node) =>
        Math.abs(node.scrollLeft - 9 * node.clientWidth),
      ),
    )
    .toBeLessThan(2);
  setPhotoCount(0);
  await refresh();
  await expect(carousel).toHaveCount(0);
  await expect(
    page.getByText("INTERACTION_TEST_POST", { exact: true }),
  ).toBeVisible();
});

for (const count of [0, 1, 11]) {
  test(`photo indicators handle ${count} photos without overflow`, async ({
    page,
  }) => {
    await photoPostApi(page, count);
    await gotoWithSession(page, "/post/1");
    await expect(
      page.getByText("INTERACTION_TEST_POST", { exact: true }),
    ).toBeVisible();
    if (count === 0) {
      await expect(
        page.locator('img[src^="https://example.test/photo"]'),
      ).toHaveCount(0);
    } else {
      await page.locator('img[src="https://example.test/photo1.png"]').click();
      const viewer = page.getByRole("dialog", { name: "Просмотр фотографий" });
      await expect(viewer).toBeVisible();
      await expect(
        viewer.getByRole("img", { name: /^Фото \d+ из/ }),
      ).toHaveCount(0);
      if (count > 1)
        await expect(
          viewer.getByText(`1 / ${count}`, { exact: true }),
        ).toBeVisible();
      else
        await expect(viewer.getByText("1 / 1", { exact: true })).toHaveCount(0);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

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
            publishedAt: new Date().toISOString(),
          }),
        ],
        nextCursor: null,
      });
    if (name === "club.uploadCommentPhoto") {
      uploads++;
      return failure();
    }
  });
  await gotoWithSession(page, "/club");
  await page.getByRole("button", { name: "Комьюнити", exact: true }).click();
  const field = page.getByPlaceholder("Написать комментарий...");
  await field.fill("UNSENT_COMMENT");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Фото (0/2)", exact: true }).click();
  await (
    await chooser
  ).setFiles({
    name: "test.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==",
      "base64",
    ),
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
