import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import mysql from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import {
  requestPasswordEmail,
  completePassword,
  processAccessEmails,
  queueAccessEmail,
  resendClubAccess,
} from "../apps/backend/src/identity/access";
import {
  hashPassword,
  verifyPassword,
} from "../apps/backend/src/_core/password";

describe.skipIf(!testDatabaseUrl)("durable access and password links", () => {
  let conn: mysql.Connection;
  let pool: mysql.Pool;
  let database: MySql2Database;
  beforeAll(async () => {
    conn = await openTestDatabase();
    pool = mysql.createPool({ uri: testDatabaseUrl!, timezone: "Z" });
    database = drizzle(pool);
    vi.stubEnv(
      "AUTH_LINK_ENCRYPTION_KEY",
      Buffer.alloc(32, 7).toString("base64"),
    );
    vi.stubEnv("PUBLIC_APP_URL", "https://app.example.test");
    await conn.query(
      "INSERT IGNORE INTO users (id,openId,email) VALUES (778,'identity-test','identity@example.test')",
    );
  });
  beforeEach(async () => {
    await conn.query("DELETE FROM password_tokens WHERE userId=778");
    await conn.query("DELETE FROM access_email_outbox WHERE userId=778");
    await conn.query("DELETE FROM club_payments WHERE userId=778");
    await conn.query(
      "UPDATE users SET passwordHash=NULL,sessionVersion=0,blockedAt=NULL,email='identity@example.test' WHERE id=778",
    );
  });
  afterAll(async () => {
    await pool?.end();
    await conn?.end();
    vi.unstubAllEnvs();
  });
  async function link() {
    let body = "";
    // SKIP LOCKED may legitimately defer a row while another worker scans the
    // shared due index. Drive subsequent ticks until delivery, not a fixed delay.
    await vi.waitFor(
      async () => {
        if (!body)
          await processAccessEmails(
            database,
            async (mail) => {
              body = mail.text;
              return true;
            },
            778,
          );
        expect(body).not.toBe("");
      },
      { timeout: 3000, interval: 20 },
    );
    return new URL(body.match(/https:\/\/\S+/)![0]).hash.slice(
      "#token=".length,
    );
  }
  it("queues a private setup link, consumed once without logging in", async () => {
    await requestPasswordEmail(database, "identity@example.test");
    const token = await link();
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT tokenHash FROM password_tokens WHERE userId=778",
    );
    expect(rows[0].tokenHash).not.toContain(token);
    expect(await completePassword(database, token, "new-password-123")).toBe(
      true,
    );
    expect(await completePassword(database, token, "attacker-password")).toBe(
      false,
    );
    const [user] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT passwordHash,sessionVersion FROM users WHERE id=778",
    );
    expect(await verifyPassword("new-password-123", user[0].passwordHash)).toBe(
      true,
    );
    expect(user[0].sessionVersion).toBe(1);
  });
  it("concurrent use of a link has exactly one winner", async () => {
    await requestPasswordEmail(database, "identity@example.test");
    const token = await link();
    expect(
      (
        await Promise.all([
          completePassword(database, token, "password-first"),
          completePassword(database, token, "password-second"),
        ])
      ).filter(Boolean),
    ).toHaveLength(1);
  });
  it("expired and blocked links cannot change the password", async () => {
    await requestPasswordEmail(database, "identity@example.test");
    const token = await link();
    await conn.query(
      "UPDATE password_tokens SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 MINUTE) WHERE userId=778",
    );
    expect(await completePassword(database, token, "new-password-123")).toBe(
      false,
    );
    await requestPasswordEmail(database, "identity@example.test");
    const fresh = await link();
    await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=778");
    expect(await completePassword(database, fresh, "new-password-123")).toBe(
      false,
    );
  });
  it("unknown emails create neither users nor mail", async () => {
    await requestPasswordEmail(database, "unknown@example.test");
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM access_email_outbox WHERE email='unknown@example.test'",
    );
    expect(rows[0].n).toBe(0);
  });
  it("a reset does not overwrite the password before proof, and supersedes older links", async () => {
    const oldHash = await hashPassword("old-password-123");
    await conn.query("UPDATE users SET passwordHash=? WHERE id=778", [oldHash]);
    await requestPasswordEmail(database, "identity@example.test");
    const old = await link();
    await requestPasswordEmail(database, "identity@example.test");
    const current = await link();
    const [before] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT passwordHash FROM users WHERE id=778",
    );
    expect(before[0].passwordHash).toBe(oldHash);
    expect(await completePassword(database, old, "new-password-123")).toBe(
      false,
    );
    expect(await completePassword(database, current, "new-password-123")).toBe(
      true,
    );
  });
  it("a link sent to the old email cannot change the account after an email change", async () => {
    await requestPasswordEmail(database, "identity@example.test");
    const token = await link();
    await conn.query(
      "UPDATE users SET email='new-identity@example.test' WHERE id=778",
    );
    expect(await completePassword(database, token, "new-password-123")).toBe(
      false,
    );
  });
  it("expired mail is explicitly discarded, never recorded as delivered", async () => {
    await requestPasswordEmail(database, "identity@example.test");
    await conn.query(
      "UPDATE password_tokens SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 MINUTE) WHERE userId=778",
    );
    let sends = 0;
    await processAccessEmails(
      database,
      async () => {
        sends++;
        return true;
      },
      778,
    );
    expect(sends).toBe(0);
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT sentAt,discardedAt,lastError FROM access_email_outbox WHERE userId=778",
    );
    expect(rows[0].sentAt).toBeNull();
    expect(rows[0].discardedAt).not.toBeNull();
    expect(rows[0].lastError).toBe("link_expired_or_consumed");
  });
  it("only explicit staff can resend access to the stored paid recipient, with an audit trail", async () => {
    await conn.query(
      "INSERT IGNORE INTO users (id,openId,email,role) VALUES (781,'resend-admin','admin@example.test','admin')",
    );
    await conn.query(
      "INSERT INTO club_payments (userId,orderId,status,expiresAt) VALUES (778,'club-778-resend','paid',DATE_ADD(NOW(),INTERVAL 30 DAY))",
    );
    expect(await resendClubAccess(database, 778, 778)).toBe(false);
    expect(await resendClubAccess(database, 781, 778)).toBe(true);
    const [queued] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT email FROM access_email_outbox WHERE userId=778",
    );
    expect(queued[0].email).toBe("identity@example.test");
    const [audit] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT action FROM admin_audit_log WHERE actorUserId=781 AND targetId=778 ORDER BY id DESC LIMIT 1",
    );
    expect(audit[0].action).toBe("resend_club_access");
  });
  it("SMTP failure remains queued; parallel workers send one message", async () => {
    await database.transaction(async (tx) => {
      await queueAccessEmail(
        tx,
        778,
        "identity@example.test",
        "club-access",
        "test-payment",
        "club-778-a",
      );
    });
    await processAccessEmails(database, async () => false, 778);
    const [retry] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT sentAt,attempts FROM access_email_outbox WHERE userId=778",
    );
    expect(retry[0]).toMatchObject({ sentAt: null, attempts: 1 });
    await conn.query(
      "UPDATE access_email_outbox SET nextAttemptAt=NOW() WHERE userId=778",
    );
    let count = 0;
    await Promise.all(
      Array.from({ length: 4 }, () =>
        processAccessEmails(
          database,
          async () => {
            count++;
            return true;
          },
          778,
        ),
      ),
    );
    expect(count).toBe(1);
    const [sent] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT payload,sentAt FROM access_email_outbox WHERE userId=778",
    );
    expect(sent[0].sentAt).not.toBeNull();
    expect(sent[0].payload.tokenCipher).toBeUndefined();
  });
});
