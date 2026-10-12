import {
  afterAll,
  afterEach,
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
import { maintainMemberEmailBindings } from "../apps/backend/src/identity/email-binding-lifecycle";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";

describe.skipIf(!testDatabaseUrl)(
  "email binding lifecycle on owned MySQL",
  () => {
    let conn: Connection;
    let pool: Pool;
    let database: MySql2Database;
    const actor = { userId: 91001, sessionVersion: 2 };
    async function rows(query: string, params: unknown[] = []) {
      return (await conn.query<RowDataPacket[]>(query, params))[0];
    }
    async function cleanup() {
      await conn.query(
        "DROP TRIGGER IF EXISTS email_binding_lifecycle_audit_failure",
      );
      await conn.query(
        "DELETE o FROM member_email_binding_outbox o JOIN member_email_bindings b ON b.requestKey=o.requestKey WHERE b.actorUserId=91001",
      );
      await conn.query(
        "DELETE FROM member_email_bindings WHERE actorUserId=91001",
      );
      await conn.query("DELETE FROM admin_audit_log WHERE actorUserId=91001");
      await conn.query(
        "DELETE FROM users WHERE id IN (91001,91002,91003) AND openId LIKE 'email-binding-lifecycle-%'",
      );
    }
    beforeAll(async () => {
      conn = await openTestDatabase();
      pool = mysql.createPool({
        uri: testDatabaseUrl!,
        timezone: "Z",
        connectionLimit: 8,
      });
      database = drizzle(pool);
    });
    beforeEach(async () => {
      await cleanup();
      await conn.query(`INSERT INTO users (id,openId,phone,passwordHash,sessionVersion,role,updatedAt) VALUES
      (91001,'email-binding-lifecycle-admin',NULL,'ADMIN_HASH',2,'admin','2020-01-01'),
      (91002,'email-binding-lifecycle-member','+70000091002','MEMBER_HASH',5,'user','2020-01-01'),
      (91003,'email-binding-lifecycle-neighbor','+70000091003','NEIGHBOR_HASH',6,'user','2020-01-01')`);
      vi.stubEnv(
        "AUTH_LINK_ENCRYPTION_KEY",
        Buffer.alloc(32, 32).toString("base64"),
      );
    });
    afterAll(async () => {
      if (conn) {
        await cleanup();
        await conn.end();
      }
      if (pool) await pool.end();
      vi.unstubAllEnvs();
    });
    afterEach(() => vi.useRealTimers());
    async function queue(userId = 91002) {
      const requestKey = randomUUID();
      await requestMemberEmailBinding(database, actor, {
        userId,
        email: `lifecycle-${userId}@example.test`,
        requestKey,
      });
      return requestKey;
    }
    async function binding(requestKey: string) {
      return (
        await rows(
          "SELECT b.*,o.tokenCipher,o.leaseId,o.leaseUntil,o.discardedAt FROM member_email_bindings b JOIN member_email_binding_outbox o ON o.requestKey=b.requestKey WHERE b.requestKey=?",
          [requestKey],
        )
      )[0];
    }
    it("expires unused proofs, scrubs delivery secrets, and permits a fresh intent without modifying accounts", async () => {
      const expired = await queue();
      const neighbor = await queue(91003);
      const before = await rows(
        "SELECT * FROM users WHERE id BETWEEN 91001 AND 91003",
      );
      const untouched = await binding(neighbor);
      await conn.query(
        "UPDATE member_email_bindings SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE requestKey=?",
        [expired],
      );
      await conn.query(
        "UPDATE member_email_binding_outbox SET leaseId=?,leaseUntil=DATE_ADD(NOW(),INTERVAL 1 MINUTE) WHERE requestKey=?",
        [randomUUID(), expired],
      );
      expect(await maintainMemberEmailBindings(database)).toEqual({
        expired: 1,
        purged: 0,
      });
      expect(await binding(expired)).toMatchObject({
        state: "expired",
        email: null,
        proofHash: null,
        tokenCipher: null,
        leaseId: null,
        leaseUntil: null,
        completedAt: expect.any(Date),
        discardedAt: expect.any(Date),
      });
      expect(await binding(neighbor)).toEqual(untouched);
      expect(
        await rows("SELECT * FROM users WHERE id BETWEEN 91001 AND 91003"),
      ).toEqual(before);
      expect(
        await rows(
          "SELECT action,targetId,details FROM admin_audit_log WHERE actorUserId=91001 AND action='expire_member_email_binding'",
        ),
      ).toEqual([
        {
          action: "expire_member_email_binding",
          targetId: 91002,
          details: null,
        },
      ]);
      await queue();
      expect(await maintainMemberEmailBindings(database)).toEqual({
        expired: 0,
        purged: 0,
      });
    });
    it.each(["confirmed", "expired", "cancelled"])(
      "purges %s history only after 30 days, including its outbox",
      async (state) => {
        const old = await queue();
        const recent = await queue(91003);
        await conn.query(
          "UPDATE member_email_bindings SET state=?,email=NULL,proofHash=NULL,completedAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE requestKey=?",
          [state, old],
        );
        await conn.query(
          "UPDATE member_email_bindings SET state=?,email=NULL,proofHash=NULL,completedAt=DATE_SUB(NOW(),INTERVAL 29 DAY) WHERE requestKey=?",
          [state, recent],
        );
        const before = await binding(recent);
        expect(await maintainMemberEmailBindings(database)).toEqual({
          expired: 0,
          purged: 1,
        });
        expect(
          await rows("SELECT * FROM member_email_bindings WHERE requestKey=?", [
            old,
          ]),
        ).toEqual([]);
        expect(
          await rows(
            "SELECT * FROM member_email_binding_outbox WHERE requestKey=?",
            [old],
          ),
        ).toEqual([]);
        expect(await binding(recent)).toEqual(before);
      },
    );
    it("rolls back expiry and scrubbing when the audit cannot be persisted", async () => {
      const key = await queue();
      await conn.query(
        "UPDATE member_email_bindings SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 DAY) WHERE requestKey=?",
        [key],
      );
      const before = await binding(key);
      await conn.query(`CREATE TRIGGER email_binding_lifecycle_audit_failure BEFORE INSERT ON admin_audit_log FOR EACH ROW BEGIN
      IF NEW.actorUserId=91001 AND NEW.action='expire_member_email_binding' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='private lifecycle SQL detail'; END IF; END`);
      await expect(maintainMemberEmailBindings(database)).rejects.toMatchObject(
        { code: "unavailable" },
      );
      expect(await binding(key)).toEqual(before);
    });
    it("bounds each pass and concurrent cleaners never expire an intent twice", async () => {
      await queue();
      await queue(91003);
      await conn.query(
        "UPDATE member_email_bindings SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 DAY) WHERE actorUserId=91001",
      );
      expect(await maintainMemberEmailBindings(database, 1)).toEqual({
        expired: 1,
        purged: 0,
      });
      const results = await Promise.all([
        maintainMemberEmailBindings(database),
        maintainMemberEmailBindings(database),
      ]);
      expect(results.reduce((count, result) => count + result.expired, 0)).toBe(
        1,
      );
      expect(
        await rows(
          "SELECT * FROM admin_audit_log WHERE actorUserId=91001 AND action='expire_member_email_binding'",
        ),
      ).toHaveLength(2);
    });
    it("includes the exact expiry and 30-day retention boundaries", async () => {
      const expired = await queue();
      const old = await queue(91003);
      const now = new Date("2026-10-10T12:00:00Z");
      await conn.query(
        "UPDATE member_email_bindings SET expiresAt=? WHERE requestKey=?",
        [now, expired],
      );
      await conn.query(
        "UPDATE member_email_bindings SET state='confirmed',completedAt='2026-09-10 12:00:00' WHERE requestKey=?",
        [old],
      );
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(now);
      expect(await maintainMemberEmailBindings(database)).toEqual({
        expired: 1,
        purged: 1,
      });
    });
    it("re-reads lifecycle state after waiting for the recipient lock", async () => {
      const key = await queue();
      await conn.query(
        "UPDATE member_email_bindings SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 DAY) WHERE requestKey=?",
        [key],
      );
      const blocker = await pool.getConnection();
      let running: Promise<{ expired: number; purged: number }> | undefined;
      try {
        await blocker.beginTransaction();
        await blocker.query("SELECT id FROM users WHERE id=91002 FOR UPDATE");
        running = maintainMemberEmailBindings(database);
        const deadline = performance.now() + 3000;
        let waiting = false;
        while (performance.now() < deadline) {
          const waits = await rows(
            `SELECT 1 FROM performance_schema.data_lock_waits w JOIN information_schema.innodb_trx t
          ON t.trx_id=w.BLOCKING_ENGINE_TRANSACTION_ID WHERE t.trx_mysql_thread_id=?`,
            [blocker.threadId],
          );
          if (waits.length) {
            waiting = true;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        expect(waiting).toBe(true);
        // Simulate another owner of the locked lifecycle completing the proof.
        await blocker.query(
          "UPDATE member_email_bindings SET state='confirmed',email=NULL,proofHash=NULL,completedAt=NOW() WHERE requestKey=?",
          [key],
        );
        await blocker.query(
          "UPDATE member_email_binding_outbox SET tokenCipher=NULL,discardedAt=NOW() WHERE requestKey=?",
          [key],
        );
        await blocker.commit();
        expect(await running).toEqual({ expired: 0, purged: 0 });
        expect(await binding(key)).toMatchObject({ state: "confirmed" });
      } finally {
        await blocker.rollback();
        blocker.release();
        await running?.catch(() => undefined);
      }
    });
    it.each([0, -1, 101, 1.5, NaN, Infinity])(
      "rejects an invalid batch size without modifying an intent (%s)",
      async (limit) => {
        const key = await queue();
        const before = await binding(key);
        await expect(
          maintainMemberEmailBindings(database, limit),
        ).rejects.toMatchObject({ code: "invalid_input" });
        expect(await binding(key)).toEqual(before);
      },
    );
  },
);
