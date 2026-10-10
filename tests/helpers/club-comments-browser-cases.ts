import { expect, it } from "vitest";
import { expect as browserExpect, type BrowserContext } from "@playwright/test";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { sdk } from "../../apps/backend/src/_core/sdk";
import { COOKIE_NAME } from "../../packages/shared/src/const";

interface ClubCommentsBrowserFixture {
  rows(sql: string, args?: unknown[]): Promise<RowDataPacket[]>;
  connection: Pick<Connection, "query">;
  context: BrowserContext;
  frontend: string;
  memberId: number;
}

export function registerClubCommentsBrowserCases(
  fixture: () => ClubCommentsBrowserFixture,
) {
  it("C3 persists member comment edits and requires confirmation before deleting it", async () => {
    const { rows, connection, context, frontend, memberId } = fixture();
    const postId = 94631;
    const text = "C3 native member comment fixture";
    const editedText = "C3 native member comment edited fixture";
    const commentSql =
      "SELECT id,postId,userId,parentId,text,photos FROM post_comments WHERE postId=?";
    // Catches lost comment writes, wrong authors and deletion despite cancellation.
    try {
      await connection.query(
        "INSERT INTO posts (id,text,photos,tags,status,published,target,createdAt,publishedAt) VALUES (?,'C3 community fixture','[]',JSON_ARRAY('community','autumn'),'published',1,'club',UTC_TIMESTAMP(),UTC_TIMESTAMP())",
        [postId],
      );
      await connection.query(
        "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'c3-comments-access','paid','0','2030-01-01')",
        [memberId],
      );
      const identity = await rows(
        "SELECT id,email,passwordHash,role,sessionVersion FROM users WHERE id=?",
        [memberId],
      );
      const access = await rows("SELECT * FROM club_payments WHERE userId=?", [
        memberId,
      ]);
      await context.clearCookies();
      // This slice starts after local onboarding, which is unrelated to comments.
      await context.addInitScript((id) => {
        localStorage.setItem(
          `darcy:user:${id}:@darcy_club_profile_completed`,
          "true",
        );
      }, memberId);
      await context.addCookies([
        {
          name: COOKIE_NAME,
          value: await sdk.createSessionToken("binding-browser-member", {
            sessionVersion: 0,
          }),
          url: frontend,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      const page = await context.newPage();
      await page.goto(frontend + "club");
      await page
        .getByRole("button", { name: "Комьюнити", exact: true })
        .click();
      const input = page.getByPlaceholder("Написать комментарий...", {
        exact: true,
      });
      await browserExpect(input).toBeEnabled();
      await input.fill(text);
      const sent = page.waitForResponse((response) =>
        response.url().includes("club.addComment"),
      );
      await page
        .getByRole("button", { name: "Отправить", exact: true })
        .click();
      expect((await sent).status()).toBe(200);
      await browserExpect
        .poll(async () => (await rows(commentSql, [postId])).length)
        .toBe(1);
      const [created] = await rows(commentSql, [postId]);
      expect(created).toEqual({
        id: expect.any(Number),
        postId,
        userId: memberId,
        parentId: null,
        text,
        photos: null,
      });
      await browserExpect(page.getByText(text, { exact: true })).toBeVisible();
      await browserExpect(input).toHaveValue("");
      await page.reload();
      await page
        .getByRole("button", { name: "Комьюнити", exact: true })
        .click();
      await browserExpect(page.getByText(text, { exact: true })).toBeVisible();
      const editFromMenu = async () => {
        await page
          .getByRole("button", { name: "Действия с комментарием", exact: true })
          .click();
        await page
          .getByRole("dialog", { name: "Действия с комментарием" })
          .getByRole("button", { name: "Редактировать", exact: true })
          .click();
      };
      await editFromMenu();
      const editInput = page.locator("textarea:not([placeholder])");
      await browserExpect(editInput).toHaveValue(text);
      await editInput.fill(editedText);
      await page.getByRole("button", { name: "Отмена", exact: true }).click();
      await browserExpect(editInput).toHaveCount(0);
      expect(await rows(commentSql, [postId])).toEqual([created]);
      await browserExpect(page.getByText(text, { exact: true })).toBeVisible();
      await editFromMenu();
      await editInput.fill(editedText);
      const updated = page.waitForResponse((response) =>
        response.url().includes("club.updateComment"),
      );
      await page
        .getByRole("button", { name: "Сохранить", exact: true })
        .click();
      expect((await updated).status()).toBe(200);
      const edited = { ...created, text: editedText };
      await browserExpect
        .poll(() => rows(commentSql, [postId]))
        .toEqual([edited]);
      await browserExpect(
        page.getByText(editedText, { exact: true }),
      ).toBeVisible();
      await page.reload();
      await page
        .getByRole("button", { name: "Комьюнити", exact: true })
        .click();
      await browserExpect(
        page.getByText(editedText, { exact: true }),
      ).toBeVisible();
      const deleteFromMenu = async () => {
        await page
          .getByRole("button", { name: "Действия с комментарием", exact: true })
          .click();
        await page
          .getByRole("dialog", { name: "Действия с комментарием" })
          .getByRole("button", { name: "Удалить", exact: true })
          .click();
      };
      page.once("dialog", (dialog) => dialog.dismiss());
      await deleteFromMenu();
      expect(await rows(commentSql, [postId])).toEqual([edited]);
      await browserExpect(
        page.getByText(editedText, { exact: true }),
      ).toBeVisible();
      page.once("dialog", (dialog) => dialog.accept());
      await deleteFromMenu();
      await browserExpect(
        page.getByText(editedText, { exact: true }),
      ).toHaveCount(0);
      expect(await rows(commentSql, [postId])).toEqual([]);
      expect(
        await rows(
          "SELECT id,email,passwordHash,role,sessionVersion FROM users WHERE id=?",
          [memberId],
        ),
      ).toEqual(identity);
      expect(
        await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
      ).toEqual(access);
    } finally {
      await connection.query("DELETE FROM post_comments WHERE postId=?", [
        postId,
      ]);
      await connection.query(
        "DELETE FROM posts WHERE id=? AND text='C3 community fixture'",
        [postId],
      );
    }
  }, 30_000);
}
