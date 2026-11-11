import { expect, test, type Page } from "@playwright/test";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const report = {
  id: 31,
  commentId: 12,
  reason: "Причина жалобы",
  createdAt: "2026-10-26T10:00:00Z",
  commentText: "REPORTED_COMMENT",
  commentPhotos: [],
  postId: 1,
  authorUserId: 201,
  authorName: "Автор",
  reporterUserId: 202,
  reporterName: "Участница",
};
/** Выбираем только действие блокировки автора, отдельно от удаления комментария и закрытия жалобы. */
const block = (page: Page) =>
  page.getByRole("button", { name: "Заблокировать автора", exact: true });

/** Разрешение кнопки и последующий серверный отказ управляются независимо, чтобы воспроизвести отзыв прав после чтения. */
async function fixture(page: Page, role: "admin" | "moderator", hint: unknown) {
  const state = {
    hint,
    denied: false,
    writes: [] as Record<string, unknown>[],
    reads: 0,
  };
  await editorApi(page, (name, input) => {
    if (name === "moderation.listCommentReports") {
      state.reads++;
      return ok([
        {
          ...report,
          ...(state.hint === undefined ? {} : { canBlockAuthor: state.hint }),
        },
      ]);
    }
    if (name === "moderation.blockUser") {
      state.writes.push(input);
      if (state.denied) return failure(403);
      state.hint = false;
      return ok({ ok: true });
    }
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: 101,
          openId: `test-${role}`,
          name: "Модерация",
          role,
          email: "moderation@example.test",
          lastSignedIn: "2026-10-26T10:00:00Z",
        },
      },
    }),
  );
  return state;
}
/** Открываем соответствующую роли очередь и ждём саму жалобу до действий. */
async function open(page: Page, role: "admin" | "moderator") {
  await gotoWithSession(page, "/admin");
  if (role === "admin")
    await page.getByRole("button", { name: "Жалобы", exact: true }).click();
  await expect(
    page.getByText("REPORTED_COMMENT", { exact: true }),
  ).toBeVisible();
}

/** Для обеих ролей проверяем строгое boolean-разрешение, защиту от двойного click и 403 без ложного успеха или повторной записи. */
for (const role of ["admin", "moderator"] as const) {
  for (const hint of [false, undefined, "true"] as const) {
    test(`${role}: hint ${String(hint)} (${typeof hint}) does not allow author blocking`, async ({
      page,
    }) => {
      const state = await fixture(page, role, hint);
      await open(page, role);
      await expect(block(page)).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Закрыть", exact: true }),
      ).toBeEnabled();
      await expect(
        page.getByRole("button", { name: "Удалить комментарий", exact: true }),
      ).toBeEnabled();
      expect(state.writes).toEqual([]);
    });
  }

  test(`${role}: an allowed block sends one write and hides the action after the refreshed denial hint`, async ({
    page,
  }) => {
    const state = await fixture(page, role, true);
    page.on("dialog", (dialog) => dialog.accept("Причина блокировки"));
    await open(page, role);
    await expect(block(page)).toBeEnabled();
    await block(page).evaluate((node: HTMLButtonElement) => {
      node.click();
      node.click();
    });
    await expect(block(page)).toHaveCount(0);
    expect(state.reads).toBe(2);
    expect(state.writes).toEqual([
      { userId: 201, reason: "Причина блокировки" },
    ]);
    await expect(
      page.getByText("REPORTED_COMMENT", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  });

  test(`${role}: a permission revoked after reading the hint shows 403 without a false success or automatic retry`, async ({
    page,
  }) => {
    const state = await fixture(page, role, true);
    page.on("dialog", (dialog) => dialog.accept("Причина блокировки"));
    await open(page, role);
    state.denied = true;
    await block(page).click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Нет доступа к этому действию." }),
    ).toBeVisible();
    await expect(
      page.getByText("REPORTED_COMMENT", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Обновить список", exact: true }),
    ).toHaveCount(0);
    expect(state.writes).toEqual([
      { userId: 201, reason: "Причина блокировки" },
    ]);
    // A denied write must not take the success path and refetch the inbox.
    expect(state.reads).toBe(1);
  });
}
