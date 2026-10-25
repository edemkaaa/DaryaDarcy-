import { expect, test } from "@playwright/test";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession, layoutApi } from "./layout-fixtures";
import { PUBLIC_CONTACT_EMAIL } from "../src/shared/config/contact";

const now = () => new Date().toISOString();
const post = (id: number) => ({
  id,
  text: `AUDIT_POST_${id}`,
  photos: [],
  media: [],
  tags: ["community"],
  target: "club",
  createdAt: now(),
  publishedAt: now(),
  likeCount: 0,
  commentCount: 21,
});

test("both public privacy pages expose the same support address", async ({
  request,
}) => {
  for (const path of ["/privacy", "/privacy.html"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain(PUBLIC_CONTACT_EMAIL);
    expect(html).not.toContain("daryadarcyapp@yandex.ru");
  }
});

for (const lostEdit of [false, true]) {
  test(`${lostEdit ? "lost" : "confirmed"} edits and first replies update a retained second comment page`, async ({
    page,
  }) => {
    let edited = false,
      replied = false;
    let editWrites = 0;
    const comment = (id: number) => ({
      id,
      postId: 1,
      parentId: null,
      userId: 101,
      text:
        id === 21 && edited ? "UPDATED_TAIL_COMMENT" : `AUDIT_COMMENT_${id}`,
      photos: [],
      authorName: "Test",
      authorAvatarUrl: null,
      createdAt: now(),
      likeCount: 0,
      likedByMe: false,
      replyCount: id === 21 && replied ? 1 : 0,
    });
    await editorApi(page, (name, input) => {
      if (name === "club.list")
        return ok({ posts: [post(1)], nextCursor: null });
      if (name === "club.updateComment") {
        edited = true;
        editWrites++;
        return lostEdit ? failure(503) : ok({ ok: true });
      }
      if (name === "club.addComment") {
        replied = true;
        return ok({ id: 200 });
      }
      if (name === "club.commentsPage")
        return ok({
          items: input.parentId
            ? [{ ...comment(200), text: "CONFIRMED_TAIL_REPLY", parentId: 21 }]
            : input.cursor
              ? [comment(21)]
              : Array.from({ length: 20 }, (_, i) => comment(i + 1)),
          nextCursor: input.parentId || input.cursor ? null : "tail",
          totalCount: replied ? 22 : 21,
        });
    });
    await gotoWithSession(page, "/club");
    await page
      .getByRole("button", { name: "Ещё комментарии", exact: true })
      .click();
    const row = page
      .getByText("AUDIT_COMMENT_21", { exact: true })
      .locator(
        "xpath=ancestor::div[.//button[@aria-label='Действия с комментарием']][1]",
      );
    await row.getByRole("button", { name: "Действия с комментарием" }).click();
    await page
      .getByRole("dialog", { name: "Действия с комментарием" })
      .getByRole("button", { name: "Редактировать", exact: true })
      .click();
    await page.getByRole("textbox").first().fill("UPDATED_TAIL_COMMENT");
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    if (lostEdit) {
      await page
        .getByRole("button", { name: "Обновить комментарии", exact: true })
        .click();
      await expect(
        page.getByRole("button", { name: "Отмена", exact: true }),
      ).toBeEnabled();
      await page.getByRole("button", { name: "Отмена", exact: true }).click();
    }
    // The textarea already contains the edited text while the request is pending.
    // Wait for editing to finish before inspecting the committed row and write count.
    await expect(
      page.getByRole("button", { name: "Сохранить", exact: true }),
    ).toHaveCount(0);
    const updated = page.getByText("UPDATED_TAIL_COMMENT", { exact: true });
    await expect(updated).toBeVisible();
    expect(editWrites).toBe(1);
    await updated
      .locator(
        "xpath=ancestor::div[.//button[@aria-label='Действия с комментарием']][1]",
      )
      .getByRole("button", { name: "Ответить", exact: true })
      .click();
    await page.getByPlaceholder("Ваш ответ...").fill("CONFIRMED_TAIL_REPLY");
    await page.getByRole("button", { name: "Отправить", exact: true }).click();
    await page
      .getByRole("button", { name: "Показать ответы (1)", exact: true })
      .click();
    await expect(
      page.getByText("CONFIRMED_TAIL_REPLY", { exact: true }),
    ).toBeVisible();
  });
}

test("copy protection is released when the retained Club screen is hidden", async ({
  page,
}) => {
  await layoutApi(page, true);
  const blocked = () =>
    page.evaluate(
      () =>
        !document.body.dispatchEvent(
          new Event("copy", { bubbles: true, cancelable: true }),
        ),
    );
  await gotoWithSession(page, "/shop");
  expect(await blocked()).toBe(false);
  await page
    .getByRole("navigation", { name: "Разделы", exact: true })
    .getByRole("link", { name: "Клуб", exact: true })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Разделы клуба" }),
  ).toBeVisible();
  await expect.poll(blocked).toBe(true);
  await page
    .getByRole("link", { name: "Открыть профиль", exact: true })
    .click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect.poll(blocked).toBe(false);
});

test("Club background refresh reads the head only and keeps numeric wire cursors", async ({
  page,
}) => {
  await page.clock.install();
  const reads: number[] = [];
  await editorApi(page, (name, input) => {
    if (name !== "club.list") return;
    const cursor = Number(input.cursor ?? 0);
    if (input.cursor !== undefined) expect(typeof input.cursor).toBe("number");
    reads.push(cursor);
    return ok({
      posts: Array.from({ length: 12 }, (_, i) => ({
        ...post(cursor + i + 1),
        tags: [],
      })),
      nextCursor: cursor === 0 ? 12 : null,
    });
  });
  await gotoWithSession(page, "/club");
  // The collection may already load the next page while measuring. Trigger
  // the remaining button without scrolling it into the load-more sentinel.
  await page.evaluate(() => {
    const button = [
      ...document.querySelectorAll<HTMLButtonElement>("button"),
    ].find((item) => item.textContent?.trim() === "Загрузить ещё");
    button?.click();
  });
  await expect.poll(() => reads.includes(12)).toBe(true);
  const tailReads = reads.filter((cursor) => cursor > 0).length;
  const headReads = reads.filter((cursor) => cursor === 0).length;
  await page.clock.fastForward(61_000);
  await expect
    .poll(() => reads.filter((cursor) => cursor === 0).length)
    .toBeGreaterThan(headReads);
  expect(reads.filter((cursor) => cursor > 0)).toHaveLength(tailReads);
});

test("moderation never offers to block the signed-in author", async ({
  page,
}) => {
  await editorApi(page, (name) =>
    name === "moderation.listCommentReports"
      ? ok([
          {
            id: 1,
            commentId: 1,
            authorUserId: 101,
            authorName: "Self",
            reporterUserId: 102,
            reporterName: "Other",
            commentText: "REPORTED_OWN_COMMENT",
            commentPhotos: [],
            postId: 1,
            reason: "Test",
            createdAt: now(),
          },
        ])
      : undefined,
  );
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: /Жалобы/ }).click();
  await expect(
    page.getByText("REPORTED_OWN_COMMENT", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Заблокировать автора", exact: true }),
  ).toHaveCount(0);
});

for (const committed of [false, true]) {
  test(`lost deletion of a second-page comment is inspected without repeating it, committed=${committed}`, async ({
    page,
  }) => {
    let removed = false,
      writes = 0;
    const comment = (id: number) => ({
      id,
      postId: 1,
      parentId: null,
      userId: 101,
      text: `DELETE_COMMENT_${id}`,
      photos: [],
      authorName: "Test",
      authorAvatarUrl: null,
      createdAt: now(),
      likeCount: 0,
      likedByMe: false,
      replyCount: 0,
    });
    await editorApi(page, (name, input) => {
      if (name === "club.list")
        return ok({
          posts: [{ ...post(1), commentCount: 22 }],
          nextCursor: null,
        });
      if (name === "club.deleteComment") {
        writes++;
        removed = committed;
        return failure(503);
      }
      if (name === "club.commentsPage")
        return ok({
          items: input.cursor
            ? removed
              ? [comment(22)]
              : [comment(21), comment(22)]
            : Array.from({ length: 20 }, (_, i) => comment(i + 1)),
          nextCursor: input.cursor ? null : "tail",
          totalCount: removed ? 21 : 22,
        });
    });
    await gotoWithSession(page, "/club");
    await page
      .getByRole("button", { name: "Ещё комментарии", exact: true })
      .click();
    const row = page
      .getByText("DELETE_COMMENT_21", { exact: true })
      .locator(
        "xpath=ancestor::div[.//button[@aria-label='Действия с комментарием']][1]",
      );
    await row.getByRole("button", { name: "Действия с комментарием" }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page
      .getByRole("dialog", { name: "Действия с комментарием" })
      .getByRole("button", { name: "Удалить", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Обновить комментарии", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Обновить комментарии", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("DELETE_COMMENT_21", { exact: true }),
    ).toHaveCount(committed ? 0 : 1);
    await expect(
      page.getByText("DELETE_COMMENT_22", { exact: true }),
    ).toBeVisible();
    expect(writes).toBe(1);
  });
}
