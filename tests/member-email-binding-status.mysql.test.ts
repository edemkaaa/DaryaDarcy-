import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import mysql, {
  type Connection,
  type Pool,
  type RowDataPacket,
} from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { randomUUID } from "node:crypto";
import { requestMemberEmailBinding } from "../apps/backend/src/identity/email-binding";
import { getMemberEmailBindingStatus } from "../apps/backend/src/identity/email-binding-status";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";

/** Проверяет read-only receipt привязки email с актуальными admin-правами и безопасным delivery-статусом. */
describe.skipIf(!testDatabaseUrl)(
  "administrator email binding status on owned MySQL",
  () => {
    let conn: Connection;
    let pool: Pool;
    let database: MySql2Database;
    let requestKey: string;
    const actor = { userId: 91201, sessionVersion: 7 };
    /** Читает контрольное SQL-состояние для сравнения неизменности status-запроса. */
    async function rows(query: string, params: unknown[] = []) {
      return (await conn.query<RowDataPacket[]>(query, params))[0];
    }
    /** Удаляет outbox и intents своего инициатора, audit и три собственных аккаунта. */
    async function cleanup() {
      await conn.query(
        "DELETE o FROM member_email_binding_outbox o JOIN member_email_bindings b ON b.requestKey=o.requestKey WHERE b.actorUserId=91201",
      );
      await conn.query(
        "DELETE FROM member_email_bindings WHERE actorUserId=91201",
      );
      await conn.query("DELETE FROM admin_audit_log WHERE actorUserId=91201");
      await conn.query(
        "DELETE FROM users WHERE id IN (91201,91202,91203) AND openId LIKE 'binding-status-%'",
      );
    }
    /** Создаёт отдельный пул одноразовой БД и synthetic ключ шифрования ссылок. */
    beforeAll(async () => {
      conn = await openTestDatabase();
      pool = mysql.createPool({
        uri: testDatabaseUrl!,
        timezone: "Z",
        connectionLimit: 4,
      });
      database = drizzle(pool);
      vi.stubEnv(
        "AUTH_LINK_ENCRYPTION_KEY",
        Buffer.alloc(32, 29).toString("base64"),
      );
    });
    /** Восстанавливает двух администраторов и получателя и создаёт pending-intent с новым UUID. */
    beforeEach(async () => {
      await cleanup();
      await conn.query(`INSERT INTO users (id,openId,phone,sessionVersion,role) VALUES
      (91201,'binding-status-admin',NULL,7,'admin'),
      (91202,'binding-status-member','+70000091202',4,'user'),
      (91203,'binding-status-admin2',NULL,1,'admin')`);
      requestKey = randomUUID();
      await requestMemberEmailBinding(database, actor, {
        requestKey,
        userId: 91202,
        email: "binding-status@example.test",
      });
    });
    /** Удаляет fixture и закрывает оба соединения с восстановлением окружения. */
    afterAll(async () => {
      if (conn) {
        await cleanup();
        await conn.end();
      }
      await pool?.end();
      vi.unstubAllEnvs();
    });
    /** Читает receipt собственного requestKey от первого администратора. */
    const status = () =>
      getMemberEmailBindingStatus(database, actor, requestKey);

    /** Status выдаёт только согласованный receipt без email/proof и не изменяет intent, outbox, users или audit. */
    it("projects only the recoverable receipt without exposing PII/proofs or mutating data", async () => {
      const before = await rows(
        "SELECT * FROM member_email_bindings WHERE requestKey=?",
        [requestKey],
      );
      const outbox = await rows(
        "SELECT * FROM member_email_binding_outbox WHERE requestKey=?",
        [requestKey],
      );
      const users = await rows(
        "SELECT * FROM users WHERE id IN (91201,91202,91203)",
      );
      const audit = await rows(
        "SELECT * FROM admin_audit_log WHERE actorUserId=91201",
      );
      expect(await status()).toEqual({
        requestKey,
        userId: 91202,
        state: "pending",
        delivery: "queued",
        expiresAt: before[0].expiresAt.toISOString(),
        completedAt: null,
      });
      expect(
        await rows("SELECT * FROM member_email_bindings WHERE requestKey=?", [
          requestKey,
        ]),
      ).toEqual(before);
      expect(
        await rows(
          "SELECT * FROM member_email_binding_outbox WHERE requestKey=?",
          [requestKey],
        ),
      ).toEqual(outbox);
      expect(
        await rows("SELECT * FROM users WHERE id IN (91201,91202,91203)"),
      ).toEqual(users);
      expect(
        await rows("SELECT * FROM admin_audit_log WHERE actorUserId=91201"),
      ).toEqual(audit);
    });
    /** Текущий второй admin может проверить request, даже если не был инициатором. */
    it("permits a second current administrator, not only the original request actor", async () => {
      expect(
        await getMemberEmailBindingStatus(
          database,
          { userId: 91203, sessionVersion: 1 },
          requestKey,
        ),
      ).toMatchObject({ requestKey, delivery: "queued" });
    });
    /** Сохранённый sentAt остаётся sent после очистки секретов и не означает внешнюю inbox-доставку. */
    it("reports sent after terminal cleanup without claiming inbox delivery", async () => {
      await conn.query(
        "UPDATE member_email_bindings SET state='confirmed',completedAt='2026-10-10 11:00:00',email=NULL,proofHash=NULL WHERE requestKey=?",
        [requestKey],
      );
      await conn.query(
        "UPDATE member_email_binding_outbox SET sentAt='2026-10-10 10:59:00',tokenCipher=NULL,discardedAt='2026-10-10 11:00:00' WHERE requestKey=?",
        [requestKey],
      );
      expect(await status()).toMatchObject({
        state: "confirmed",
        delivery: "sent",
        completedAt: "2026-10-10T11:00:00.000Z",
      });
    });
    /** Просроченный pending читается как delivery unavailable без неявной lifecycle-мутации. */
    it("does not mutate an expired pending request during inspection", async () => {
      await conn.query(
        "UPDATE member_email_bindings SET expiresAt='2020-01-01 00:00:00' WHERE requestKey=?",
        [requestKey],
      );
      expect(await status()).toMatchObject({
        state: "pending",
        delivery: "unavailable",
        expiresAt: "2020-01-01T00:00:00.000Z",
        completedAt: null,
      });
      expect(
        (
          await rows(
            "SELECT state,proofHash,email FROM member_email_bindings WHERE requestKey=?",
            [requestKey],
          )
        )[0],
      ).toMatchObject({
        state: "pending",
        proofHash: expect.any(String),
        email: "binding-status@example.test",
      });
    });
    /** Нет cipher, discarded либо отсутствующий outbox означают unavailable вместо ложной очереди. */
    it.each([
      "UPDATE member_email_binding_outbox SET tokenCipher=NULL WHERE requestKey=?",
      "UPDATE member_email_binding_outbox SET discardedAt=CURRENT_TIMESTAMP WHERE requestKey=?",
      "DELETE FROM member_email_binding_outbox WHERE requestKey=?",
    ])("fails closed for unusable/missing delivery: %s", async (query) => {
      await conn.query(query, [requestKey]);
      expect(await status()).toMatchObject({ delivery: "unavailable" });
    });
    /** Активный lease и будущий retry остаются queued, чтение не меняет attempts и расписание. */
    it("keeps a leased retry queued without changing its attempt or schedule", async () => {
      await conn.query(
        "UPDATE member_email_binding_outbox SET leaseId=?,leaseUntil=DATE_ADD(NOW(), INTERVAL 5 MINUTE),attempts=3,nextAttemptAt=DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE requestKey=?",
        [randomUUID(), requestKey],
      );
      const before = await rows(
        "SELECT * FROM member_email_binding_outbox WHERE requestKey=?",
        [requestKey],
      );
      expect(await status()).toMatchObject({ delivery: "queued" });
      expect(
        await rows(
          "SELECT * FROM member_email_binding_outbox WHERE requestKey=?",
          [requestKey],
        ),
      ).toEqual(before);
    });
    /** Текущие роль, блокировка, удаление, openId и epoch проверяются до поиска существующего и неизвестного ключа. */
    it.each([
      "role='user'",
      "role='moderator'",
      "blockedAt=NOW()",
      "accountDeletionRequestedAt=NOW()",
      "openId='deleted-binding-status-admin'",
      "sessionVersion=8",
    ])(
      "rechecks authority before existing and absent request lookup: %s",
      async (change) => {
        await conn.query(`UPDATE users SET ${change} WHERE id=91201`);
        try {
          await expect(status()).rejects.toMatchObject({ code: "forbidden" });
          await expect(
            getMemberEmailBindingStatus(database, actor, randomUUID()),
          ).rejects.toMatchObject({ code: "forbidden" });
        } finally {
          await conn.query(
            "UPDATE users SET openId='binding-status-admin' WHERE id=91201",
          );
        }
      },
    );
    /** Удалённый инициатор не получает receipt по старому actor ID. */
    it("rejects a removed actor", async () => {
      await conn.query("DELETE FROM users WHERE id=91201");
      await expect(status()).rejects.toMatchObject({ code: "forbidden" });
    });
    /** Отсутствующий или удалённый retention запрос возвращает null. */
    it("returns no receipt for an absent or purged request", async () => {
      expect(
        await getMemberEmailBindingStatus(database, actor, randomUUID()),
      ).toBeNull();
    });
    /** Terminal state не становится queued из-за случайно оставшегося cipher. */
    it.each(["confirmed", "expired", "cancelled"])(
      "never presents a terminal %s intent as queued even if a cipher remains",
      async (state) => {
        await conn.query(
          "UPDATE member_email_bindings SET state=?,completedAt='2026-10-10 11:00:00' WHERE requestKey=?",
          [state, requestKey],
        );
        expect(await status()).toMatchObject({
          state,
          delivery: "unavailable",
          completedAt: "2026-10-10T11:00:00.000Z",
        });
      },
    );
    /** Status ждёт actor-lock и после коммита отзыва epoch отказывает прежней сессии. */
    it("waits for concurrent actor revocation and refuses the previously valid session", async () => {
      const blocker = await pool.getConnection();
      let running: Promise<unknown> | undefined;
      try {
        await blocker.beginTransaction();
        await blocker.query("UPDATE users SET sessionVersion=8 WHERE id=91201");
        running = status().catch((error) => error);
        const deadline = performance.now() + 3000;
        let waiting = false;
        while (performance.now() < deadline) {
          const waits = await rows(
            `SELECT 1 FROM performance_schema.data_lock_waits w
          JOIN information_schema.innodb_trx t ON t.trx_id=w.BLOCKING_ENGINE_TRANSACTION_ID
          WHERE t.trx_mysql_thread_id=?`,
            [blocker.threadId],
          );
          if (waits.length) {
            waiting = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        expect(waiting).toBe(true);
        await blocker.commit();
        expect(await running).toMatchObject({ code: "forbidden" });
      } finally {
        await blocker.rollback();
        blocker.release();
        await running;
      }
    });
    /** Пустые, oversized и невалидные UUID отклоняются как invalid_input. */
    it.each([
      "",
      "../users",
      "x".repeat(10000),
      "aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa",
    ])("rejects malformed lookup keys", async (key) => {
      await expect(
        getMemberEmailBindingStatus(database, actor, key),
      ).rejects.toMatchObject({ code: "invalid_input" });
    });
    /** Невалидная actor sessionVersion отклоняется до SQL. */
    it("rejects malformed actor versions before querying", async () => {
      await expect(
        getMemberEmailBindingStatus(
          database,
          { ...actor, sessionVersion: -1 },
          requestKey,
        ),
      ).rejects.toMatchObject({ code: "invalid_input" });
    });
    /** Сбой закрытого пула возвращает unavailable без SQL cause, bound UUID и деталей драйвера. */
    it("sanitizes database errors without bound values or SQL causes", async () => {
      const closed = mysql.createPool({ uri: testDatabaseUrl!, timezone: "Z" });
      await closed.end();
      const error = await getMemberEmailBindingStatus(
        drizzle(closed),
        actor,
        requestKey,
      ).catch((e) => e);
      expect(error).toMatchObject({
        code: "unavailable",
        message: "Email binding: unavailable",
      });
      expect(error.cause).toBeUndefined();
      expect(JSON.stringify(error)).not.toContain(requestKey);
    });
  },
);
