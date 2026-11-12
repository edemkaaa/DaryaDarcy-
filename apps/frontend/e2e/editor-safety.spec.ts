import { test, expect, type Page } from "@playwright/test";
import { gotoWithSession } from "./layout-fixtures";
import { editorApi, ok, failure } from "./editor-fixtures";

test.setTimeout(45_000);

/** Открываем быстрый редактор из Ленты после готовности сессии; тесты ниже проверяют сохранение пользовательского ввода, а не только сетевые ответы. */
async function openQuickEditor(page: Page) {
  await gotoWithSession(page, "/feed");
  await page.getByRole("button", { name: "Новый пост", exact: true }).click();
  await expect(
    page.getByPlaceholder("Текст поста… Enter — новый абзац"),
  ).toBeVisible();
}

/** Отказ сохранения оставляет введённый текст; только явный повтор пользователя добавляет вторую попытку записи. */
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

/** До подтверждения загрузки вложения пост не создаётся; после проверки статуса успешная загрузка передаётся одной финальной записи. */
test("audio upload rejection leaves the post untouched and retry commits it once", async ({
  page,
}) => {
  const writes: { name: string; input: Record<string, unknown> }[] = [];
  let failUpload = true;
  await editorApi(page, (name, input) => {
    if (
      [
        "admin.createPost",
        "admin.updatePost",
        "admin.uploadPrivateAttachment",
      ].includes(name)
    )
      writes.push({ name, input });
    if (name === "admin.privateAttachmentStatus")
      return ok({ state: "notRecorded" });
    if (name === "admin.uploadPrivateAttachment")
      return failUpload
        ? failure()
        : ok({
            state: "ready",
            assetId: "00000000-0000-4000-8000-000000000001",
            type: "audio",
            filename: "test.mp3",
            mimeType: "audio/mpeg",
            fileSize: 10,
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
  expect(writes.map((w) => w.name)).toEqual(["admin.uploadPrivateAttachment"]);
  expect(writes[0].input).not.toHaveProperty("postId");
  await expect(
    page.getByPlaceholder("Текст поста… Enter — новый абзац"),
  ).toHaveValue("POST_WITH_AUDIO");
  failUpload = false;
  await page
    .getByRole("button", { name: "Проверить сохранение", exact: true })
    .click();
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
      privateAssetIds: ["00000000-0000-4000-8000-000000000001"],
    },
  });
});

/** Неоднозначный ответ финальной записи блокирует повтор публикации и предлагает чтение статуса вместо слепого повторного создания. */
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

/** Удерживаем ответ записи: закрытие не уничтожает ещё сохраняемый ввод, а подтверждение освобождает редактор для нового независимого черновика. */
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
  await page.getByRole("button", { name: /^Новый пост$/ }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Редактор публикации" })
      .locator(".ui-scroll"),
  ).not.toHaveAttribute("inert", "");
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
  await page.getByRole("button", { name: /^Новый пост$/ }).click();
  const field = page.getByPlaceholder("Текст поста… Enter — новый абзац");
  // A fresh editor is visible before its asynchronous draft recovery completes.
  await expect(
    page
      .getByRole("dialog", { name: "Редактор публикации" })
      .locator(".ui-scroll"),
  ).not.toHaveAttribute("inert", "");
  await field.fill("NEW_TEXT");
  await expect(field).toHaveValue("NEW_TEXT");
  await expect(
    page.getByRole("button", { name: "Сохранить", exact: true }),
  ).toBeEnabled();
});

/** Ответ прокси с HTML и превышением размера превращается в понятную ошибку, не расходует тело повторно и не запускает создание поста. */
test("a private video upload returning HTML 413 preserves its draft without creating a post", async ({
  page,
}) => {
  let writes = 0;
  await editorApi(page, (name) => {
    if (name === "admin.privateAttachmentStatus")
      return ok({ state: "notRecorded" });
    if (name === "admin.createPost") {
      writes++;
      return ok(42);
    }
  });
  await page.route("**/api/admin/private-video-uploads?*", (route) =>
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
  const form = page.getByRole("dialog");
  await expect(page.getByText("Видео (1)", { exact: true })).toBeVisible();
  await form
    .getByPlaceholder("Текст поста… Enter — новый абзац")
    .fill("UNSENT_VIDEO");
  await form.getByLabel("Опубликовать", { exact: true }).click();
  await expect.poll(() => messages.length).toBe(1);
  expect(messages[0]).toMatch(/слишком большое|ограничения размера/);
  expect(messages[0]).not.toMatch(/PRIVATE_DETAILS|already been read/);
  await expect(page.getByText("Видео (1)", { exact: true })).toBeVisible();
  await expect(
    form.getByPlaceholder("Текст поста… Enter — новый абзац"),
  ).toHaveValue("UNSENT_VIDEO");
  expect(writes).toBe(0);
});

/** Редактирование содержания черновика статьи сохраняет unpublished-состояние в отправленном запросе. */
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

/** Минимальная карточка для редактора, реакций и карусели; отдельные сценарии меняют только поля, влияющие на проверяемый переход. */
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

/** Проверяем атомарность редактирования опубликованного поста: отказ нового вложения не пишет частичные изменения и не переключает статус публикации. */
test("a rejected attachment upload cannot unpublish an existing post; retry saves it once", async ({
  page,
}) => {
  const post = contentPost({ status: "published", published: true });
  const edits: Record<string, unknown>[] = [];
  let failUpload = true;
  await editorApi(page, (name, input) => {
    if (name === "admin.postDetail") return ok(post);
    if (name === "feed.listPaginated")
      return ok({ posts: [post], nextCursor: null });
    if (name === "admin.privateAttachmentStatus")
      return ok({ state: "notRecorded" });
    if (name === "admin.uploadPrivateAttachment")
      return failUpload
        ? failure()
        : ok({
            state: "ready",
            assetId: "00000000-0000-4000-8000-000000000001",
            type: "audio",
            filename: "test.mp3",
            mimeType: "audio/mpeg",
            fileSize: 10,
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
  await page
    .getByRole("button", { name: "Проверить сохранение", exact: true })
    .click();
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(field).toHaveCount(0);
  expect(edits[0]).not.toHaveProperty("published");
  expect(edits[0]).not.toHaveProperty("status");
  expect(edits).toEqual([
    expect.objectContaining({
      id: 1,
      text: "EDITED_PUBLISHED_POST",
      privateAssetIds: ["00000000-0000-4000-8000-000000000001"],
    }),
  ]);
});

/** После неизвестного результата переключателя лайка откатываем локальную отметку; разрешение нового клика требует перечитать серверное состояние. */
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

/** Два синхронных клика обходят обычный интервал рендера: блокировка должна пропустить одну мутацию, а итоговый счётчик берётся из обновлённой карточки. */
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

/** Пустое сохранённое Ленты не подменяется клубными карточками; переключение категории открывает именно её результат. */
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

/** После смены ширины просмотрщик сохраняет индекс выбранного снимка и пересчитывает смещение, вместо возврата к первому фото. */
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

/** Один управляемый список фото обслуживает детальный экран, Ленту и Клуб; возвращённая функция меняет ответ следующего чтения без навигации. */
async function photoPostApi(page: Page, count: number) {
  /** Стабильные адреса позволяют проверить сохранение выбранного снимка при изменении числа фото, отдельно от скачивания изображений. */
  const makePhotos = (length: number) =>
    Array.from(
      { length },
      (_, index) => `https://example.test/photo${index + 1}.png`,
    );
  let photos = makePhotos(count);
  await editorApi(page, (name) => {
    if (name === "feed.getById") return ok(contentPost({ photos }));
    if (name === "feed.listPaginated" || name === "club.listByCategory")
      return ok({
        posts: [
          contentPost({
            photos,
            target: name === "club.listByCategory" ? "club" : "feed",
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

/** Смена ориентации сразу после scroll проверяет гонку между событием прокрутки и пересчётом геометрии: выигрывает новый выбранный снимок. */
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

/** Одинаковый контракт карусели проверяем на трёх потребителях: клавиатурные границы, resize и независимая позиция полноэкранного просмотра. */
for (const path of ["/post/1", "/feed", "/club"]) {
  test(`photo carousel position, edges and resize work in ${path}`, async ({
    page,
  }) => {
    await photoPostApi(page, 10);
    await gotoWithSession(page, path);
    const carousel = page.getByRole("region", { name: "Фотографии поста" });
    const scroll = carousel.locator(".ui-scroll-horizontal");
    const dots = carousel.getByRole("img", { name: "Фото 1 из 10" });
    if (path === "/club")
      await expect(carousel.getByText("1 / 10", { exact: true })).toBeVisible();
    else {
      await expect(dots).toBeVisible();
      await expect(dots.locator("[aria-current=true]")).toHaveCount(1);
    }
    await scroll.focus();
    await page.keyboard.press("End");
    await expect(carousel.getByText("10 / 10", { exact: true })).toBeVisible();
    if (path !== "/club")
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
    await expect(carousel.getByText("1 / 10", { exact: true })).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(carousel.getByText("1 / 10", { exact: true })).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(carousel.getByText("2 / 10", { exact: true })).toBeVisible();
    await carousel
      .getByRole("button", {
        name: path === "/club" ? "Открыть фото 2" : "Открыть фото 2 из 10",
        exact: true,
      })
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
      carousel.getByText("2 / 10", { exact: true }),
    ).toBeVisible();
  });
}

/** При сокращении серверного списка выбирается последний оставшийся снимок; при обнулении исчезает вся карусель, сохраняя текст поста. */
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
  /** Обновляем список через синтетический pull-to-refresh; это проверка обработчика, а не приёмка физического жеста на iPhone. */
  const refresh = async () => {
    await page
      .locator(".ui-scroll:not(.ui-scroll-horizontal)")
      .filter({ has: carousel })
      .first()
      .evaluate((node) => {
        node.scrollTop = 0;
        // Exercise refresh state with synthetic events. Mobile WebKit does not
        // expose a constructible Touch; this is not native gesture acceptance.
        node.dispatchEvent(
          Object.assign(new Event("touchstart", { bubbles: true }), {
            touches: [{ identifier: 1, target: node, clientY: 0 }],
          }),
        );
        node.dispatchEvent(
          Object.assign(new Event("touchend", { bubbles: true }), {
            changedTouches: [{ identifier: 1, target: node, clientY: 200 }],
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

/** Ноль, одиночный снимок и длинный набор проверяют отсутствие лишних индикаторов и горизонтального переполнения на крайних размерах списка. */
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

/** Имитируем отказ браузерного play(), а не декодирование настоящего аудио: отклонённый Promise должен оставить кнопку воспроизведения и видимую ошибку. */
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
                mimeType: "audio/mpeg",
                duration: null,
                posterUrl: null,
                fileSize: null,
                postId: 1,
                sortOrder: 0,
                createdAt: "2026-10-04T10:00:00Z",
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

/** Выбор файла ещё не начинает загрузку комментария; ошибка при отправке сохраняет его текст и показывает контролируемое сообщение. */
test("a failed comment photo upload keeps the text and reports its error", async ({
  page,
}) => {
  let uploads = 0;
  await editorApi(page, (name) => {
    if (name === "club.listByCategory")
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
    if (name === "club.uploadPrivateCommentPhoto") {
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
    page.getByRole("button", { name: "Фото (1/2)", exact: true }),
  ).toBeVisible();
  expect(uploads).toBe(0);
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Тестовая ошибка сохранения" }),
  ).toBeVisible();
  await expect(field).toHaveValue("UNSENT_COMMENT");
  expect(uploads).toBe(1);
});

/** Сбой чтения статей отличается от успешного пустого списка; пустое состояние появляется только после подтверждённого повтора. */
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

/** Повреждённые байты доходят до общего декодера; потребитель профиля перехватывает отказ без необработанной ошибки страницы. */
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

/** Подтверждённый 401 имеет приоритет над сообщением сохранения: закрываем приватный редактор без диалога, способного раскрыть прежний ввод. */
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
  await page.getByRole("button", { name: /^Новый пост$/ }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Редактор публикации" })
      .locator(".ui-scroll"),
  ).not.toHaveAttribute("inert", "");
  await page
    .getByPlaceholder("Текст поста… Enter — новый абзац")
    .fill("PRIVATE_TEST_DRAFT");
  await expect(
    page.getByPlaceholder("Текст поста… Enter — новый абзац"),
  ).toHaveValue("PRIVATE_TEST_DRAFT");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Войти", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByPlaceholder("Текст поста… Enter — новый абзац"),
  ).toHaveCount(0);
  expect(messages).toEqual([]);
});
