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
import type { INestApplication } from "@nestjs/common";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { WorkerJobs } from "../apps/backend/src/workers/worker-jobs.service";
import {
  WORKER_OPERATIONS,
  type WorkerOperations,
} from "../apps/backend/src/workers/worker-operations";
import { requestMemberEmailBinding } from "../apps/backend/src/identity/email-binding";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { openLoopbackSmtp } from "./helpers/loopback-smtp";

describe.skipIf(!testDatabaseUrl)(
  "binding jobs through the real worker and owned SQL/SMTP",
  () => {
    let conn: Connection, pool: Pool, database: MySql2Database;
    let smtp: Awaited<ReturnType<typeof openLoopbackSmtp>>;
    async function rows(sql: string, params: unknown[] = []) {
      return (await conn.query<RowDataPacket[]>(sql, params))[0];
    }
    async function cleanup() {
      await conn.query(
        "DELETE o FROM member_email_binding_outbox o JOIN member_email_bindings b USING(requestKey) WHERE b.actorUserId=91801",
      );
      await conn.query(
        "DELETE FROM member_email_bindings WHERE actorUserId=91801",
      );
      await conn.query("DELETE FROM admin_audit_log WHERE actorUserId=91801");
      await conn.query(
        "DELETE FROM users WHERE id IN (91801,91802) AND openId LIKE 'binding-worker-%'",
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
      smtp = await openLoopbackSmtp();
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("SMTP_HOST", "127.0.0.1");
      vi.stubEnv("SMTP_PORT", String(smtp.port));
      vi.stubEnv("SMTP_SECURE", "false");
      vi.stubEnv("SMTP_USER", "sender@example.test");
      vi.stubEnv("SMTP_PASS", "binding-worker-fixture-only");
      vi.stubEnv("SMTP_FROM", "sender@example.test");
      vi.stubEnv(
        "AUTH_LINK_ENCRYPTION_KEY",
        Buffer.alloc(32, 43).toString("base64"),
      );
      vi.stubEnv("PUBLIC_APP_URL", "https://worker.example.test");
      vi.stubEnv("PUBLIC_AUTH_URL", "");
    });
    beforeEach(async () => {
      await cleanup();
      smtp.reset();
      vi.stubEnv("MEMBER_EMAIL_BINDING_ENABLED", "true");
      await conn.query(
        "INSERT INTO users (id,openId,role,phone,passwordHash,sessionVersion) VALUES (91801,'binding-worker-admin','admin',NULL,'ADMIN_FIXTURE',0),(91802,'binding-worker-member','user','+70000091802','MEMBER_FIXTURE',2)",
      );
    });
    afterAll(async () => {
      if (conn) {
        await cleanup();
        await conn.end();
      }
      await pool?.end();
      await smtp?.close();
      vi.unstubAllEnvs();
    });
    async function queue() {
      const requestKey = randomUUID();
      await requestMemberEmailBinding(
        database,
        { userId: 91801, sessionVersion: 0 },
        { userId: 91802, email: "binding-worker@example.test", requestKey },
      );
      return requestKey;
    }
    async function cycle() {
      let application: INestApplication | undefined,
        jobs: WorkerJobs | undefined;
      try {
        application = await createBackendApplication();
        const operations = application.get<WorkerOperations>(WORKER_OPERATIONS);
        // Only unrelated effects are replaced. Binding helpers and sender are real.
        Object.assign(operations, {
          getDb: async () => database,
          publishDueScheduledPosts: async () => [],
          sendMarketingPostNotification: async () => {},
          processCancellations: async () => {},
          cancelProdamusSubscription: async () => false,
          processAccessEmails: async () => {},
          processPendingShopDeliveryEmails: async () => {},
          runDataRetentionMaintenance: async () => {},
          runMysqlBackupIfDue: async () => {},
        });
        jobs = application.get<WorkerJobs>(WorkerJobs);
        jobs.start();
        await new Promise<void>((done) => setImmediate(done));
        await Promise.all(jobs.stop().map((item) => item.settled));
      } finally {
        await Promise.all((jobs?.stop() ?? []).map((item) => item.settled));
        await application?.close();
      }
    }
    it("enabled worker delivers a pending binding without changing identity or access", async () => {
      const key = await queue();
      const identity = await rows(
        "SELECT id,openId,email,phone,passwordHash,sessionVersion,role FROM users WHERE id=91802",
      );
      await cycle();
      expect(smtp.messages).toHaveLength(1);
      expect(
        await rows(
          "SELECT attempts,tokenCipher,sentAt IS NOT NULL AS sent FROM member_email_binding_outbox WHERE requestKey=?",
          [key],
        ),
      ).toEqual([{ attempts: 1, tokenCipher: null, sent: 1 }]);
      expect(
        await rows(
          "SELECT id,openId,email,phone,passwordHash,sessionVersion,role FROM users WHERE id=91802",
        ),
      ).toEqual(identity);
      expect(
        await rows("SELECT id FROM club_payments WHERE userId=91802"),
      ).toEqual([]);
    });
    it.each(["", "false", "1"])(
      "binding jobs remain disabled for flag=%s",
      async (flag) => {
        const key = await queue();
        vi.stubEnv("MEMBER_EMAIL_BINDING_ENABLED", flag);
        await cycle();
        expect(smtp.messages).toEqual([]);
        expect(
          await rows(
            "SELECT attempts,sentAt FROM member_email_binding_outbox WHERE requestKey=?",
            [key],
          ),
        ).toEqual([{ attempts: 0, sentAt: null }]);
      },
    );
    it("retries SMTP refusal only after the persisted delay", async () => {
      const key = await queue();
      smtp.rejectRecipients(true);
      await cycle();
      expect(
        await rows(
          "SELECT attempts,lastError,sentAt FROM member_email_binding_outbox WHERE requestKey=?",
          [key],
        ),
      ).toEqual([{ attempts: 1, lastError: "delivery_failed", sentAt: null }]);
      await cycle();
      expect(
        await rows(
          "SELECT attempts FROM member_email_binding_outbox WHERE requestKey=?",
          [key],
        ),
      ).toEqual([{ attempts: 1 }]);
      expect(smtp.messages).toEqual([]);
      await conn.query(
        "UPDATE member_email_binding_outbox SET nextAttemptAt=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE requestKey=?",
        [key],
      );
      smtp.rejectRecipients(false);
      await cycle();
      expect(smtp.messages).toHaveLength(1);
      expect(
        await rows(
          "SELECT attempts,sentAt IS NOT NULL AS sent FROM member_email_binding_outbox WHERE requestKey=?",
          [key],
        ),
      ).toEqual([{ attempts: 2, sent: 1 }]);
    });
    it("expires proofs and purges terminal history through the scheduled worker", async () => {
      const key = await queue();
      await conn.query(
        "UPDATE member_email_bindings SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE requestKey=?",
        [key],
      );
      await cycle();
      expect(smtp.messages).toEqual([]);
      expect(
        await rows(
          "SELECT state,email,proofHash FROM member_email_bindings WHERE requestKey=?",
          [key],
        ),
      ).toEqual([{ state: "expired", email: null, proofHash: null }]);
      expect(
        await rows(
          "SELECT tokenCipher,attempts FROM member_email_binding_outbox WHERE requestKey=?",
          [key],
        ),
      ).toEqual([{ tokenCipher: null, attempts: 0 }]);
      await conn.query(
        "UPDATE member_email_bindings SET completedAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE requestKey=?",
        [key],
      );
      await cycle();
      expect(
        await rows(
          "SELECT requestKey FROM member_email_bindings WHERE requestKey=?",
          [key],
        ),
      ).toEqual([]);
      expect(
        await rows(
          "SELECT requestKey FROM member_email_binding_outbox WHERE requestKey=?",
          [key],
        ),
      ).toEqual([]);
    });
    it.each(["outbox", "identity-index", "proof-index", "identity-definition"])(
      "refuses partial schema (%s) before cleanup or delivery",
      async (part) => {
        const key = await queue();
        await conn.query(
          "UPDATE member_email_bindings SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE requestKey=?",
          [key],
        );
        const before = await rows(
          "SELECT * FROM member_email_bindings WHERE requestKey=?",
          [key],
        );
        const remove =
          part === "outbox"
            ? "RENAME TABLE member_email_binding_outbox TO member_email_binding_outbox_worker_missing"
            : part === "identity-index" || part === "identity-definition"
              ? "DROP INDEX users_email_identity_unique ON users"
              : "DROP INDEX member_email_bindings_proofHash_unique ON member_email_bindings";
        const restore =
          part === "outbox"
            ? "RENAME TABLE member_email_binding_outbox_worker_missing TO member_email_binding_outbox"
            : part === "identity-index" || part === "identity-definition"
              ? "CREATE UNIQUE INDEX users_email_identity_unique ON users ((NULLIF(LOWER(TRIM(email)),'')))"
              : "CREATE UNIQUE INDEX member_email_bindings_proofHash_unique ON member_email_bindings (proofHash)";
        await conn.query(remove);
        let replacementCreated = false;
        try {
          if (part === "identity-definition") {
            await conn.query(
              "CREATE UNIQUE INDEX users_email_identity_unique ON users (email)",
            );
            replacementCreated = true;
          }
          await cycle();
          expect(smtp.messages).toEqual([]);
          expect(
            await rows(
              "SELECT * FROM member_email_bindings WHERE requestKey=?",
              [key],
            ),
          ).toEqual(before);
        } finally {
          if (replacementCreated) {
            await conn.query("DROP INDEX users_email_identity_unique ON users");
          }
          await conn.query(restore);
        }
      },
    );
  },
);
