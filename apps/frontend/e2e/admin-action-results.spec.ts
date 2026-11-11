import { expect, test } from "@playwright/test";
import { editorApi, failure, ok } from "./editor-fixtures";
import { gotoWithSession } from "./layout-fixtures";

const article = {
  id: 7,
  title: "ARTICLE_TO_DELETE",
  coverUrl: null,
  access: "club",
  published: true,
  sections: [{ type: "text", text: "Текст" }],
};
/** Сравниваем настоящее исчезновение записи и ложный ACK удаления: последующее неуспешное чтение не должно снять блокировку. */
for (const confirmed of [false, true]) {
  test(`article deletion ${confirmed ? "confirms absence" : "rejects a false success and keeps blocked after a failed inspection"}`, async ({
    page,
  }) => {
    let exists = true;
    let failRead = false;
    let writes = 0;
    await editorApi(page, (name) => {
      if (name === "admin.articles")
        return failRead ? failure(503) : ok(exists ? [article] : []);
      if (name === "admin.deleteArticle") {
        writes++;
        if (confirmed) exists = false;
        return ok({ ok: true });
      }
    });
    page.on("dialog", (dialog) => dialog.accept());
    await gotoWithSession(page, "/admin");
    await page.getByRole("button", { name: "Статьи", exact: true }).click();
    await page.getByRole("button", { name: "Удалить", exact: true }).click();
    if (confirmed) {
      await expect(
        page.getByText("ARTICLE_TO_DELETE", { exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Написать статью", exact: true }),
      ).toBeEnabled();
      await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    } else {
      await expect(
        page.locator("[data-background-notice]").getByRole("status"),
      ).toContainText("не подтверждён");
      const create = page.getByRole("button", {
        name: "Написать статью",
        exact: true,
      });
      await expect(create).toBeDisabled();
      failRead = true;
      await page
        .getByRole("button", { name: "Обновить список", exact: true })
        .click();
      await expect(
        page
          .locator("[data-background-notice]")
          .getByRole("status")
          .filter({ hasText: "Сервис временно недоступен" }),
      ).toBeVisible();
      await expect(create).toBeDisabled();
      failRead = false;
      exists = false;
      await page
        .getByRole("button", { name: "Обновить список", exact: true })
        .click();
      await expect(create).toBeEnabled();
      await expect(
        page.getByText("ARTICLE_TO_DELETE", { exact: true }),
      ).toHaveCount(0);
    }
    expect(writes).toBe(1);
  });
}

/** Проверяем оба перехода блокировки по подтверждённому ответу и свежим данным участницы, включая причину и точный payload. */
test("blocking and unblocking members use confirmed replies and refresh the visible state", async ({
  page,
}) => {
  let blocked = false;
  const writes: { name: string; input: Record<string, unknown> }[] = [];
  await editorApi(page, (name, input) => {
    if (name === "admin.members")
      return ok([
        {
          id: 201,
          name: "Участница",
          email: "member@example.test",
          contactPhone: null,
          role: "user",
          createdAt: "2026-10-01T10:00:00Z",
          clubExpiresAt: null,
          blockedAt: blocked ? "2026-10-08T10:00:00Z" : null,
          blockedReason: blocked ? "Причина блокировки" : null,
        },
      ]);
    if (name === "moderation.blockUser" || name === "moderation.unblockUser") {
      writes.push({ name, input });
      blocked = name === "moderation.blockUser";
      return ok({ ok: true });
    }
  });
  page.on("dialog", (dialog) => dialog.accept("Причина блокировки"));
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Участницы", exact: true }).click();
  await page
    .getByRole("button", { name: "Заблокировать", exact: true })
    .click();
  await expect(
    page.getByText("Причина: Причина блокировки", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Разблокировать", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Заблокировать", exact: true }),
  ).toBeEnabled();
  expect(writes).toEqual([
    {
      name: "moderation.blockUser",
      input: { userId: 201, reason: "Причина блокировки" },
    },
    { name: "moderation.unblockUser", input: { userId: 201 } },
  ]);
});

/** Некорректный тип id в проверочном списке не доказывает отсутствие статьи; только валидный пустой список завершает неизвестный исход. */
test("a malformed deletion verification list cannot unlock article actions", async ({
  page,
}) => {
  let rows: unknown[] = [article];
  let writes = 0;
  await editorApi(page, (name) => {
    if (name === "admin.articles") return ok(rows);
    if (name === "admin.deleteArticle") {
      writes++;
      rows = [{ ...article, id: "7" }];
      return ok({ ok: true });
    }
  });
  page.on("dialog", (dialog) => dialog.accept());
  await gotoWithSession(page, "/admin");
  await page.getByRole("button", { name: "Статьи", exact: true }).click();
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(
    page.locator("[data-background-notice]").getByRole("status"),
  ).toContainText("не подтверждён");
  await expect(
    page.getByRole("button", { name: "Написать статью", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Обновить список", exact: true })
    .click();
  await expect(
    page.locator("[data-background-notice]").getByRole("status"),
  ).toContainText("Некорректный ответ сервера");
  await expect(
    page.getByRole("button", { name: "Написать статью", exact: true }),
  ).toBeDisabled();
  rows = [];
  await page
    .getByRole("button", { name: "Обновить список", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Написать статью", exact: true }),
  ).toBeEnabled();
  expect(writes).toBe(1);
});
