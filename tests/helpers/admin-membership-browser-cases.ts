import { expect, it } from "vitest";
import { expect as browserExpect, type BrowserContext } from "@playwright/test";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { sdk } from "../../apps/backend/src/_core/sdk";
import { getDb } from "../../apps/backend/src/db";
import { processAccessEmails } from "../../apps/backend/src/identity/access";
import { sendTransactionalEmail } from "../../apps/backend/src/_core/email";

interface AdminMembershipBrowserFixture {
  rows(sql: string, args?: unknown[]): Promise<RowDataPacket[]>;
  connection: Pick<Connection, "query">;
  context: BrowserContext;
  actorId: number;
  memberId: number;
  base: string;
  frontend: string;
  smtp: { messages: string[]; recipients: string[] };
}

// Register under the caller's native API/SQL/SMTP lifecycle; read its
// per-test context only when the case runs, after beforeEach creates it.
export function registerAdminMembershipBrowserCases(
  fixture: () => AdminMembershipBrowserFixture,
) {
  it("C1 lets a moderator block a reported author without deleting content or paid access", async () => {
    const {
      rows,
      connection,
      context,
      actorId,
      memberId,
      base,
      frontend,
      smtp,
    } = fixture();
    await connection.query("UPDATE users SET role='moderator' WHERE id=?", [
      actorId,
    ]);
    // Catches wrong-target blocking, writes on cancel, and missing cancellation intent.
    try {
      await connection.query(
        "INSERT INTO posts (id,text,photos,tags) VALUES (94531,'C1 blocking fixture','[]','[]')",
      );
      await connection.query(
        "INSERT INTO post_comments (id,postId,userId,text) VALUES (94532,94531,?,'C1 preserved author comment')",
        [memberId],
      );
      await connection.query(
        "INSERT INTO comment_reports (id,commentId,reporterUserId,reason) VALUES (94533,94532,?,'C1 original report')",
        [actorId],
      );
      await connection.query(
        "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'binding-browser-moderator-access','paid','0','2030-01-01')",
        [memberId],
      );
      await connection.query(
        "INSERT INTO billing_profiles (profileKey,userId,domain,subscriptionId,profileId,email,amountMinor) VALUES ('binding-browser-moderator-profile',?,'fixture.payform.ru','123','456','moderation@example.test',79000)",
        [memberId],
      );
      const identityQuery =
        "SELECT id,openId,name,email,phone,passwordHash,role,accountDeletionRequestedAt FROM users WHERE id=?";
      const identity = await rows(identityQuery, [memberId]);
      const access = await rows("SELECT * FROM club_payments WHERE userId=?", [
        memberId,
      ]);
      const comments = await rows("SELECT * FROM post_comments WHERE id=94532");
      const reports = await rows(
        "SELECT * FROM comment_reports WHERE id=94533",
      );
      const memberToken = await sdk.createSessionToken(
        "binding-browser-member",
        { sessionVersion: 0 },
      );
      const clubStatus = async () =>
        (
          await fetch(base + "/api/trpc/club.list", {
            headers: { Authorization: `Bearer ${memberToken}` },
          })
        ).status;
      expect(await clubStatus()).toBe(200);
      const page = await context.newPage();
      await page.goto(frontend + "admin");
      const report = page
        .getByText("Жалоба #94533", { exact: true })
        .locator("..");
      await browserExpect(
        report.getByText("C1 preserved author comment", { exact: true }),
      ).toBeVisible();
      page.once("dialog", (dialog) => dialog.dismiss());
      await report
        .getByRole("button", { name: "Заблокировать автора", exact: true })
        .click();
      expect(
        await rows(
          "SELECT blockedAt,blockedReason,sessionVersion FROM users WHERE id=?",
          [memberId],
        ),
      ).toEqual([{ blockedAt: null, blockedReason: null, sessionVersion: 0 }]);
      expect(
        await rows(
          "SELECT cancelRequestedAt,cancelledAt FROM billing_profiles WHERE userId=?",
          [memberId],
        ),
      ).toEqual([{ cancelRequestedAt: null, cancelledAt: null }]);
      expect(
        await rows("SELECT id FROM admin_audit_log WHERE actorUserId=?", [
          actorId,
        ]),
      ).toEqual([]);
      expect(await clubStatus()).toBe(200);
      page.once("dialog", (dialog) => dialog.accept("  C1 moderator reason  "));
      const response = page.waitForResponse(
        (response) =>
          response.url().includes("/api/trpc/moderation.blockUser") &&
          response.request().method() === "POST",
      );
      await report
        .getByRole("button", { name: "Заблокировать автора", exact: true })
        .click();
      expect((await response).status()).toBe(200);
      expect(
        await rows(
          "SELECT blockedAt,blockedReason,sessionVersion FROM users WHERE id=?",
          [memberId],
        ),
      ).toEqual([
        {
          blockedAt: expect.any(Date),
          blockedReason: "C1 moderator reason",
          sessionVersion: 1,
        },
      ]);
      expect(await clubStatus()).toBe(401);
      expect(
        await rows(
          "SELECT cancelRequestedAt,cancelledAt FROM billing_profiles WHERE userId=?",
          [memberId],
        ),
      ).toEqual([{ cancelRequestedAt: expect.any(Date), cancelledAt: null }]);
      expect(await rows(identityQuery, [memberId])).toEqual(identity);
      expect(
        await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
      ).toEqual(access);
      expect(await rows("SELECT * FROM post_comments WHERE id=94532")).toEqual(
        comments,
      );
      expect(
        await rows("SELECT * FROM comment_reports WHERE id=94533"),
      ).toEqual(reports);
      expect(
        await rows(
          "SELECT action,targetType,targetId,details FROM admin_audit_log WHERE actorUserId=?",
          [actorId],
        ),
      ).toEqual([
        {
          action: "block_user",
          targetType: "user",
          targetId: memberId,
          details: "C1 moderator reason",
        },
      ]);
      await page.reload();
      await browserExpect(
        report.getByText("C1 preserved author comment", { exact: true }),
      ).toBeVisible();
      expect(await clubStatus()).toBe(401);
      expect(
        await rows("SELECT blockedAt FROM users WHERE id=?", [actorId]),
      ).toEqual([{ blockedAt: null }]);
      expect(smtp.messages).toHaveLength(0);
    } finally {
      await connection.query(
        "DELETE FROM billing_profiles WHERE profileKey='binding-browser-moderator-profile' AND userId=?",
        [memberId],
      );
      await connection.query(
        "DELETE FROM comment_reports WHERE id=94533 AND reporterUserId=?",
        [actorId],
      );
      await connection.query(
        "DELETE FROM post_comments WHERE id=94532 AND userId=?",
        [memberId],
      );
      await connection.query(
        "DELETE FROM posts WHERE id=94531 AND text='C1 blocking fixture'",
      );
    }
  }, 30_000);
  it("C1 lets a moderator delete a reported parent while preserving its reply and author", async () => {
    const { rows, connection, context, actorId, memberId, frontend, smtp } =
      fixture();
    await connection.query("UPDATE users SET role='moderator' WHERE id=?", [
      actorId,
    ]);
    // Catches accidental recursive deletion, missing audit, and writes on cancel.
    const state = async () => ({
      comments: await rows(
        "SELECT id,parentId,text FROM post_comments WHERE postId=94521 ORDER BY id",
      ),
      reports: await rows(
        "SELECT id,commentId,reason FROM comment_reports WHERE id IN (94524,94525) ORDER BY id",
      ),
      likes: await rows(
        "SELECT commentId,userId FROM comment_likes WHERE commentId IN (94522,94523) ORDER BY commentId",
      ),
      audit: await rows(
        "SELECT action,targetType,targetId,details FROM admin_audit_log WHERE actorUserId=? ORDER BY id",
        [actorId],
      ),
    });
    try {
      await connection.query(
        "INSERT INTO posts (id,text,photos,tags) VALUES (94521,'C1 deletion fixture','[]','[]')",
      );
      await connection.query(
        "INSERT INTO post_comments (id,postId,userId,parentId,text) VALUES (94522,94521,?,NULL,'C1 removed parent'),(94523,94521,?,94522,'C1 retained reply')",
        [memberId, memberId],
      );
      await connection.query(
        "INSERT INTO comment_reports (id,commentId,reporterUserId,reason) VALUES (94524,94522,?,'parent reason'),(94525,94523,?,'reply reason')",
        [actorId, actorId],
      );
      await connection.query(
        "INSERT INTO comment_likes (commentId,userId) VALUES (94522,?),(94523,?)",
        [actorId, actorId],
      );
      const author = await rows("SELECT * FROM users WHERE id=?", [memberId]);
      const before = await state();
      const page = await context.newPage();
      await page.goto(frontend + "admin");
      const report = page
        .getByText("Жалоба #94524", { exact: true })
        .locator("..");
      await browserExpect(
        report.getByText("C1 removed parent", { exact: true }),
      ).toBeVisible();
      page.once("dialog", (dialog) => dialog.dismiss());
      await report
        .getByRole("button", { name: "Удалить комментарий", exact: true })
        .click();
      expect(await state()).toEqual(before);
      await browserExpect(report).toBeVisible();
      page.once("dialog", (dialog) => dialog.accept());
      await report
        .getByRole("button", { name: "Удалить комментарий", exact: true })
        .click();
      await browserExpect(
        page.getByText("Жалоба #94524", { exact: true }),
      ).toHaveCount(0);
      expect(await state()).toEqual({
        comments: [{ id: 94523, parentId: null, text: "C1 retained reply" }],
        reports: [{ id: 94525, commentId: 94523, reason: "reply reason" }],
        likes: [{ commentId: 94523, userId: actorId }],
        audit: [
          {
            action: "delete_reported_comment",
            targetType: "comment",
            targetId: 94522,
            details: null,
          },
        ],
      });
      await page.reload();
      await browserExpect(
        page.getByText("Модерация", { exact: true }),
      ).toBeVisible();
      await browserExpect(
        page.getByText("Жалоба #94524", { exact: true }),
      ).toHaveCount(0);
      await browserExpect(
        page
          .getByText("Жалоба #94525", { exact: true })
          .locator("..")
          .getByText("C1 retained reply", { exact: true }),
      ).toBeVisible();
      expect(await rows("SELECT * FROM users WHERE id=?", [memberId])).toEqual(
        author,
      );
      expect(smtp.messages).toHaveLength(0);
    } finally {
      await connection.query(
        "DELETE FROM comment_likes WHERE commentId IN (94522,94523) AND userId=?",
        [actorId],
      );
      await connection.query(
        "DELETE FROM comment_reports WHERE id IN (94524,94525) AND reporterUserId=?",
        [actorId],
      );
      await connection.query(
        "DELETE FROM post_comments WHERE id IN (94522,94523) AND userId=?",
        [memberId],
      );
      await connection.query(
        "DELETE FROM posts WHERE id=94521 AND text='C1 deletion fixture'",
      );
    }
  }, 30_000);
  it("C1 issues first club access from now without counting an unpaid future order", async () => {
    const {
      rows,
      connection,
      context,
      actorId,
      memberId,
      base,
      frontend,
      smtp,
    } = fixture();
    await connection.query(
      "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'binding-browser-unpaid-future','pending','790','2035-01-01')",
      [memberId],
    );
    // Authenticated content probes may update lastSignedIn; credentials and
    // account authority must remain unchanged by the grant.
    const identityQuery =
      "SELECT id,openId,name,email,phone,passwordHash,role,sessionVersion,blockedAt,blockedReason,accountDeletionRequestedAt FROM users WHERE id=?";
    const identity = await rows(identityQuery, [memberId]);
    const before = await rows("SELECT * FROM club_payments WHERE userId=?", [
      memberId,
    ]);
    const memberToken = await sdk.createSessionToken("binding-browser-member", {
      sessionVersion: 0,
    });
    const clubStatus = async () =>
      (
        await fetch(base + "/api/trpc/club.list", {
          headers: { Authorization: `Bearer ${memberToken}` },
        })
      ).status;
    expect(await clubStatus()).toBe(403);
    const page = await context.newPage();
    await page.goto(frontend + "admin");
    await page.getByRole("button", { name: "Участницы", exact: true }).click();
    const member = page
      .getByText("Browser phone member", { exact: true })
      .locator("..");
    page.once("dialog", (dialog) => dialog.dismiss());
    await member
      .getByRole("button", { name: "Выдать клуб", exact: true })
      .click();
    expect(
      await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
    ).toEqual(before);
    expect(await clubStatus()).toBe(403);
    const startedAt = Date.now();
    const dialogs: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.type());
      await dialog.accept();
    });
    await member
      .getByRole("button", { name: "Выдать клуб", exact: true })
      .click();
    await browserExpect.poll(() => dialogs).toEqual(["confirm", "alert"]);
    const completedAt = Date.now();
    const payments = await rows(
      "SELECT * FROM club_payments WHERE userId=? ORDER BY id",
      [memberId],
    );
    expect(payments).toHaveLength(2);
    expect(payments[0]).toEqual(before[0]);
    expect(payments[1]).toMatchObject({
      userId: memberId,
      orderId: expect.stringMatching(/^admin-grant-/),
      status: "paid",
      sum: "0",
      email: null,
      cancelAtPeriodEnd: 0,
    });
    // Independent real-clock bounds permit MySQL's whole-second rounding.
    const expiry = payments[1].expiresAt.getTime();
    expect(expiry).toBeGreaterThanOrEqual(startedAt + 31 * 86_400_000 - 1_000);
    expect(expiry).toBeLessThanOrEqual(completedAt + 31 * 86_400_000 + 1_000);
    expect(await clubStatus()).toBe(200);
    await page.reload();
    await page.getByRole("button", { name: "Участницы", exact: true }).click();
    await browserExpect(
      member.getByRole("button", { name: "Продлить клуб", exact: true }),
    ).toBeEnabled();
    await browserExpect(member.getByText(/Клуб до/)).toBeVisible();
    expect(await rows(identityQuery, [memberId])).toEqual(identity);
    expect(
      await rows("SELECT id FROM club_payments WHERE userId=?", [actorId]),
    ).toEqual([]);
    expect(
      await rows("SELECT id FROM access_email_outbox WHERE userId=?", [
        memberId,
      ]),
    ).toEqual([]);
    expect(
      await rows("SELECT id FROM password_tokens WHERE userId=?", [memberId]),
    ).toEqual([]);
    expect(smtp.messages).toHaveLength(0);
  }, 30_000);
  it("C1 lets a moderator dismiss a report without deleting its comment or changing the author", async () => {
    const { rows, connection, context, actorId, memberId, frontend, smtp } =
      fixture();
    await connection.query("UPDATE users SET role='moderator' WHERE id=?", [
      actorId,
    ]);
    try {
      await connection.query(
        "INSERT INTO posts (id,text,photos,tags) VALUES (94511,'C1 native moderation fixture','[]','[]')",
      );
      await connection.query(
        "INSERT INTO post_comments (id,postId,userId,text) VALUES (94512,94511,?,'C1 retained comment')",
        [memberId],
      );
      await connection.query(
        "INSERT INTO comment_reports (id,commentId,reporterUserId,reason) VALUES (94513,94512,?,'C1 report reason')",
        [actorId],
      );
      const author = await rows("SELECT * FROM users WHERE id=?", [memberId]);
      const comment = await rows("SELECT * FROM post_comments WHERE id=94512");
      const page = await context.newPage();
      await page.goto(frontend + "admin");
      const report = page
        .getByText("Жалоба #94513", { exact: true })
        .locator("..");
      await browserExpect(
        report.getByText("C1 retained comment", { exact: true }),
      ).toBeVisible();
      await report
        .getByRole("button", { name: "Закрыть", exact: true })
        .click();
      await browserExpect(
        page.getByText("Жалоба #94513", { exact: true }),
      ).toHaveCount(0);
      expect(
        await rows("SELECT id FROM comment_reports WHERE id=94513"),
      ).toEqual([]);
      expect(await rows("SELECT * FROM post_comments WHERE id=94512")).toEqual(
        comment,
      );
      expect(await rows("SELECT * FROM users WHERE id=?", [memberId])).toEqual(
        author,
      );
      expect(
        await rows(
          "SELECT action,targetType,targetId FROM admin_audit_log WHERE actorUserId=?",
          [actorId],
        ),
      ).toEqual([
        {
          action: "dismiss_comment_report",
          targetType: "comment_report",
          targetId: 94513,
        },
      ]);
      await page.reload();
      await browserExpect(
        page.getByText("Модерация", { exact: true }),
      ).toBeVisible();
      await browserExpect(
        page.getByText("Жалоба #94513", { exact: true }),
      ).toHaveCount(0);
      expect(smtp.messages).toHaveLength(0);
    } finally {
      await connection.query(
        "DELETE FROM comment_reports WHERE id=94513 AND reporterUserId=?",
        [actorId],
      );
      await connection.query(
        "DELETE FROM post_comments WHERE id=94512 AND userId=?",
        [memberId],
      );
      await connection.query(
        "DELETE FROM posts WHERE id=94511 AND text='C1 native moderation fixture'",
      );
    }
  }, 30_000);
  it("C1 queues a browser resend and delivers it once over loopback SMTP without changing access or credentials", async () => {
    const { rows, connection, context, actorId, memberId, frontend, smtp } =
      fixture();
    await connection.query(
      "UPDATE users SET email='browser.member@example.test' WHERE id=?",
      [memberId],
    );
    await connection.query(
      "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'binding-browser-existing-access','paid','0','2030-01-01')",
      [memberId],
    );
    const identity = await rows("SELECT * FROM users WHERE id=?", [memberId]);
    const access = await rows("SELECT * FROM club_payments WHERE userId=?", [
      memberId,
    ]);
    const page = await context.newPage();
    await page.goto(frontend + "admin");
    await page.getByRole("button", { name: "Участницы", exact: true }).click();
    const member = page
      .getByText("Browser phone member", { exact: true })
      .locator("..");
    page.once("dialog", (dialog) => dialog.accept());
    await member
      .getByRole("button", { name: "Повторить письмо", exact: true })
      .click();
    await browserExpect(
      member.getByRole("button", { name: "Письмо в очереди", exact: true }),
    ).toBeDisabled();
    await browserExpect(member.getByRole("status")).toContainText(
      "Доставка ещё не подтверждена",
    );
    expect(smtp.messages).toHaveLength(0);
    const queued = await rows(
      "SELECT kind,email,sentAt,discardedAt FROM access_email_outbox WHERE userId=?",
      [memberId],
    );
    expect(queued).toEqual([
      {
        kind: "club-access",
        email: "browser.member@example.test",
        sentAt: null,
        discardedAt: null,
      },
    ]);
    const database = await getDb();
    if (!database) throw new Error("Disposable database unavailable");
    await processAccessEmails(database, sendTransactionalEmail, memberId);
    expect(smtp.recipients).toEqual(["RCPT TO:<browser.member@example.test>"]);
    expect(smtp.messages).toHaveLength(1);
    const text = smtp.messages[0]
      .split(/\r\n--/)
      .map((part) => {
        const separator = part.indexOf("\r\n\r\n");
        const header = part.slice(0, separator);
        const body = part.slice(separator + 4);
        return /Content-Transfer-Encoding: base64/i.test(header)
          ? Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8")
          : body
              .replace(/=\r\n/g, "")
              .replace(/=([0-9A-F]{2})/g, (_, hex) =>
                String.fromCharCode(parseInt(hex, 16)),
              );
      })
      .join("\n");
    expect(text).toContain(frontend + "login");
    expect(text).not.toContain("token=");
    expect(
      await rows("SELECT id FROM password_tokens WHERE userId=?", [memberId]),
    ).toEqual([]);
    const [delivered] = await rows(
      "SELECT sentAt,discardedAt,attempts FROM access_email_outbox WHERE userId=?",
      [memberId],
    );
    expect(delivered).toEqual({
      sentAt: expect.any(Date),
      discardedAt: null,
      attempts: 1,
    });
    await processAccessEmails(database, sendTransactionalEmail, memberId);
    expect(smtp.messages).toHaveLength(1);
    expect(await rows("SELECT * FROM users WHERE id=?", [memberId])).toEqual(
      identity,
    );
    expect(
      await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
    ).toEqual(access);
    expect(
      await rows(
        "SELECT action,targetId FROM admin_audit_log WHERE actorUserId=?",
        [actorId],
      ),
    ).toEqual([{ action: "resend_club_access", targetId: memberId }]);
  }, 30_000);
  it.each(["user", "moderator"] as const)(
    "C1 denies owner membership actions to a %s in the browser and native API",
    async (role) => {
      const { rows, connection, context, actorId, memberId, frontend, smtp } =
        fixture();
      await connection.query("UPDATE users SET role=? WHERE id=?", [
        role,
        actorId,
      ]);
      const before = await rows("SELECT * FROM users WHERE id=?", [memberId]);
      const page = await context.newPage();
      await page.goto(frontend + "admin");
      if (role === "user") {
        await browserExpect(
          page.getByText("Недостаточно прав для управления приложением", {
            exact: true,
          }),
        ).toBeVisible();
      } else {
        await browserExpect(
          page.getByText("Модерация", { exact: true }),
        ).toBeVisible();
      }
      await browserExpect(
        page.getByRole("button", { name: "Участницы", exact: true }),
      ).toHaveCount(0);
      const statuses = await page.evaluate(async (target) => {
        const read = await fetch("/api/trpc/admin.members");
        const write = await fetch("/api/trpc/admin.grantClub", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ json: { userId: target } }),
        });
        return [read.status, write.status];
      }, memberId);
      expect(statuses).toEqual([403, 403]);
      expect(await rows("SELECT * FROM users WHERE id=?", [memberId])).toEqual(
        before,
      );
      expect(
        await rows("SELECT id FROM club_payments WHERE userId IN (?,?)", [
          actorId,
          memberId,
        ]),
      ).toEqual([]);
      expect(
        await rows("SELECT id FROM admin_audit_log WHERE actorUserId=?", [
          actorId,
        ]),
      ).toEqual([]);
      expect(smtp.messages).toHaveLength(0);
    },
    30_000,
  );
  it("C1 persists browser blocking and unblocking without restoring revoked sessions or changing paid access", async () => {
    const {
      rows,
      connection,
      context,
      actorId,
      memberId,
      base,
      frontend,
      smtp,
    } = fixture();
    const identity = await rows(
      "SELECT id,openId,email,phone,passwordHash,role FROM users WHERE id=?",
      [memberId],
    );
    await connection.query(
      "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'binding-browser-existing-access','paid','0','2030-01-01')",
      [memberId],
    );
    const access = await rows("SELECT * FROM club_payments WHERE userId=?", [
      memberId,
    ]);
    const memberToken = await sdk.createSessionToken("binding-browser-member", {
      sessionVersion: 0,
    });
    async function memberSessionStatus() {
      return (
        await fetch(base + "/api/trpc/club.list", {
          headers: { Authorization: `Bearer ${memberToken}` },
        })
      ).status;
    }
    expect(await memberSessionStatus()).toBe(200);
    const page = await context.newPage();
    async function members() {
      await page.goto(frontend! + "admin");
      await page
        .getByRole("button", { name: "Участницы", exact: true })
        .click();
    }
    await members();
    const member = page
      .getByText("Browser phone member", { exact: true })
      .locator("..");
    page.once("dialog", (dialog) => dialog.accept("Native browser reason"));
    await member
      .getByRole("button", { name: "Заблокировать", exact: true })
      .click();
    await browserExpect(
      page.getByText("Причина: Native browser reason", { exact: true }),
    ).toBeVisible();
    const [blocked] = await rows(
      "SELECT blockedAt,blockedReason,sessionVersion FROM users WHERE id=?",
      [memberId],
    );
    expect(blocked).toEqual({
      blockedAt: expect.any(Date),
      blockedReason: "Native browser reason",
      sessionVersion: 1,
    });
    expect(await memberSessionStatus()).toBe(401);
    await members();
    await browserExpect(
      page.getByText("Причина: Native browser reason", { exact: true }),
    ).toBeVisible();
    await member
      .getByRole("button", { name: "Разблокировать", exact: true })
      .click();
    await browserExpect(
      member.getByRole("button", { name: "Заблокировать", exact: true }),
    ).toBeVisible();
    const [unblocked] = await rows(
      "SELECT blockedAt,blockedReason,sessionVersion FROM users WHERE id=?",
      [memberId],
    );
    expect(unblocked).toEqual({
      blockedAt: null,
      blockedReason: null,
      sessionVersion: 1,
    });
    expect(await memberSessionStatus()).toBe(401);
    expect(
      await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
    ).toEqual(access);
    expect(
      await rows(
        "SELECT id,openId,email,phone,passwordHash,role FROM users WHERE id=?",
        [memberId],
      ),
    ).toEqual(identity);
    expect(
      await rows(
        "SELECT action,targetId,details FROM admin_audit_log WHERE actorUserId=? ORDER BY id",
        [actorId],
      ),
    ).toEqual([
      {
        action: "block_user",
        targetId: memberId,
        details: "Native browser reason",
      },
      { action: "unblock_user", targetId: memberId, details: null },
    ]);
    expect(smtp.messages).toHaveLength(0);
  }, 30_000);
  it("C1 grants 31 days through the browser from the existing expiry and preserves the account", async () => {
    const { rows, connection, context, actorId, memberId, frontend, smtp } =
      fixture();
    await connection.query(
      "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'binding-browser-existing-access','paid','0','2030-01-01')",
      [memberId],
    );
    const identity = await rows("SELECT * FROM users WHERE id=?", [memberId]);
    const before = await rows("SELECT * FROM club_payments WHERE userId=?", [
      memberId,
    ]);
    const page = await context.newPage();
    const dialogs: string[] = [];
    await page.goto(frontend! + "admin");
    await page.getByRole("button", { name: "Участницы", exact: true }).click();
    const member = page
      .getByText("Browser phone member", { exact: true })
      .locator("..");
    page.once("dialog", (dialog) => dialog.dismiss());
    await member
      .getByRole("button", { name: "Продлить клуб", exact: true })
      .click();
    expect(
      await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
    ).toEqual(before);
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.type());
      await dialog.accept();
    });
    await member
      .getByRole("button", { name: "Продлить клуб", exact: true })
      .click();
    await browserExpect.poll(() => dialogs).toEqual(["confirm", "alert"]);
    const payments = await rows(
      "SELECT * FROM club_payments WHERE userId=? ORDER BY expiresAt",
      [memberId],
    );
    expect(payments).toHaveLength(2);
    expect(payments[0]).toEqual(before[0]);
    expect(payments[1]).toMatchObject({
      orderId: expect.stringMatching(/^admin-grant-/),
      status: "paid",
      sum: "0",
      expiresAt: new Date("2030-02-01T00:00:00.000Z"),
    });
    await page.reload();
    await page.getByRole("button", { name: "Участницы", exact: true }).click();
    await browserExpect(member.getByText(/Клуб до/)).toContainText(
      /1\s+февр\..*2030/,
    );
    expect(await rows("SELECT * FROM users WHERE id=?", [memberId])).toEqual(
      identity,
    );
    expect(
      await rows("SELECT id FROM club_payments WHERE userId=?", [actorId]),
    ).toEqual([]);
    expect(smtp.messages).toHaveLength(0);
  }, 30_000);
}
