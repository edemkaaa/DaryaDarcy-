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
  actorId: number;
  base: string;
}

export function registerClubCommentsBrowserCases(
  fixture: () => ClubCommentsBrowserFixture,
) {
  it.each([false, true])(
    "C3 member report preserves the comment and never claims success after a lost native reply (%s)",
    async (lost) => {
      const { connection, rows, context, frontend, memberId, actorId, base } =
        fixture();
      const postId = 94841,
        commentId = 94842;
      const text = "C3 reportable author comment";
      // This slice starts with the real server profile already completed.
      await connection.query("UPDATE users SET gender='female' WHERE id=?", [
        memberId,
      ]);
      const identitySql =
        "SELECT id,email,phone,gender,passwordHash,role,sessionVersion,blockedAt FROM users WHERE id IN (?,?) ORDER BY id";
      const identity = await rows(identitySql, [memberId, actorId]);
      try {
        await connection.query(
          "INSERT INTO posts (id,text,photos,tags,status,published,target,createdAt,publishedAt) VALUES (?,'C3 report community fixture','[]',JSON_ARRAY('community','autumn'),'published',1,'club',UTC_TIMESTAMP(),UTC_TIMESTAMP())",
          [postId],
        );
        await connection.query(
          "INSERT INTO post_comments (id,postId,userId,text) VALUES (?,?,?,?)",
          [commentId, postId, actorId, text],
        );
        await connection.query(
          "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'c3-report-access','paid','0','2030-01-01')",
          [memberId],
        );
        const comments = await rows("SELECT * FROM post_comments WHERE id=?", [
          commentId,
        ]);
        const access = await rows(
          "SELECT * FROM club_payments WHERE userId=?",
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
        let writes = 0;
        const notices: string[] = [];
        page.on("dialog", async (dialog) => {
          notices.push(dialog.message());
          await dialog.accept();
        });
        await page.route("**/api/trpc/club.reportComment*", async (route) => {
          writes++;
          const url = new URL(route.request().url());
          const response = await route.fetch({
            url: base + url.pathname + url.search,
            maxRedirects: 0,
          });
          expect(response.status()).toBe(200);
          const body = await response.json();
          expect(
            (Array.isArray(body) ? body[0] : body).result.data.json,
          ).toEqual({ ok: true });
          return lost ? route.abort("failed") : route.fulfill({ response });
        });
        await page.goto(frontend + "club");
        await page
          .getByRole("button", { name: "Комьюнити", exact: true })
          .click();
        await browserExpect(
          page.getByText(text, { exact: true }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: "Действия с комментарием", exact: true })
          .click();
        const result = lost
          ? page.waitForEvent("requestfailed", (request) =>
              request.url().includes("club.reportComment"),
            )
          : page.waitForResponse((response) =>
              response.url().includes("club.reportComment"),
            );
        await page
          .getByRole("dialog", { name: "Действия с комментарием" })
          .getByRole("button", { name: "Пожаловаться", exact: true })
          .click();
        await result;
        if (lost) {
          await browserExpect(
            page
              .getByRole("alert")
              .filter({
                hasText: /Результат действия «Отправить жалобу» не подтверждён/,
              })
              .first(),
          ).toBeVisible();
          expect(notices).toEqual([]);
        } else
          await browserExpect
            .poll(() => notices)
            .toEqual(["Жалоба отправлена. Спасибо!"]);
        const reports = await rows(
          "SELECT commentId,reporterUserId,reason FROM comment_reports WHERE commentId=?",
          [commentId],
        );
        expect(reports).toEqual([
          {
            commentId,
            reporterUserId: memberId,
            reason: "Нарушение правил клуба",
          },
        ]);
        expect(
          await rows("SELECT * FROM post_comments WHERE id=?", [commentId]),
        ).toEqual(comments);
        await browserExpect(
          page.getByText(text, { exact: true }),
        ).toBeVisible();
        expect(writes).toBe(1);
        expect(await rows(identitySql, [memberId, actorId])).toEqual(identity);
        expect(
          await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
        ).toEqual(access);
      } finally {
        await connection.query(
          "DELETE FROM comment_reports WHERE commentId=?",
          [commentId],
        );
        await connection.query(
          "DELETE FROM post_comments WHERE id=? AND postId=? AND text=?",
          [commentId, postId, text],
        );
        await connection.query(
          "DELETE FROM posts WHERE id=? AND text='C3 report community fixture'",
          [postId],
        );
        await connection.query(
          "DELETE FROM club_payments WHERE userId=? AND orderId='c3-report-access'",
          [memberId],
        );
      }
    },
    30_000,
  );
  it.each(["user", "admin"] as const)(
    "C3 denies changing another author's comment as %s through the native API",
    async (role) => {
      const { rows, connection, context, frontend, memberId, actorId } =
        fixture();
      const postId = 94632;
      const text = "C3 protected author comment fixture";
      const commentSql = "SELECT * FROM post_comments WHERE postId=?";
      const identitySql =
        "SELECT id,email,phone,gender,passwordHash,role,sessionVersion,blockedAt FROM users WHERE id IN (?,?) ORDER BY id";
      // Catches author-check removal even when the caller has paid/staff access.
      try {
        await connection.query(
          "UPDATE users SET role=?,gender='female' WHERE id=?",
          [role, actorId],
        );
        await connection.query(
          "INSERT INTO posts (id,text,photos,tags,status,published,target,createdAt,publishedAt) VALUES (?,'C3 protected community fixture','[]',JSON_ARRAY('community','autumn'),'published',1,'club',UTC_TIMESTAMP(),UTC_TIMESTAMP())",
          [postId],
        );
        await connection.query(
          "INSERT INTO post_comments (postId,userId,text) VALUES (?,?,?)",
          [postId, memberId, text],
        );
        await connection.query(
          "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'c3-foreign-comment-access','paid','0','2030-01-01')",
          [actorId],
        );
        const before = await rows(commentSql, [postId]);
        const identities = await rows(identitySql, [actorId, memberId]);
        const access = await rows(
          "SELECT * FROM club_payments WHERE userId=?",
          [actorId],
        );
        const page = await context.newPage();
        await page.goto(frontend + "club");
        await page
          .getByRole("button", { name: "Комьюнити", exact: true })
          .click();
        await browserExpect(
          page.getByText(text, { exact: true }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: "Действия с комментарием", exact: true })
          .click();
        await browserExpect(
          page
            .getByRole("dialog", { name: "Действия с комментарием" })
            .getByRole("button", { name: "Редактировать", exact: true }),
        ).toHaveCount(0);
        const update = () =>
          page.evaluate(async (id) => {
            const response = await fetch("/api/trpc/club.updateComment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                json: { id, text: "unauthorized replacement" },
              }),
            });
            return response.status;
          }, before[0].id);
        expect(await update()).toBe(403);
        expect(await rows(commentSql, [postId])).toEqual(before);
        await context.clearCookies();
        expect(await update()).toBe(401);
        expect(await rows(commentSql, [postId])).toEqual(before);
        expect(await rows(identitySql, [actorId, memberId])).toEqual(
          identities,
        );
        expect(
          await rows("SELECT * FROM club_payments WHERE userId=?", [actorId]),
        ).toEqual(access);
      } finally {
        await connection.query("DELETE FROM post_comments WHERE postId=?", [
          postId,
        ]);
        await connection.query(
          "DELETE FROM posts WHERE id=? AND text='C3 protected community fixture'",
          [postId],
        );
        await connection.query(
          "DELETE FROM club_payments WHERE userId=? AND orderId='c3-foreign-comment-access'",
          [actorId],
        );
      }
    },
    30_000,
  );
  it.each([false, true])(
    "C3 persists member comment edits and confirmed deletion (lost write replies: %s)",
    async (loseReply) => {
      const { rows, connection, context, frontend, memberId, base } = fixture();
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
        const access = await rows(
          "SELECT * FROM club_payments WHERE userId=?",
          [memberId],
        );
        await context.clearCookies();
        // Onboarding is derived from the server profile, including after reload.
        // This comment lifecycle slice starts with an already completed profile.
        await connection.query(
          "UPDATE users SET gender='female' WHERE id=? AND openId='binding-browser-member'",
          [memberId],
        );
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
        let writes = 0;
        await page.route("**/api/trpc/club.addComment*", async (route) => {
          writes++;
          const url = new URL(route.request().url());
          const response = await route.fetch({
            url: base + url.pathname + url.search,
            maxRedirects: 0,
          });
          expect(response.status()).toBe(200);
          if (loseReply) return route.abort("failed");
          return route.fulfill({ response });
        });
        await page.goto(frontend + "club");
        await page
          .getByRole("button", { name: "Комьюнити", exact: true })
          .click();
        const input = page.getByPlaceholder("Написать комментарий...", {
          exact: true,
        });
        await browserExpect(input).toBeEnabled();
        await input.fill(text);
        const sent = !loseReply
          ? page.waitForResponse((response) =>
              response.url().includes("club.addComment"),
            )
          : null;
        await page
          .getByRole("button", { name: "Отправить", exact: true })
          .click();
        if (sent) expect((await sent).status()).toBe(200);
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
        if (loseReply) {
          const send = page.getByRole("button", {
            name: "Отправить",
            exact: true,
          });
          await browserExpect(send).toBeDisabled();
          await browserExpect(input).toHaveValue(text);
          await page
            .getByRole("button", { name: "Обновить комментарии", exact: true })
            .click();
          await browserExpect(
            page.getByText(text, { exact: true }),
          ).toBeVisible();
          await browserExpect(send).toBeDisabled();
          const discard = page.getByRole("button", {
            name: "Отказаться от неподтверждённой отправки",
            exact: true,
          });
          page.once("dialog", (dialog) => dialog.dismiss());
          await discard.click();
          await browserExpect(input).toHaveValue(text);
          await browserExpect(discard).toBeVisible();
          page.once("dialog", (dialog) => dialog.accept());
          await discard.click();
          await browserExpect(discard).toHaveCount(0);
          expect(await rows(commentSql, [postId])).toEqual([created]);
        }
        expect(writes).toBe(1);
        await browserExpect(
          page.getByText(text, { exact: true }),
        ).toBeVisible();
        await browserExpect(input).toHaveValue("");
        await page.reload();
        await page
          .getByRole("button", { name: "Комьюнити", exact: true })
          .click();
        await browserExpect(
          page.getByText(text, { exact: true }),
        ).toBeVisible();
        if (!loseReply) {
          const replyText = "C3 native self reply fixture";
          const answer = page.getByRole("button", {
            name: "Ответить",
            exact: true,
          });
          await answer.click();
          const replyInput = page.getByPlaceholder("Ваш ответ...", {
            exact: true,
          });
          await replyInput.fill(replyText);
          await page
            .getByRole("button", { name: "Отмена ответа", exact: true })
            .click();
          await browserExpect(input).toHaveValue(replyText);
          expect(await rows(commentSql, [postId])).toEqual([created]);
          await answer.click();
          const replied = page.waitForResponse((response) =>
            response.url().includes("club.addComment"),
          );
          await page
            .getByRole("button", { name: "Отправить", exact: true })
            .click();
          expect((await replied).status()).toBe(200);
          const replyRows = await rows(commentSql, [postId]);
          expect(replyRows).toHaveLength(2);
          const child = replyRows.find((row) => row.id !== created.id)!;
          expect(child).toEqual({
            id: expect.any(Number),
            postId,
            userId: memberId,
            parentId: created.id,
            text: replyText,
            photos: null,
          });
          expect(replyRows.find((row) => row.id === created.id)).toEqual(
            created,
          );
          await browserExpect(input).toHaveValue("");
          await page.reload();
          await page
            .getByRole("button", { name: "Комьюнити", exact: true })
            .click();
          // Replies are a separate lazy page after reload, not part of root reads.
          const repliesRead = page.waitForResponse(
            (response) =>
              response.url().includes("club.commentsPage") &&
              decodeURIComponent(response.url()).includes(
                `"parentId":${created.id}`,
              ),
          );
          await page
            .getByRole("button", { name: "Показать ответы (1)", exact: true })
            .click();
          const replies = await repliesRead;
          expect(replies.status()).toBe(200);
          const replyBody = await replies.json();
          expect(
            (Array.isArray(replyBody) ? replyBody[0] : replyBody).result.data
              .json.items,
          ).toMatchObject([
            {
              id: child.id,
              parentId: created.id,
              userId: memberId,
              text: replyText,
            },
          ]);
          await browserExpect(
            page.getByText(replyText, { exact: true }),
          ).toBeVisible();
          // Remove only this fixture's own reply via real API before the root CRUD steps.
          const deletedReply = await page.evaluate(async (id) => {
            const response = await fetch("/api/trpc/club.deleteComment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ json: { id } }),
            });
            return response.status;
          }, child.id);
          expect(deletedReply).toBe(200);
          expect(await rows(commentSql, [postId])).toEqual([created]);
          await page.reload();
          await page
            .getByRole("button", { name: "Комьюнити", exact: true })
            .click();
          await browserExpect(
            page.getByText(replyText, { exact: true }),
          ).toHaveCount(0);
          await browserExpect(
            page.getByText(text, { exact: true }),
          ).toBeVisible();
          expect(writes).toBe(2);
        }
        const likeSql =
          "SELECT userId,commentId FROM comment_likes WHERE commentId=?";
        const like = page.getByRole("button", {
          name: "Поставить лайк комментарию",
          exact: true,
        });
        await browserExpect(like).toHaveAttribute("aria-pressed", "false");
        const liked = page.waitForResponse((response) =>
          response.url().includes("club.toggleCommentLike"),
        );
        await like.click();
        expect((await liked).status()).toBe(200);
        expect(await rows(likeSql, [created.id])).toEqual([
          { userId: memberId, commentId: created.id },
        ]);
        const unlike = page.getByRole("button", {
          name: "Убрать лайк комментария",
          exact: true,
        });
        await browserExpect(unlike).toHaveAttribute("aria-pressed", "true");
        await browserExpect(
          unlike.getByText("1", { exact: true }),
        ).toBeVisible();
        await page.reload();
        await page
          .getByRole("button", { name: "Комьюнити", exact: true })
          .click();
        await browserExpect(unlike).toHaveAttribute("aria-pressed", "true");
        await browserExpect(
          unlike.getByText("1", { exact: true }),
        ).toBeVisible();
        const unliked = page.waitForResponse((response) =>
          response.url().includes("club.toggleCommentLike"),
        );
        await unlike.click();
        expect((await unliked).status()).toBe(200);
        await browserExpect(like).toHaveAttribute("aria-pressed", "false");
        expect(await rows(likeSql, [created.id])).toEqual([]);
        expect(await rows(commentSql, [postId])).toEqual([created]);
        const editFromMenu = async () => {
          await page
            .getByRole("button", {
              name: "Действия с комментарием",
              exact: true,
            })
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
        await browserExpect(
          page.getByText(text, { exact: true }),
        ).toBeVisible();
        await editFromMenu();
        await editInput.fill(editedText);
        let edits = 0;
        if (loseReply) {
          await page.route("**/api/trpc/club.updateComment*", async (route) => {
            edits++;
            const url = new URL(route.request().url());
            const response = await route.fetch({
              url: base + url.pathname + url.search,
              maxRedirects: 0,
            });
            expect(response.status()).toBe(200);
            return route.abort("failed");
          });
        }
        const updated = !loseReply
          ? page.waitForResponse((response) =>
              response.url().includes("club.updateComment"),
            )
          : null;
        await page
          .getByRole("button", { name: "Сохранить", exact: true })
          .click();
        if (updated) expect((await updated).status()).toBe(200);
        const edited = { ...created, text: editedText };
        await browserExpect
          .poll(() => rows(commentSql, [postId]))
          .toEqual([edited]);
        if (loseReply) {
          const save = page.getByRole("button", {
            name: "Сохранить",
            exact: true,
          });
          await browserExpect(save).toBeDisabled();
          await browserExpect(editInput).toHaveValue(editedText);
          await page
            .getByRole("button", { name: "Обновить комментарии", exact: true })
            .click();
          await browserExpect(save).toBeEnabled();
          expect(edits).toBe(1);
          expect(await rows(commentSql, [postId])).toEqual([edited]);
          await page
            .getByRole("button", { name: "Отмена", exact: true })
            .click();
          await browserExpect(editInput).toHaveCount(0);
        }
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
            .getByRole("button", {
              name: "Действия с комментарием",
              exact: true,
            })
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
        let deletes = 0;
        if (loseReply) {
          await page.route("**/api/trpc/club.deleteComment*", async (route) => {
            deletes++;
            const url = new URL(route.request().url());
            const response = await route.fetch({
              url: base + url.pathname + url.search,
              maxRedirects: 0,
            });
            expect(response.status()).toBe(200);
            return route.abort("failed");
          });
        }
        page.once("dialog", (dialog) => dialog.accept());
        await deleteFromMenu();
        await browserExpect.poll(() => rows(commentSql, [postId])).toEqual([]);
        if (loseReply) {
          await browserExpect(
            page.getByText(editedText, { exact: true }),
          ).toBeVisible();
          const refresh = page.getByRole("button", {
            name: "Обновить комментарии",
            exact: true,
          });
          await refresh.click();
          await browserExpect(refresh).toHaveCount(0);
          expect(deletes).toBe(1);
        }
        await browserExpect(
          page.getByText(editedText, { exact: true }),
        ).toHaveCount(0);
        expect(await rows(commentSql, [postId])).toEqual([]);
        if (loseReply) {
          await page.reload();
          await page
            .getByRole("button", { name: "Комьюнити", exact: true })
            .click();
          await browserExpect(input).toBeEnabled();
          await browserExpect(
            page.getByText(editedText, { exact: true }),
          ).toHaveCount(0);
          expect(writes).toBe(1);
          expect(edits).toBe(1);
          expect(deletes).toBe(1);
        }
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
        await connection.query(
          "DELETE FROM comment_likes WHERE commentId IN (SELECT id FROM post_comments WHERE postId=?)",
          [postId],
        );
        await connection.query("DELETE FROM post_comments WHERE postId=?", [
          postId,
        ]);
        await connection.query(
          "DELETE FROM posts WHERE id=? AND text='C3 community fixture'",
          [postId],
        );
      }
    },
    30_000,
  );
}
