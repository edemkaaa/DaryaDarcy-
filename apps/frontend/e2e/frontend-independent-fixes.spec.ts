import { expect, test } from "@playwright/test";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";
import { mp4Fixture } from "../../../tests/helpers/media-fixtures";

test("calendar reads its own projection without fetching the stale post archive", async ({
  page,
}) => {
  let reads = 0;
  await page.clock.setFixedTime(new Date("2026-10-19T10:00:00Z"));
  await editorApi(page, (name) => {
    if (name === "admin.postsPage") {
      reads++;
      return ok({
        posts: [
          {
            id: 42,
            text: "CALENDAR_POST",
            photos: [],
            tags: [],
            media: [],
            hasVideo: false,
            tagCount: 0,
            status: "scheduled",
            published: false,
            target: "club",
            scheduledAt: "2026-10-20T10:00:00Z",
            createdAt: "2026-10-19T10:00:00Z",
            publishedAt: null,
          },
        ],
        nextCursor: null,
      });
    }
    if (name === "admin.postCalendar")
      return ok({
        days: [],
        upcoming: [
          {
            id: 42,
            text: "CALENDAR_POST",
            photos: [],
            tags: [],
            hasVideo: false,
            tagCount: 0,
            status: "scheduled",
            published: false,
            target: "club",
            scheduledAt: "2026-10-20T10:00:00Z",
            publishedAt: null,
            createdAt: "2026-10-19T10:00:00Z",
          },
        ],
      });
  });
  await gotoWithSession(page, "/admin");
  await expect(page.getByText("CALENDAR_POST", { exact: true })).toBeVisible();
  const before = reads;
  await page.clock.setFixedTime(new Date("2026-10-19T10:02:00Z"));
  await page.getByRole("button", { name: "Календарь", exact: true }).click();
  await expect(
    page.getByText("Отложенные публикации", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("CALENDAR_POST", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Следующий месяц", exact: true })
    .click();
  expect(reads).toBe(before);
  await page.getByRole("button", { name: "Посты", exact: true }).click();
  await expect.poll(() => reads).toBe(before + 1);
  await page.getByRole("button", { name: "Календарь", exact: true }).click();
  await expect(
    page.getByText("Отложенные публикации", { exact: true }),
  ).toBeVisible();
  expect(reads).toBe(before + 1);
});

test("calendar can retry its projection after a failed read", async ({
  page,
}) => {
  let unavailable = true;
  await editorApi(page, (name) =>
    name === "admin.postsPage"
      ? unavailable
        ? failure(503)
        : ok({ posts: [], nextCursor: null })
      : name === "admin.postCalendar"
        ? unavailable
          ? failure(503)
          : ok({ days: [], upcoming: [] })
        : undefined,
  );
  await gotoWithSession(page, "/admin");
  await expect(
    page.getByText("Не удалось загрузить список", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Календарь", exact: true }).click();
  await expect(
    page.getByText("Не удалось загрузить календарь публикаций", {
      exact: true,
    }),
  ).toBeVisible();
  unavailable = false;
  await page.getByRole("button", { name: "Повторить", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Следующий месяц", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
});

for (const width of [320, 1440]) {
  test(`YouTube proxy failure can be retried and playback is released at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let available = false;
    let requests = 0;
    await editorApi(page, (name) =>
      name === "videos.getById"
        ? ok({
            id: 42,
            title: "YOUTUBE_RETRY",
            videoUrl: null,
            youtubeId: "sq7pY1H_fYU",
            duration: null,
            views: null,
            publishedText: null,
          })
        : undefined,
    );
    await page.route("**/api/yt/**", (route) => {
      requests++;
      return available
        ? route.fulfill({ contentType: "video/mp4", body: mp4Fixture })
        : route.fulfill({
            status: 502,
            json: { error: "PRIVATE_PROXY_DETAILS" },
          });
    });
    await gotoWithSession(page, "/video/42");
    const notice = page
      .getByRole("alert")
      .filter({ hasText: "Не удалось воспроизвести видео" });
    await expect(notice).toBeVisible();
    await expect(page.getByText("PRIVATE_PROXY_DETAILS")).toHaveCount(0);
    await page.screenshot({
      path: test.info().outputPath("youtube-error.png"),
    });
    const before = requests;
    available = true;
    await page
      .getByRole("button", { name: "Повторить загрузку видео", exact: true })
      .click();
    await expect.poll(() => requests).toBeGreaterThan(before);
    await expect
      .poll(() =>
        page
          .locator("video")
          .evaluate((video) => (video as HTMLVideoElement).readyState),
      )
      .toBeGreaterThan(0);
    await expect(notice).toHaveCount(0);
    await page.screenshot({
      path: test.info().outputPath("youtube-recovered.png"),
    });
    expect(
      await page
        .locator("video")
        .evaluate((video) => (video as HTMLVideoElement).paused),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const handle = await page.locator("video").elementHandle();
    await page
      .getByRole("button", { name: "Вернуться назад", exact: true })
      .click();
    await expect(page).toHaveURL(/\/videos$/, { timeout: 20_000 });
    await expect
      .poll(() => handle!.evaluate((video) => video.getAttribute("src")))
      .toBe(null);
    await handle!.dispose();
  });
}

for (const status of [404, 413]) {
  test(`article upload HTTP ${status} explains the refusal and preserves its original operation`, async ({
    page,
  }) => {
    let writes = 0;
    let available = false;
    const uploads: Record<string, unknown>[] = [];
    const messages: string[] = [];
    page.on("dialog", async (dialog) => {
      messages.push(dialog.message());
      await dialog.accept();
    });
    await editorApi(page, (name, input) => {
      if (name === "admin.createArticle" || name === "admin.updateArticle")
        writes++;
      if (name === "admin.uploadPrivateContentFile") {
        uploads.push(input);
        return available
          ? ok({
              state: "ready",
              assetId: "3af23d8c-140f-454b-a123-123456789abc",
              usage: "articleDocument",
              filename: "kept.txt",
              mimeType: "text/plain",
              fileSize: 14,
              url: "/api/media/content-files/3af23d8c-140f-454b-a123-123456789abc",
            })
          : failure(status);
      }
      if (name === "admin.privateContentFileStatus")
        return available ? ok({ state: "notRecorded" }) : failure(status);
    });
    await gotoWithSession(page, "/admin");
    await page.getByRole("button", { name: "Статьи", exact: true }).click();
    await page
      .getByRole("button", { name: "Написать статью", exact: true })
      .click();
    await page
      .getByPlaceholder("Что посмотреть осенью...")
      .fill("KEPT_ARTICLE");
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
      buffer: Buffer.from("original bytes"),
    });
    await expect(
      page.getByPlaceholder("Текст ссылки, например Смотреть трейлер"),
    ).toHaveValue("kept.txt");
    await page
      .getByRole("button", { name: "Опубликовать", exact: true })
      .click();
    const message =
      status === 404
        ? "Загрузка файлов сейчас недоступна"
        : "ограничения размера";
    const notice = page
      .locator("[data-background-notice]")
      .getByRole("status")
      .filter({ hasText: message });
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("Исходные файлы сохранены");
    expect(messages.join("\n")).toContain(message);
    expect(messages.join("\n")).not.toContain("PRIVATE_");
    const original = uploads[0];
    await gotoWithSession(page, "/admin");
    await page.getByRole("button", { name: "Статьи", exact: true }).click();
    await page
      .getByRole("button", {
        name: "Восстановить создание статьи",
        exact: true,
      })
      .click();
    await expect(page.getByPlaceholder("Что посмотреть осенью...")).toHaveValue(
      "KEPT_ARTICLE",
    );
    await expect(
      page.getByPlaceholder("Текст ссылки, например Смотреть трейлер"),
    ).toHaveValue("kept.txt");
    await page
      .getByRole("button", { name: "Проверить сохранение", exact: true })
      .click();
    await expect(notice).toBeVisible();
    expect(uploads).toHaveLength(1);
    available = true;
    await page
      .getByRole("button", { name: "Проверить сохранение", exact: true })
      .click();
    await expect(
      page
        .locator("[data-background-notice]")
        .getByRole("status")
        .filter({ hasText: "Файлы подтверждены" }),
    ).toBeVisible();
    expect(uploads).toHaveLength(2);
    expect(uploads[1]).toEqual(original);
    expect(writes).toBe(0);
  });

  test(`HTTP ${status} keeps the upload draft and recovers with the original file/key`, async ({
    page,
  }) => {
    let available = false;
    let creates = 0;
    const uploads: Record<string, unknown>[] = [];
    const messages: string[] = [];
    page.on("dialog", async (dialog) => {
      messages.push(dialog.message());
      await dialog.accept();
    });
    await editorApi(page, (name, input) => {
      if (name === "admin.createPost") creates++;
      if (name === "admin.privateAttachmentStatus")
        return ok({ state: "notRecorded" });
      if (name === "admin.uploadPrivateAttachment") {
        uploads.push(input);
        return available
          ? ok({
              state: "ready",
              assetId: "3af23d8c-140f-454b-a123-123456789abc",
              type: "document",
              filename: "kept.txt",
              mimeType: "text/plain",
              fileSize: 14,
            })
          : failure(status);
      }
    });
    // Simulate the plain HTTP refusal produced by an upstream body parser.
    if (status === 413)
      await page.route(
        "**/api/trpc/admin.uploadPrivateAttachment*",
        async (route) => {
          if (available) return route.fallback();
          uploads.push(JSON.parse(route.request().postData()!)[0].json);
          return route.fulfill({
            status: 413,
            json: { error: "PRIVATE_BODY_PARSER_DETAILS" },
          });
        },
      );
    await gotoWithSession(page, "/admin");
    await page.getByRole("button", { name: "Новый пост", exact: true }).click();
    const form = page.getByRole("dialog", { name: "Редактор публикации" });
    await expect(
      form.getByText("Черновик сохранён на этом устройстве", { exact: true }),
    ).toBeVisible();
    await form
      .getByPlaceholder("Текст поста… Enter — новый абзац")
      .fill("KEEP_ORIGINAL_DRAFT");
    const chooser = page.waitForEvent("filechooser");
    await form.getByRole("button", { name: "Документ", exact: true }).click();
    await (
      await chooser
    ).setFiles({
      name: "kept.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("original bytes"),
    });
    await expect(form.getByText("kept.txt", { exact: true })).toBeVisible();
    await form.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect
      .poll(() => messages.join("\n"))
      .toContain(
        status === 404
          ? "Загрузка файлов сейчас недоступна"
          : "ограничения размера",
      );
    expect(messages.join("\n")).toContain("сохранены в черновике");
    expect(messages.join("\n")).not.toContain("PRIVATE_");
    await expect(
      form.getByRole("button", { name: "Сохранить", exact: true }),
    ).toBeDisabled();
    expect(creates).toBe(0);
    const original = uploads[0];
    await gotoWithSession(page, "/admin");
    await page.getByRole("button", { name: "Новый пост", exact: true }).click();
    await form
      .getByRole("button", { name: "Восстановить черновик", exact: true })
      .click();
    await expect(
      form.getByPlaceholder("Текст поста… Enter — новый абзац"),
    ).toHaveValue("KEEP_ORIGINAL_DRAFT");
    await expect(form.getByText("kept.txt", { exact: true })).toBeVisible();
    expect(uploads).toHaveLength(1);
    available = true;
    await form
      .getByRole("button", { name: "Проверить сохранение", exact: true })
      .click();
    await expect.poll(() => uploads.length).toBe(2);
    expect(uploads[1]).toEqual(original);
    await expect(
      form.getByRole("button", { name: "Сохранить", exact: true }),
    ).toBeEnabled();
    expect(creates).toBe(0);
  });
}
