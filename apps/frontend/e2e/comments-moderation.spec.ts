import { expect, test, type Page } from "@playwright/test";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==",
  "base64",
);
const now = () => new Date().toISOString();
const privatePhoto = (input: Record<string, unknown>, index: number) => {
  const assetId = `3af23d8c-140f-454b-a123-${String(index).padStart(12, "0")}`;
  return {
    state: "ready",
    assetId,
    usage: "commentPhoto",
    filename: input.filename,
    mimeType: "image/webp",
    fileSize: 80,
    url: `/api/media/content-files/${assetId}`,
  };
};
const comment = (id = 11, userId = 101) => ({
  id,
  userId,
  postId: 1,
  parentId: null as number | null,
  text: id === 11 ? "OWN_COMMENT" : "FOREIGN_COMMENT",
  photos: [],
  authorName: "Автор",
  authorAvatarUrl: null,
  createdAt: now(),
  likeCount: 0,
  likedByMe: false,
});
const member = () => ({
  id: 201,
  email: "member@example.test",
  name: "Участница",
  role: "user",
  createdAt: now(),
  clubExpiresAt: null,
  blockedAt: null,
  blockedReason: null,
});
const report = () => ({
  id: 31,
  commentId: 12,
  reason: "Причина жалобы",
  createdAt: now(),
  commentText: "REPORTED_COMMENT",
  commentPhotos: [],
  postId: 1,
  authorUserId: 201,
  authorName: "Автор",
  reporterUserId: 202,
  reporterName: "Участница",
});
async function commentsApi(
  page: Page,
  answer?: Parameters<typeof editorApi>[1],
  role = "user",
) {
  await editorApi(page, async (name, input, route) => {
    const custom = await answer?.(name, input, route);
    if (custom !== undefined) return custom;
    if (name === "club.subscription")
      return ok({
        hasClubAccess: true,
        subscribed: true,
        expiresAt: "2027-01-01T00:00:00Z",
        cancelAtPeriodEnd: false,
        isOwner: role === "admin",
        monthlyPrice: "790",
      });
    if (name === "club.list")
      return ok({
        posts: [
          {
            id: 1,
            text: "DISCUSSION",
            tags: ["community"],
            target: "club",
            photos: [],
            media: [],
            createdAt: now(),
            publishedAt: now(),
            commentCount: 1,
            likeCount: 0,
          },
        ],
        nextCursor: null,
      });
    if (name === "club.comments") return ok([comment()]);
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: 101,
          openId: "test-member",
          name: "Участница",
          role,
          email: "member@example.test",
          lastSignedIn: now(),
        },
      },
    }),
  );
}
async function openComments(page: Page) {
  await gotoWithSession(page, "/club");
  await page.getByRole("button", { name: "Комьюнити", exact: true }).click();
  await expect(page.getByText("OWN_COMMENT", { exact: true })).toBeVisible();
}
async function choosePhotos(page: Page) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Фото (0/2)", exact: true }).click();
  await (
    await chooser
  ).setFiles(
    ["first.png", "second.png"].map((name) => ({
      name,
      mimeType: "image/png",
      buffer: png,
    })),
  );
}
function dialogs(page: Page) {
  const messages: string[] = [];
  page.on("dialog", async (dialog) => {
    if (dialog.type() === "alert") messages.push(dialog.message());
    if (dialog.type() === "prompt") await dialog.accept("Причина блокировки");
    else await dialog.accept();
  });
  return messages;
}

test("a partial private photo failure blocks the frozen comment until explicit discard refreshes the list", async ({
  page,
}) => {
  let uploads = 0;
  const sends: Record<string, unknown>[] = [];
  await commentsApi(page, (name, input) => {
    if (name === "club.uploadPrivateCommentPhoto")
      return ++uploads === 1 ? ok(privatePhoto(input, 1)) : failure(400);
    if (name === "club.addComment") {
      sends.push(input);
      return ok({ id: 13 });
    }
  });
  dialogs(page);
  await openComments(page);
  const field = page.getByPlaceholder("Написать комментарий...");
  await field.fill("KEEP_WITH_FIRST_PHOTO");
  await choosePhotos(page);
  await expect(page.locator('img[src^="blob:"]')).toHaveCount(2);
  expect(uploads).toBe(0);
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect.poll(() => uploads).toBe(2);
  await expect(
    page.getByRole("button", { name: "Отправить", exact: true }),
  ).toBeDisabled();
  await expect(field).toHaveValue("KEEP_WITH_FIRST_PHOTO");
  await expect(
    page.getByRole("button", { name: "Повторить отправку", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Отказаться от неподтверждённой отправки",
      exact: true,
    })
    .click();
  await expect(field).toHaveValue("");
  expect(sends).toEqual([]);
  await field.fill("FRESH_TEXT_ONLY");
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(field).toHaveValue("");
  expect(sends).toEqual([
    {
      postId: 1,
      text: "FRESH_TEXT_ONLY",
      parentId: null,
      photos: null,
    },
  ]);
  expect(uploads).toBe(2);
});

test("an unknown like cannot be repeated until a successful read, and a failed read keeps it blocked", async ({
  page,
}) => {
  let likes = 0;
  let failRead = false;
  await commentsApi(page, (name) => {
    if (name === "club.toggleCommentLike") {
      likes++;
      return failure(503);
    }
    if (name === "club.comments" && failRead) return failure(503);
  });
  await openComments(page);
  await page
    .getByRole("button", { name: "Поставить лайк комментарию", exact: true })
    .click();
  const like = page.getByRole("button", {
    name: "Поставить лайк комментарию",
    exact: true,
  });
  await expect(like).toBeDisabled();
  failRead = true;
  await page
    .getByRole("button", { name: "Обновить комментарии", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Обновить комментарии", exact: true }),
  ).toBeEnabled();
  await expect(like).toBeDisabled();
  failRead = false;
  await page
    .getByRole("button", { name: "Обновить комментарии", exact: true })
    .click();
  await expect(like).toBeEnabled();
  expect(likes).toBe(1);
});

test("a confirmed comment like and count survive a failed refresh", async ({
  page,
}) => {
  let written = false;
  await commentsApi(page, (name) => {
    if (name === "club.comments" && written) return failure(503);
    if (name === "club.toggleCommentLike") {
      written = true;
      return ok({ liked: true, likeCount: 8 });
    }
  });
  await openComments(page);
  await page
    .getByRole("button", { name: "Поставить лайк комментарию", exact: true })
    .click();
  const liked = page.getByRole("button", {
    name: "Убрать лайк комментария",
    exact: true,
  });
  await expect(liked).toHaveAttribute("aria-pressed", "true");
  await expect(liked).toContainText("8");
});

test("an unknown comment creation keeps its draft and cannot be unlocked by reading alone", async ({
  page,
}) => {
  const sends: Record<string, unknown>[] = [];
  await commentsApi(page, (name, input) => {
    if (name === "club.addComment") {
      sends.push(input);
      return failure(503);
    }
  });
  dialogs(page);
  await openComments(page);
  const field = page.getByPlaceholder("Написать комментарий...");
  await field.fill("UNKNOWN_COMMENT");
  await page.getByRole("button", { name: "Отправить", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Отправить", exact: true }),
  ).toBeDisabled();
  await expect(field).toHaveValue("UNKNOWN_COMMENT");
  await page
    .getByRole("button", { name: "Обновить комментарии", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Отправить", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", {
      name: "Отказаться от неподтверждённой отправки",
      exact: true,
    })
    .click();
  await expect(field).toHaveValue("");
  await expect(field).toBeEnabled();
  expect(sends).toHaveLength(1);
});

test("canceling an edit is disabled while the server is saving it", async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let edits = 0;
  await commentsApi(page, async (name) => {
    if (name === "club.updateComment") {
      edits++;
      await pending;
      return failure(400);
    }
  });
  await openComments(page);
  await page
    .getByRole("button", { name: "Действия с комментарием", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Действия с комментарием" })
    .getByRole("button", { name: "Редактировать", exact: true })
    .click();
  const field = page.locator("textarea").first();
  await field.fill("EDIT_DRAFT");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect.poll(() => edits).toBe(1);
  await expect(
    page.getByRole("button", { name: "Отмена", exact: true }),
  ).toBeDisabled();
  release();
  await expect(field).toBeEnabled();
  await expect(field).toHaveValue("EDIT_DRAFT");
});

test("two synchronous admin block clicks send one write", async ({ page }) => {
  let blocks = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await editorApi(page, async (name) => {
    if (name === "admin.members") return ok([member()]);
    if (name === "moderation.blockUser") {
      blocks++;
      await pending;
      return ok({ ok: true });
    }
  });
  dialogs(page);
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Участницы", exact: true }).click();
  const block = page.getByRole("button", {
    name: "Заблокировать",
    exact: true,
  });
  await block.evaluate((node: HTMLButtonElement) => {
    node.click();
    node.click();
  });
  await expect.poll(() => blocks).toBe(1);
  release();
});

test("an invalid grant response cannot be announced as a successful extension", async ({
  page,
}) => {
  await editorApi(page, (name) => {
    if (name === "admin.members") return ok([member()]);
    if (name === "admin.grantClub") return ok({ ok: true });
  });
  const messages = dialogs(page);
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Участницы", exact: true }).click();
  await page.getByRole("button", { name: "Выдать клуб", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "не подтверждён" }),
  ).toBeVisible();
  expect(
    messages.filter((message) => message.startsWith("Клуб продлён")),
  ).toEqual([]);
});

test("a moderator can use the report inbox without requesting owner-only admin data", async ({
  page,
}, testInfo) => {
  const ownerReads: string[] = [];
  await editorApi(page, (name) => {
    if (name.startsWith("admin.")) ownerReads.push(name);
    if (name === "moderation.listCommentReports") return ok([report()]);
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: 101,
          role: "moderator",
          openId: "test-moderator",
          name: "Модератор",
          email: "moderator@example.test",
          lastSignedIn: now(),
        },
      },
    }),
  );
  await gotoWithSession(page, "/admin");
  await expect(
    page.getByText("REPORTED_COMMENT", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Новый", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Участницы", exact: true }),
  ).toHaveCount(0);
  expect(ownerReads).toEqual([]);
  for (const width of [320, 390, 414]) {
    await page.setViewportSize({ width, height: 844 });
    for (const name of [
      "Закрыть",
      "Удалить комментарий",
      "Заблокировать автора",
    ]) {
      const button = page.getByRole("button", { name, exact: true });
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      await button.click({ trial: true });
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("moderation-390.png") });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: testInfo.outputPath("moderation-1440.png") });
});

for (const role of ["user", "moderator", "admin"]) {
  test(`${role}: comment menus expose only permitted actions`, async ({
    page,
  }) => {
    await commentsApi(
      page,
      (name) =>
        name === "club.comments"
          ? ok([comment(), comment(12, 201)])
          : undefined,
      role,
    );
    await openComments(page);
    await page
      .getByRole("button", { name: "Действия с комментарием", exact: true })
      .first()
      .click();
    let menu = page.getByRole("dialog", { name: "Действия с комментарием" });
    await expect(
      menu.getByRole("button", { name: "Редактировать", exact: true }),
    ).toBeVisible();
    await expect(
      menu.getByRole("button", { name: "Удалить", exact: true }),
    ).toBeVisible();
    await expect(
      menu.getByRole("button", { name: "Пожаловаться", exact: true }),
    ).toHaveCount(0);
    await menu.getByRole("button", { name: "Отмена", exact: true }).click();
    await page
      .getByRole("button", { name: "Действия с комментарием", exact: true })
      .nth(1)
      .click();
    menu = page.getByRole("dialog", { name: "Действия с комментарием" });
    await expect(
      menu.getByRole("button", { name: "Редактировать", exact: true }),
    ).toHaveCount(0);
    await expect(
      menu.getByRole("button", {
        name: role === "user" ? "Пожаловаться" : "Удалить",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      menu.getByRole("button", {
        name: role === "user" ? "Удалить" : "Пожаловаться",
        exact: true,
      }),
    ).toHaveCount(0);
  });
}

test("a reply with two confirmed photos is sent once and updates the loaded comment count", async ({
  page,
}) => {
  const rows = [comment()];
  const sends: Record<string, unknown>[] = [];
  let uploads = 0;
  await commentsApi(page, (name, input) => {
    if (name === "club.comments") return ok(rows);
    if (name === "club.uploadPrivateCommentPhoto")
      return ok(privatePhoto(input, ++uploads));
    if (name === "club.addComment") {
      sends.push(input);
      rows.push({
        ...comment(13),
        text: String(input.text),
        parentId: input.parentId as number,
      });
      return ok({ id: 13 });
    }
  });
  await openComments(page);
  await page.getByRole("button", { name: "Ответить", exact: true }).click();
  const field = page.getByPlaceholder("Ваш ответ...");
  await field.fill("TWO_PHOTO_REPLY");
  await choosePhotos(page);
  await expect(
    page.getByRole("button", { name: "Фото (2/2)", exact: true }),
  ).toBeDisabled();
  const send = page.getByRole("button", { name: "Отправить", exact: true });
  await expect(send).toBeEnabled();
  await send.evaluate((node: HTMLButtonElement) => {
    node.click();
    node.click();
  });
  await expect(
    page.getByText("TWO_PHOTO_REPLY", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("2 комментария", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Написать комментарий...")).toHaveValue(
    "",
  );
  expect(sends).toEqual([
    {
      postId: 1,
      text: "TWO_PHOTO_REPLY",
      parentId: 11,
      photos: [privatePhoto({}, 1).url, privatePhoto({}, 2).url],
      idempotencyKey: expect.any(String),
    },
  ]);
});

test("a rejected text edit retains the draft and leaves existing comment photos untouched", async ({
  page,
}) => {
  const row = { ...comment(), photos: ["https://example.test/existing.webp"] };
  const edits: Record<string, unknown>[] = [];
  await commentsApi(page, (name, input) => {
    if (name === "club.comments") return ok([row]);
    if (name === "club.updateComment") {
      edits.push(input);
      if (edits.length === 1) return failure(400);
      row.text = String(input.text);
      return ok({ ok: true });
    }
  });
  await openComments(page);
  await page
    .getByRole("button", { name: "Действия с комментарием", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Действия с комментарием" })
    .getByRole("button", { name: "Редактировать", exact: true })
    .click();
  const field = page.locator("textarea").first();
  await field.fill("SAVED_TEXT_EDIT");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Тестовая ошибка" }),
  ).toBeVisible();
  await expect(field).toHaveValue("SAVED_TEXT_EDIT");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  // The textarea already contains this text; wait for the confirmed edit UI.
  await expect(
    page.getByRole("button", { name: "Сохранить", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("SAVED_TEXT_EDIT", { exact: true }),
  ).toBeVisible();
  expect(edits).toEqual([
    { id: 11, text: "SAVED_TEXT_EDIT" },
    { id: 11, text: "SAVED_TEXT_EDIT" },
  ]);
  await expect(
    page.getByRole("button", { name: "Открыть фото", exact: true }),
  ).toBeVisible();
});

for (const status of [400, 503]) {
  test(`report dismissal ${status}: failure keeps the report and only a fresh read can release an unknown action`, async ({
    page,
  }) => {
    let writes = 0;
    let failRead = false;
    await editorApi(page, (name) => {
      if (name === "moderation.listCommentReports")
        return failRead ? failure(503) : ok([report()]);
      if (name === "moderation.dismissCommentReport") {
        writes++;
        return failure(status);
      }
    });
    await gotoWithSession(page, "/admin");
    await page.getByRole("button", { name: "Жалобы", exact: true }).click();
    const close = page.getByRole("button", { name: "Закрыть", exact: true });
    await close.click();
    await expect(
      page.getByRole("alert").filter({
        hasText: status === 400 ? "Тестовая ошибка" : "не подтверждён",
      }),
    ).toBeVisible();
    await expect(
      page.getByText("REPORTED_COMMENT", { exact: true }),
    ).toBeVisible();
    if (status === 400) await expect(close).toBeEnabled();
    else {
      await expect(close).toBeDisabled();
      failRead = true;
      await page
        .getByRole("button", { name: "Обновить список", exact: true })
        .click();
      await expect(
        page.getByRole("alert").filter({ hasText: "временно недоступен" }),
      ).toBeVisible();
      failRead = false;
      await page
        .getByRole("button", { name: "Обновить список", exact: true })
        .click();
      await expect(close).toBeEnabled();
    }
    expect(writes).toBe(1);
  });
}

test("a confirmed moderator deletion refreshes the inbox and affected comments", async ({
  page,
}) => {
  let rows = [report()];
  const writes: Record<string, unknown>[] = [];
  await editorApi(page, (name, input) => {
    if (name === "moderation.listCommentReports") return ok(rows);
    if (name === "moderation.deleteReportedComment") {
      writes.push(input);
      rows = [];
      return ok({ ok: true });
    }
  });
  dialogs(page);
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Жалобы", exact: true }).click();
  await page
    .getByRole("button", { name: "Удалить комментарий", exact: true })
    .click();
  await expect(page.getByText("Жалоб пока нет", { exact: true })).toBeVisible();
  expect(writes).toEqual([{ commentId: 12, reportId: 31 }]);
});

test("a revoked session cannot show a late successful grant or retain admin UI", async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let writes = 0;
  await editorApi(page, async (name) => {
    if (name === "admin.members") return ok([member()]);
    if (name === "admin.grantClub") {
      writes++;
      await pending;
      return ok({ ok: true, expiresAt: "2027-01-01T00:00:00Z" });
    }
  });
  const messages = dialogs(page);
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Участницы", exact: true }).click();
  await page.getByRole("button", { name: "Выдать клуб", exact: true }).click();
  await expect.poll(() => writes).toBe(1);
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({ json: { user: null } }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(
    page.getByRole("button", { name: "Выдать клуб", exact: true }),
  ).toHaveCount(0);
  release();
  await expect(page).toHaveURL(/\/login$/);
  expect(
    messages.filter((message) => message.startsWith("Клуб продлён")),
  ).toEqual([]);
});

const managedPost = () => ({
  id: 1,
  text: "MANAGED_POST",
  photos: [],
  media: [],
  tags: [],
  target: "feed",
  status: "published",
  published: true,
  richText: null,
  createdAt: now(),
  publishedAt: now(),
  scheduledAt: null,
  likeCount: 0,
  commentCount: 0,
});

for (const status of [400, 503]) {
  test(`quick tags preserve selection after ${status} and require inspection before retrying an unknown write`, async ({
    page,
  }) => {
    const writes: Record<string, unknown>[] = [];
    let accepted = false;
    await editorApi(page, (name, input) => {
      if (name === "feed.listPaginated")
        return ok({ posts: [managedPost()], nextCursor: null });
      if (name === "admin.posts") return ok([managedPost()]);
      if (name === "admin.updatePost") {
        writes.push(input);
        return accepted ? ok({ success: true }) : failure(status);
      }
    });
    await gotoWithSession(page, "/feed");
    await page
      .getByRole("button", { name: "Действия с постом", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Выбрать хештеги", exact: true })
      .click();
    const form = page.getByRole("dialog", { name: "Теги публикации" });
    await form.getByRole("button", { name: "Весна", exact: true }).click();
    const save = form.getByRole("button", { name: "Сохранить", exact: true });
    await save.evaluate((node: HTMLButtonElement) => {
      node.click();
      node.click();
    });
    await expect(form.getByRole("alert")).toBeVisible();
    expect(writes).toEqual([{ id: 1, tags: ["spring"] }]);
    if (status === 503) {
      await expect(save).toBeDisabled();
      await form
        .getByRole("button", { name: "Обновить публикации", exact: true })
        .click();
    }
    await expect(form.getByText("Выбрано: 1", { exact: true })).toBeVisible();
    await expect(save).toBeEnabled();
    accepted = true;
    await save.click();
    await expect(form).toHaveCount(0);
    expect(writes).toEqual([
      { id: 1, tags: ["spring"] },
      { id: 1, tags: ["spring"] },
    ]);
  });
}

test("a void post deletion response is not confirmed while the post still exists", async ({
  page,
}) => {
  let deletes = 0;
  let exists = true;
  await editorApi(page, (name) => {
    if (name === "feed.listPaginated")
      return ok({ posts: exists ? [managedPost()] : [], nextCursor: null });
    if (name === "admin.posts") return ok(exists ? [managedPost()] : []);
    if (name === "admin.deletePost") {
      deletes++;
      return ok(null);
    }
  });
  dialogs(page);
  await gotoWithSession(page, "/feed");
  await page
    .getByRole("button", { name: "Действия с постом", exact: true })
    .click();
  await page.getByRole("button", { name: "Удалить пост", exact: true }).click();
  const result = page.getByRole("dialog", {
    name: "Результат действия с публикацией",
  });
  await expect(result.getByRole("alert")).toContainText("не подтверждён");
  await expect(page.getByText("MANAGED_POST", { exact: true })).toBeVisible();
  exists = false;
  await result
    .getByRole("button", { name: "Обновить публикации", exact: true })
    .click();
  await expect(
    result.getByRole("button", { name: "Обновить публикации", exact: true }),
  ).toHaveCount(0);
  await result.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(result).toHaveCount(0);
  await expect(page.getByText("MANAGED_POST", { exact: true })).toHaveCount(0);
  expect(deletes).toBe(1);
});

test("a confirmed club grant announces the returned expiry and refreshes members", async ({
  page,
}) => {
  let granted = false;
  const expiresAt = "2027-01-15T10:00:00Z";
  await editorApi(page, (name, input) => {
    if (name === "admin.members")
      return ok([{ ...member(), clubExpiresAt: granted ? expiresAt : null }]);
    if (name === "admin.grantClub") {
      expect(input).toEqual({ userId: 201 });
      granted = true;
      return ok({ ok: true, expiresAt });
    }
  });
  const messages = dialogs(page);
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Участницы", exact: true }).click();
  await page.getByRole("button", { name: "Выдать клуб", exact: true }).click();
  await expect
    .poll(() => messages)
    .toContain("Клуб продлён до 15 января 2027 г.");
  await expect(
    page.getByRole("button", { name: "Продлить клуб", exact: true }),
  ).toBeVisible();
});
