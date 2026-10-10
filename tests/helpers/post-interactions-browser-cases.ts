import { expect, it } from "vitest";
import { expect as browserExpect, type BrowserContext } from "@playwright/test";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { hashPassword } from "../../apps/backend/src/_core/password";
import { COOKIE_NAME } from "../../packages/shared/src/const";
import { sdk } from "../../apps/backend/src/_core/sdk";

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
  it("C3 separates saved feed and club categories and excludes unpublished or expired club content", async () => {
    const { rows, connection, context, frontend, memberId } = fixture();
    const ids = [94611, 94612, 94613, 94614, 94615];
    // Catches category mixing and saved reads bypassing publication/access gates.
    try {
      await connection.query(
        `INSERT INTO posts (id,text,photos,tags,status,published,target) VALUES
        (94611,'C3 saved feed fixture','[]','[]','published',1,'feed'),
        (94612,'C3 saved club fixture','[]','[]','published',1,'club'),
        (94613,'C3 saved both fixture','[]','[]','published',1,'both'),
        (94614,'C3 saved draft fixture','[]','[]','draft',1,'feed'),
        (94615,'C3 saved scheduled fixture','[]','[]','scheduled',1,'club')`,
      );
      for (const postId of ids) {
        await connection.query(
          "INSERT INTO saved_posts (userId,postId) VALUES (?,?)",
          [memberId, postId],
        );
      }
      await connection.query(
        "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'c3-saved-categories-access','paid','0','2030-01-01')",
        [memberId],
      );
      const saved = await rows(
        "SELECT userId,postId FROM saved_posts WHERE userId=? ORDER BY postId",
        [memberId],
      );
      const identity = await rows(
        "SELECT id,email,passwordHash,role,sessionVersion FROM users WHERE id=?",
        [memberId],
      );
      await context.clearCookies();
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
      await page.goto(frontend + "profile");
      const savedIds = async () =>
        page.evaluate(async () => {
          const response = await fetch("/api/trpc/feed.savedPosts");
          const body = await response.json();
          return {
            status: response.status,
            ids: body.result.data.json
              .map((post: { id: number }) => post.id)
              .sort(),
          };
        });
      expect(await savedIds()).toEqual({
        status: 200,
        ids: [94611, 94612, 94613],
      });
      const card = (text: string) =>
        page.getByRole("button").filter({ hasText: text });
      await browserExpect(card("C3 saved feed fixture")).toHaveCount(1);
      await browserExpect(card("C3 saved both fixture")).toHaveCount(1);
      await browserExpect(card("C3 saved club fixture")).toHaveCount(0);
      await browserExpect(card("C3 saved draft fixture")).toHaveCount(0);
      await browserExpect(card("C3 saved scheduled fixture")).toHaveCount(0);
      await page.getByRole("button", { name: "Из клуба", exact: true }).click();
      await browserExpect(card("C3 saved club fixture")).toHaveCount(1);
      await browserExpect(card("C3 saved both fixture")).toHaveCount(1);
      await browserExpect(card("C3 saved feed fixture")).toHaveCount(0);
      await page.reload();
      await browserExpect(card("C3 saved feed fixture")).toHaveCount(1);
      // Only our fixture expires; saved rows remain recoverable after renewal.
      await connection.query(
        "UPDATE club_payments SET expiresAt='2026-01-01' WHERE userId=? AND orderId='c3-saved-categories-access'",
        [memberId],
      );
      expect(await savedIds()).toEqual({ status: 200, ids: [94611, 94613] });
      expect(
        await rows(
          "SELECT userId,postId FROM saved_posts WHERE userId=? ORDER BY postId",
          [memberId],
        ),
      ).toEqual(saved);
      expect(
        await rows(
          "SELECT id,email,passwordHash,role,sessionVersion FROM users WHERE id=?",
          [memberId],
        ),
      ).toEqual(identity);
    } finally {
      for (const postId of ids) {
        await connection.query("DELETE FROM saved_posts WHERE postId=?", [
          postId,
        ]);
        await connection.query(
          "DELETE FROM posts WHERE id=? AND text LIKE 'C3 saved % fixture'",
          [postId],
        );
      }
    }
  }, 30_000);
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
