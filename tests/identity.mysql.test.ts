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
import { eq } from "drizzle-orm";
import { users } from "../packages/database/src/schema";
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

/** Проверяет durable setup/reset ссылки, одноразовое потребление, отзыв сессий и lease-fencing email-outbox. */
describe.skipIf(!testDatabaseUrl)("durable access and password links", () => {
  let conn: mysql.Connection;
  let pool: mysql.Pool;
  let database: MySql2Database;
  /** Открывает одноразовую БД и отдельный пул, настраивает synthetic encryption-key и собственного адресата. */
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
  /** Очищает только password tokens, outbox и платежи собственного пользователя и возвращает исходную identity. */
  beforeEach(async () => {
    await conn.query("DELETE FROM password_tokens WHERE userId=778");
    await conn.query("DELETE FROM access_email_outbox WHERE userId=778");
    await conn.query("DELETE FROM club_payments WHERE userId=778");
    await conn.query(
      "UPDATE users SET passwordHash=NULL,sessionVersion=0,blockedAt=NULL,email='identity@example.test' WHERE id=778",
    );
  });
  /** Закрывает контрольное и прикладное соединения и возвращает окружение. */
  afterAll(async () => {
    await pool?.end();
    await conn?.end();
    vi.unstubAllEnvs();
  });
  /** Повторяет delivery tick до получения локально перехваченного текста письма и извлекает fragment-token. */
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
  /** Заявка восстановления не ждёт FOR UPDATE строки другого email-пользователя. */
  it("password requests do not lock a different account while searching by email", async () => {
    const guardId = -20261002;
    await conn.query(
      "INSERT INTO users (id,openId,email) VALUES (?,'identity-query-lock-fixture','lock-fixture@example.test')",
      [guardId],
    );
    const guard = await openTestDatabase();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let requested: Promise<boolean> | undefined;
    try {
      await guard.beginTransaction();
      await guard.query("SELECT id FROM users WHERE id=? FOR UPDATE", [
        guardId,
      ]);
      requested = requestPasswordEmail(database, "identity@example.test").then(
        () => true,
      );
      const completed = await Promise.race([
        requested,
        new Promise<boolean>((resolve) => {
          timer = setTimeout(() => resolve(false), 1000);
        }),
      ]);
      expect(completed).toBe(true);
    } finally {
      if (timer) clearTimeout(timer);
      await guard.rollback();
      await requested;
      await guard.end();
      await conn.query("DELETE FROM users WHERE id=?", [guardId]);
    }
  });
  /** Setup сохраняет только hash, меняет пароль один раз и увеличивает sessionVersion без автоматического входа. */
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
  /** Два одновременных потребления одного proof имеют одного победителя. */
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
  /** Expired proof и заблокированный получатель не меняют пароль. */
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
  /** Неизвестный адрес не создаёт аккаунт или email-outbox. */
  it("unknown emails create neither users nor mail", async () => {
    await requestPasswordEmail(database, "unknown@example.test");
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT COUNT(*) AS n FROM access_email_outbox WHERE email='unknown@example.test'",
    );
    expect(rows[0].n).toBe(0);
  });
  /** Запрос reset сохраняет прежний пароль и делает старую ссылку недействительной только после успешной подготовки новой. */
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
  /** Ссылка прежнего адреса не подходит после изменения email аккаунта. */
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
  /** Сбой шифрования новой ссылки откатывает подготовку, сохраняя прежний proof и credentials. */
  it("a failed reset preparation preserves the previous link and credentials", async () => {
    const oldHash = await hashPassword("old-password-123");
    await conn.query("UPDATE users SET passwordHash=? WHERE id=778", [oldHash]);
    await requestPasswordEmail(database, "identity@example.test");
    const token = await link();
    const [before] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT id,consumedAt FROM password_tokens WHERE userId=778",
    );
    vi.stubEnv("AUTH_LINK_ENCRYPTION_KEY", "invalid-test-key");
    try {
      await expect(
        requestPasswordEmail(database, "identity@example.test"),
      ).rejects.toThrow("AUTH_LINK_ENCRYPTION_KEY");
      const [after] = await conn.query<mysql.RowDataPacket[]>(
        "SELECT id,consumedAt FROM password_tokens WHERE userId=778",
      );
      expect(after).toEqual(before);
      const [outbox] = await conn.query<mysql.RowDataPacket[]>(
        "SELECT sentAt FROM access_email_outbox WHERE userId=778",
      );
      expect(outbox).toHaveLength(1);
      expect(outbox[0].sentAt).not.toBeNull();
      const [user] = await conn.query<mysql.RowDataPacket[]>(
        "SELECT passwordHash,sessionVersion FROM users WHERE id=778",
      );
      expect(user[0]).toMatchObject({
        passwordHash: oldHash,
        sessionVersion: 0,
      });
      expect(await completePassword(database, token, "new-password-123")).toBe(
        true,
      );
    } finally {
      vi.stubEnv(
        "AUTH_LINK_ENCRYPTION_KEY",
        Buffer.alloc(32, 7).toString("base64"),
      );
    }
  });
  /** Активный email lease не забирается; после expiry повтор отправляет один раз и очищает cipher. */
  it("recovers an expired mail lease but never takes an active lease", async () => {
    await requestPasswordEmail(database, "identity@example.test");
    await conn.query(
      "UPDATE access_email_outbox SET leaseId='lost-worker',leaseUntil=DATE_ADD(NOW(),INTERVAL 5 MINUTE),attempts=1 WHERE userId=778",
    );
    const delivered: string[] = [];
    /** Фиксирует Message-ID локально перехваченного письма вместо SMTP. */
    const send = async (mail: { messageId: string }) => {
      delivered.push(mail.messageId);
      return true;
    };
    await processAccessEmails(database, send, 778);
    expect(delivered).toHaveLength(0);
    await conn.query(
      "UPDATE access_email_outbox SET leaseUntil=DATE_SUB(NOW(),INTERVAL 1 MINUTE) WHERE userId=778",
    );
    await processAccessEmails(database, send, 778);
    await processAccessEmails(database, send, 778);
    expect(delivered).toHaveLength(1);
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT attempts,sentAt,lastError,leaseId,leaseUntil,payload FROM access_email_outbox WHERE userId=778",
    );
    expect(rows[0]).toMatchObject({
      attempts: 2,
      lastError: null,
      leaseId: null,
      leaseUntil: null,
    });
    expect(rows[0].sentAt).not.toBeNull();
    expect(rows[0].payload.tokenCipher).toBeUndefined();
  });
  /** Поздний failure старого sender не стирает успешный sentAt и очищенный cipher новой lease-попытки. */
  it("a late failure from an expired lease cannot erase replacement delivery", async () => {
    await requestPasswordEmail(database, "identity@example.test");
    let release!: () => void;
    let entered!: () => void;
    const sending = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    const messageIds: string[] = [];
    const staleWorker = processAccessEmails(
      database,
      async (mail) => {
        messageIds.push(mail.messageId);
        entered();
        await delayed;
        return false;
      },
      778,
    );
    try {
      // Reject promptly if the worker fails before reaching the sender.
      await Promise.race([
        sending,
        staleWorker.then(() => {
          throw new Error("Sender not reached");
        }),
      ]);
      await conn.query(
        "UPDATE access_email_outbox SET leaseUntil=DATE_SUB(NOW(),INTERVAL 1 MINUTE) WHERE userId=778",
      );
      await processAccessEmails(
        database,
        async (mail) => {
          messageIds.push(mail.messageId);
          return true;
        },
        778,
      );
    } finally {
      release();
      await staleWorker;
    }
    expect(messageIds).toHaveLength(2);
    expect(messageIds[0]).toBe(messageIds[1]);
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT attempts,sentAt,lastError,leaseId,leaseUntil,payload FROM access_email_outbox WHERE userId=778",
    );
    expect(rows[0]).toMatchObject({
      attempts: 2,
      lastError: null,
      leaseId: null,
      leaseUntil: null,
    });
    expect(rows[0].sentAt).not.toBeNull();
    expect(rows[0].payload.tokenCipher).toBeUndefined();
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
  });
  /** Просроченное письмо получает discardedAt и причину, а не ложный sentAt. */
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
  /** Resend требует staff, использует сохранённый email оплаченного адресата и пишет audit. */
  it("only explicit staff can resend access to the stored paid recipient, with an audit trail", async () => {
    await conn.query(
      "INSERT IGNORE INTO users (id,openId,email,role) VALUES (781,'resend-admin','admin@example.test','admin')",
    );
    await conn.query(
      "INSERT INTO club_payments (userId,orderId,status,expiresAt) VALUES (778,'club-778-resend','paid',DATE_ADD(NOW(),INTERVAL 30 DAY))",
    );
    const [member] = await database.select().from(users).where(eq(users.id, 778));
    const [admin] = await database.select().from(users).where(eq(users.id, 781));
    await expect(resendClubAccess(database, member, 778)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await resendClubAccess(database, admin, 778)).toBe(true);
    const [queued] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT email FROM access_email_outbox WHERE userId=778",
    );
    expect(queued[0].email).toBe("identity@example.test");
    const [audit] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT action FROM admin_audit_log WHERE actorUserId=781 AND targetId=778 ORDER BY id DESC LIMIT 1",
    );
    expect(audit[0].action).toBe("resend_club_access");
  });
  /** Отказ sender остаётся retryable, а четыре worker после backoff получают одну delivery-попытку. */
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
