import { expect, test } from "@playwright/test";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession, layoutApi } from "./layout-fixtures";

// Run against a local build with NEXT_PUBLIC_PRIVATE_LIBRARY_FILES_ENABLED=true.
const entry = (material: string, key = "holly", mimeType = "image/webp") => ({
  fileKey: key,
  sortOrder: 0,
  revision: 1,
  filename: mimeType === "image/webp" ? "holly.webp" : "recipes.pdf",
  mimeType,
  fileSize: 123,
  url: `/api/media/library-files/${material}/${key}`,
});
const pixel = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=",
  "base64",
);

test.describe("private library delivery", () => {
  test.skip(
    process.env.NEXT_PUBLIC_PRIVATE_LIBRARY_FILES_ENABLED !== "true",
    "Requires a build with the private-library switch enabled.",
  );
  test("private patterns use protected media and close the viewer on logout", async ({
    page,
  }) => {
    await editorApi(page);
    await page.route("**/api/library/materials/patterns/files", (route) =>
      route.fulfill({ json: { files: [entry("patterns")], nextCursor: null } }),
    );
    await page.route("**/api/media/library-files/patterns/holly", (route) =>
      route.fulfill({ contentType: "image/png", body: pixel }),
    );
    await gotoWithSession(page, "/library/patterns");
    const pattern = page.getByRole("button", {
      name: "Открыть выкройку: Остролист",
      exact: true,
    });
    await expect(pattern).toBeVisible();
    await expect(pattern.locator("img")).toHaveAttribute(
      "src",
      "/api/media/library-files/patterns/holly",
    );
    await pattern.click();
    await expect(
      page.getByRole("dialog", { name: "Остролист", exact: true }),
    ).toBeVisible();
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({ json: { user: null } }),
    );
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(
      page.getByRole("dialog", { name: "Остролист", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("привилегия участниц Клуба Darcy", { exact: true }),
    ).toBeVisible();
  });

  test("guests request neither the list nor original pattern images", async ({
    page,
  }) => {
    await layoutApi(page);
    await page.route("**/api/auth/me", (route) =>
      route.fulfill({ json: { user: null } }),
    );
    const requests: string[] = [];
    page.on("request", (request) => {
      if (
        /\/api\/(library\/materials|media\/library-files)/.test(
          request.url(),
        ) ||
        /18c14e47537e|958b97c139fc|ded750bddbeb|9b32f7b0c8f1/.test(
          request.url(),
        )
      )
        requests.push(request.url());
    });
    await gotoWithSession(page, "/library/patterns");
    await expect(
      page.getByText("привилегия участниц Клуба Darcy", { exact: true }),
    ).toBeVisible();
    expect(requests).toEqual([]);
  });

  test("a failed private list has retry and never opens Yandex as a fallback", async ({
    page,
  }) => {
    await editorApi(page);
    let ready = false;
    await page.route("**/api/library/materials/recipes/files", (route) =>
      ready
        ? route.fulfill({
            json: {
              files: [
                entry("recipes", "book", "application/pdf"),
                {
                  ...entry("recipes", "extra", "application/pdf"),
                  filename: `${"longfilename".repeat(14)}.pdf`,
                },
              ],
              nextCursor: null,
            },
          })
        : route.fulfill({ status: 404, json: { error: "Unavailable" } }),
    );
    await gotoWithSession(page, "/library");
    await page
      .getByRole("button", {
        name: "Открыть материал: Сборник рецептов",
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Сборник рецептов",
      exact: true,
    });
    await expect(dialog.getByRole("alert")).toContainText(
      "Материал сейчас недоступен",
    );
    expect(page.context().pages()).toHaveLength(1);
    await expect(dialog.locator("a")).toHaveCount(0);
    ready = true;
    await dialog
      .getByRole("button", { name: "Повторить", exact: true })
      .click();
    await expect(
      dialog.getByRole("link", { name: "Скачать: recipes.pdf", exact: true }),
    ).toHaveAttribute("href", "/api/media/library-files/recipes/book");
    await expect(dialog.getByRole("link")).toHaveCount(2);
    expect(
      await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    await page.screenshot({
      path: test.info().outputPath("library-files-mobile.png"),
    });
    await dialog.getByRole("button", { name: "Закрыть", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("Petersburg hides old links during access checks and closes on logout", async ({
    page,
  }) => {
    await editorApi(page);
    let status = 200;
    let release: (() => void) | undefined;
    let hold = false;
    await page.route(
      "**/api/library/materials/peterburg/files",
      async (route) => {
        if (hold) {
          hold = false;
          await new Promise<void>((resolve) => (release = resolve));
        }
        await route.fulfill(
          status === 200
            ? {
                json: {
                  files: [entry("peterburg", "guide", "application/pdf")],
                  nextCursor: null,
                },
              }
            : { status, json: { error: "Unavailable" } },
        );
      },
    );
    try {
      await gotoWithSession(page, "/library");
      await page
        .getByRole("button", {
          name: "Открыть материал: Гид по Петербургу",
          exact: true,
        })
        .click();
      const dialog = page.getByRole("dialog", {
        name: "Гид по Петербургу",
        exact: true,
      });
      await expect(dialog.getByRole("link")).toHaveAttribute(
        "href",
        "/api/media/library-files/peterburg/guide",
      );
      hold = true;
      await page.evaluate(() =>
        window.dispatchEvent(new Event("visibilitychange")),
      );
      await expect.poll(() => Boolean(release)).toBe(true);
      await expect(dialog.getByRole("link")).toHaveCount(0);
      status = 503;
      release?.();
      await expect(dialog.getByRole("alert")).toContainText(
        "Материал сейчас недоступен",
      );
      await expect(dialog.getByRole("link")).toHaveCount(0);
      expect(page.context().pages()).toHaveLength(1);

      status = 200;
      await dialog
        .getByRole("button", { name: "Повторить", exact: true })
        .click();
      await expect(dialog.getByRole("link")).toHaveCount(1);
      await page.route("**/api/auth/me", (route) =>
        route.fulfill({ json: { user: null } }),
      );
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await expect(dialog).toHaveCount(0);
    } finally {
      release?.();
    }
  });
});

for (const mode of ["full", "quick"] as const) {
  test(`${mode}: disabled uploads stay retryable and keep the selected file`, async ({
    page,
  }) => {
    await editorApi(page);
    let probes = 0;
    const writes: string[] = [],
      messages: string[] = [];
    page.on("dialog", async (dialog) => {
      messages.push(dialog.message());
      await dialog.accept();
    });
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        /admin\.(upload|createPost|updatePost)/.test(request.url())
      )
        writes.push(request.url());
    });
    await page.route("**/api/trpc/admin.privateAttachmentStatus**", (route) => {
      probes++;
      return route.fulfill({ status: 404, json: { error: "Unavailable" } });
    });
    await gotoWithSession(page, mode === "full" ? "/admin" : "/feed");
    await page
      .getByRole("button", {
        name: "Новый пост",
        exact: true,
      })
      .first()
      .click();
    const form = page.getByRole("dialog", {
      name: "Редактор публикации",
      exact: true,
    });
    await expect(form.getByText("Проверяем сохранённый черновик…")).toHaveCount(
      0,
    );
    await form
      .getByPlaceholder("Текст поста… Enter — новый абзац")
      .fill("READINESS_CHECK");
    const chooser = page.waitForEvent("filechooser");
    await form.getByRole("button", { name: "Документ", exact: true }).click();
    await (
      await chooser
    ).setFiles({
      name: "kept.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("kept bytes"),
    });
    const save = form
      .getByRole("button", {
        name: mode === "full" ? "Сохранить" : "Опубликовать",
        exact: true,
      })
      .first();
    for (let attempt = 1; attempt <= 2; attempt++) {
      await save.click();
      await expect.poll(() => messages.length).toBe(attempt);
      expect(messages.at(-1)).toContain("Загрузка файлов сейчас недоступна");
      await expect(save).toBeEnabled();
      await expect(form.getByText("kept.txt", { exact: true })).toBeVisible();
    }
    expect(probes).toBe(2);
    expect(writes).toEqual([]);
  });
}

test("article: an unavailable upload keeps the editor retryable without a pending creation", async ({
  page,
}) => {
  await editorApi(page);
  const writes: string[] = [],
    messages: string[] = [];
  page.on("dialog", async (dialog) => {
    messages.push(dialog.message());
    await dialog.accept();
  });
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      /admin\.(upload|createArticle|updateArticle)/.test(request.url())
    )
      writes.push(request.url());
  });
  await page.route("**/api/trpc/admin.privateContentFileStatus**", (route) =>
    route.fulfill({ status: 404, json: { error: "Unavailable" } }),
  );
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Статьи", exact: true }).click();
  await page
    .getByRole("button", { name: "Написать статью", exact: true })
    .click();
  await page
    .getByPlaceholder("Что посмотреть осенью...")
    .fill("ARTICLE_READINESS");
  await page
    .getByRole("button", { name: "Ссылка", exact: true })
    .first()
    .click();
  const chooser = page.waitForEvent("filechooser");
  await page
    .getByRole("button", { name: "Загрузить файл", exact: true })
    .click();
  await (
    await chooser
  ).setFiles({
    name: "kept.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("kept bytes"),
  });
  const save = page.getByRole("button", { name: "Опубликовать", exact: true });
  for (let attempt = 1; attempt <= 2; attempt++) {
    await save.click();
    await expect.poll(() => messages.length).toBe(attempt);
    expect(messages.at(-1)).toContain("Загрузка файлов сейчас недоступна");
    await expect(save).toBeEnabled();
    await expect(
      page.getByPlaceholder("Текст ссылки, например Смотреть трейлер"),
    ).toHaveValue("kept.txt");
  }
  expect(writes).toEqual([]);
});

test("comment: an unavailable photo upload keeps selection and allows another send", async ({
  page,
}) => {
  const now = new Date().toISOString();
  await editorApi(page, (name) => {
    if (name === "club.listByCategory")
      return ok({
        posts: [
          {
            id: 1,
            text: "DISCUSSION",
            tags: ["community"],
            target: "club",
            photos: [],
            media: [],
            createdAt: now,
            publishedAt: now,
            commentCount: 0,
            likeCount: 0,
          },
        ],
        nextCursor: null,
      });
  });
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      /club\.(upload|addComment)/.test(request.url())
    )
      writes.push(request.url());
  });
  await page.route("**/api/trpc/club.privateCommentPhotoStatus**", (route) =>
    route.fulfill({ status: 404, json: { error: "Unavailable" } }),
  );
  await gotoWithSession(page, "/club");
  await page.getByRole("button", { name: "Комьюнити", exact: true }).click();
  const field = page.getByPlaceholder("Написать комментарий...");
  await field.fill("COMMENT_READINESS");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Фото (0/2)", exact: true }).click();
  await (
    await chooser
  ).setFiles({ name: "kept.png", mimeType: "image/png", buffer: pixel });
  const send = page.getByRole("button", { name: "Отправить", exact: true });
  for (let attempt = 0; attempt < 2; attempt++) {
    await send.click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Загрузка файлов сейчас недоступна" }),
    ).toBeVisible();
    await expect(send).toBeEnabled();
    await expect(field).toHaveValue("COMMENT_READINESS");
    await expect(page.locator('img[src^="blob:"]')).toHaveCount(1);
  }
  expect(writes).toEqual([]);
});
