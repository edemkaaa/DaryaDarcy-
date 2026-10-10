import { expect, it } from "vitest";
import { expect as browserExpect, type BrowserContext } from "@playwright/test";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { hashPassword } from "../../apps/backend/src/_core/password";
import { COOKIE_NAME } from "../../packages/shared/src/const";

interface PostInteractionsBrowserFixture {
  rows(sql: string, args?: unknown[]): Promise<RowDataPacket[]>;
  connection: Pick<Connection, "query">;
  context: BrowserContext;
  frontend: string;
  actorId: number;
  memberId: number;
}

export function registerPostInteractionsBrowserCases(
  fixture: () => PostInteractionsBrowserFixture,
) {
  it("C3 preserves liked and saved posts across login while isolating the next account", async () => {
    const { rows, connection, context, frontend, actorId, memberId } =
      fixture();
    const postId = 94601;
    const text = "C3 account reactions fixture";
    const password = "Synthetic-C3-login-only-2026!";
    const passwordHash = await hashPassword(password);
    await connection.query(
      "UPDATE users SET email=?,passwordHash=? WHERE id=?",
      ["c3.member@example.test", passwordHash, memberId],
    );
    await connection.query(
      "UPDATE users SET email=?,passwordHash=? WHERE id=?",
      ["c3.admin@example.test", passwordHash, actorId],
    );
    const identitySql =
      "SELECT id,email,passwordHash,role,sessionVersion FROM users WHERE id IN (?,?) ORDER BY id";
    const identity = await rows(identitySql, [actorId, memberId]);
    // Catches forgotten persisted reactions and cached state leaking between users.
    try {
      // The existing profile/logout UI is for club members, not unpaid accounts.
      await connection.query(
        "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'c3-reactions-access','paid','0','2030-01-01')",
        [memberId],
      );
      const access = await rows("SELECT * FROM club_payments WHERE userId=?", [
        memberId,
      ]);
      await connection.query(
        "INSERT INTO posts (id,text,photos,tags,status,published,target) VALUES (?,?,'[]','[]','published',1,'feed')",
        [postId, text],
      );
      await context.clearCookies();
      const page = await context.newPage();
      const signIn = async (email: string, id: number) => {
        await page.goto(frontend + `login?next=/post/${postId}`);
        await page.getByPlaceholder("Email", { exact: true }).fill(email);
        await page.getByPlaceholder("Пароль", { exact: true }).fill(password);
        const [response] = await Promise.all([
          page.waitForResponse(
            (response) =>
              new URL(response.url()).pathname === "/api/auth/login",
          ),
          page.getByRole("button", { name: "Войти", exact: true }).click(),
        ]);
        expect(response.status()).toBe(200);
        expect((await response.json()).user).toMatchObject({ id, email });
        await browserExpect(page).toHaveURL(new RegExp(`/post/${postId}$`));
        await browserExpect(
          page.getByText(text, { exact: true }),
        ).toBeVisible();
      };
      const logout = async () => {
        await page.goto(frontend + "profile");
        await page.getByRole("button", { name: "Выйти", exact: true }).click();
        await browserExpect
          .poll(
            async () =>
              (await context.cookies()).filter(
                (cookie) => cookie.name === COOKIE_NAME,
              ).length,
          )
          .toBe(0);
      };
      const like = page.getByRole("button", { name: "Нравится", exact: true });
      const save = page.getByRole("button", {
        name: "Сохранить пост",
        exact: true,
      });
      const assertReactions = async (pressed: boolean) => {
        await browserExpect(like).toBeEnabled();
        await browserExpect(save).toBeEnabled();
        await browserExpect(like).toHaveAttribute(
          "aria-pressed",
          String(pressed),
        );
        await browserExpect(save).toHaveAttribute(
          "aria-pressed",
          String(pressed),
        );
      };
      await signIn("c3.member@example.test", memberId);
      await assertReactions(false);
      await like.click();
      await browserExpect(like).toHaveAttribute("aria-pressed", "true");
      await save.click();
      await assertReactions(true);
      const expected = [{ userId: memberId, postId }];
      const assertSql = async () => {
        expect(
          await rows("SELECT userId,postId FROM likes WHERE postId=?", [
            postId,
          ]),
        ).toEqual(expected);
        expect(
          await rows("SELECT userId,postId FROM saved_posts WHERE postId=?", [
            postId,
          ]),
        ).toEqual(expected);
      };
      await assertSql();
      await page.reload();
      await assertReactions(true);
      await logout();
      await signIn("c3.admin@example.test", actorId);
      await assertReactions(false);
      await page.reload();
      await assertReactions(false);
      await assertSql();
      await logout();
      await signIn("c3.member@example.test", memberId);
      await assertReactions(true);
      await assertSql();
      expect(await rows(identitySql, [actorId, memberId])).toEqual(identity);
      expect(
        await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
      ).toEqual(access);
    } finally {
      await connection.query("DELETE FROM likes WHERE postId=?", [postId]);
      await connection.query("DELETE FROM saved_posts WHERE postId=?", [
        postId,
      ]);
      await connection.query("DELETE FROM posts WHERE id=? AND text=?", [
        postId,
        text,
      ]);
    }
  }, 30_000);
}
