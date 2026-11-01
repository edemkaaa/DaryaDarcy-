import { expect, test, type Page } from "@playwright/test";
import type { CommentReportInboxRow } from "../src/shared/api/contract";
import { editorApi, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const report = {
  id: 31,
  commentId: 12,
  reason: "Причина жалобы",
  createdAt: new Date("2026-10-26T10:00:00Z"),
  commentText: "READABLE_REPORT",
  commentPhotos: null,
  postId: 1,
  authorUserId: 201,
  authorName: null,
  reporterUserId: 202,
  reporterName: null,
  canBlockAuthor: false,
} satisfies CommentReportInboxRow;

async function fixture(
  page: Page,
  role: "admin" | "moderator",
  response: unknown,
) {
  const state = { response, reads: 0, writes: [] as string[] };
  await editorApi(page, (name) => {
    if (name === "moderation.listCommentReports") {
      state.reads++;
      return ok(state.response);
    }
    if (name.startsWith("moderation.")) state.writes.push(name);
  });
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      json: {
        user: {
          id: 101,
          openId: `reports-${role}`,
          name: "Модерация",
          email: "moderation@example.test",
          role,
          profileRevision: 0,
          lastSignedIn: "2026-10-26T10:00:00Z",
        },
      },
    }),
  );
  await gotoWithSession(page, "/admin");
  if (role === "admin")
    await page.getByRole("button", { name: "Жалобы", exact: true }).click();
  return state;
}

for (const role of ["admin", "moderator"] as const) {
  for (const scenario of [
    { name: "null row", response: [null] },
    { name: "non-array inbox", response: { items: [] } },
    {
      name: "invalid comment text",
      response: [{ ...report, commentText: { private: "PRIVATE_PAYLOAD" } }],
    },
  ]) {
    test(`${role}: ${scenario.name} stays inside the inbox and explicit retry restores reports`, async ({
      page,
    }) => {
      const crashes: string[] = [];
      page.on("pageerror", (error) => crashes.push(error.message));
      const state = await fixture(page, role, scenario.response);
      const main = page.getByRole("main");
      const error = main.getByRole("alert");
      await expect(error).toContainText("Не удалось загрузить список");
      await expect(
        page.getByRole("heading", {
          name: role === "admin" ? "Админка" : "Модерация",
          exact: true,
        }),
      ).toBeVisible();
      if (role === "admin")
        await expect(
          page.getByRole("button", { name: "Участницы", exact: true }),
        ).toBeVisible();
      await expect(
        page.getByText("Жалоб пока нет", { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByText("Не удалось открыть страницу.", { exact: true }),
      ).toHaveCount(0);
      await expect(page.getByText("PRIVATE_PAYLOAD")).toHaveCount(0);
      expect(state.reads).toBe(1);

      await main
        .getByRole("button", { name: "Повторить", exact: true })
        .click();
      await expect.poll(() => state.reads).toBe(2);
      await expect(error).toContainText("Не удалось загрузить список");

      state.response = [report];
      await main
        .getByRole("button", { name: "Повторить", exact: true })
        .click();
      await expect(
        page.getByText("READABLE_REPORT", { exact: true }),
      ).toBeVisible();
      await expect(error).toHaveCount(0);
      await expect(main).toContainText("Автор: #201");
      await expect(main).toContainText("Жалоба от: #202");
      await expect(
        main.getByRole("button", { name: "Закрыть", exact: true }),
      ).toBeEnabled();
      await expect(
        main.getByRole("button", { name: "Удалить комментарий", exact: true }),
      ).toBeEnabled();
      await expect(
        main.getByRole("button", { name: "Заблокировать автора", exact: true }),
      ).toHaveCount(0);
      expect(state.reads).toBe(3);
      expect(state.writes).toEqual([]);
      expect(crashes).toEqual([]);
    });
  }

  test(`${role}: an empty report inbox is a successful read`, async ({
    page,
  }) => {
    const state = await fixture(page, role, []);
    await expect(
      page.getByText("Жалоб пока нет", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    expect(state.reads).toBe(1);
    expect(state.writes).toEqual([]);
  });
}
