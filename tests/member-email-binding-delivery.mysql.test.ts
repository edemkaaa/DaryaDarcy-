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
import { confirmMemberEmailBinding } from "../apps/backend/src/identity/email-binding-confirmation";
import { processMemberEmailBindingEmails } from "../apps/backend/src/identity/email-binding-delivery";
import { sendTransactionalEmail } from "../apps/backend/src/_core/email";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { openLoopbackSmtp } from "./helpers/loopback-smtp";

describe.skipIf(!testDatabaseUrl)(
  "binding proof delivery through MySQL and loopback SMTP",
  () => {
    let conn: Connection, pool: Pool, database: MySql2Database;
    let smtp: Awaited<ReturnType<typeof openLoopbackSmtp>>;
    async function rows(query: string, values: unknown[] = []) {
      return (await conn.query<RowDataPacket[]>(query, values))[0];
    }
    async function cleanup() {
      await conn.query("DROP TRIGGER IF EXISTS binding_delivery_ack_failure");
      await conn.query(
        "DELETE o FROM member_email_binding_outbox o JOIN member_email_bindings b ON o.requestKey=b.requestKey WHERE b.actorUserId=91101",
      );
      await conn.query(
        "DELETE FROM member_email_bindings WHERE actorUserId=91101",
      );
      await conn.query("DELETE FROM admin_audit_log WHERE actorUserId=91101");
      await conn.query(
        "DELETE FROM users WHERE id IN (91101,91102) AND openId LIKE 'binding-delivery-%'",
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
      vi.stubEnv("SMTP_HOST", "127.0.0.1");
      vi.stubEnv("SMTP_PORT", String(smtp.port));
      vi.stubEnv("SMTP_SECURE", "false");
      vi.stubEnv("SMTP_USER", "sender@example.test");
      vi.stubEnv("SMTP_PASS", "fixture-only-smtp-password");
      vi.stubEnv("SMTP_FROM", "sender@example.test");
    });
    beforeEach(async () => {
      await cleanup();
      smtp.reset();
      vi.stubEnv(
        "AUTH_LINK_ENCRYPTION_KEY",
        Buffer.alloc(32, 34).toString("base64"),
      );
      vi.stubEnv(
        "PUBLIC_APP_URL",
        "https://darcy.example.test/ignored?foo=bar",
      );
      vi.stubEnv("PUBLIC_AUTH_URL", "");
      await conn.query(`INSERT INTO users (id,openId,phone,role,sessionVersion) VALUES
      (91101,'binding-delivery-admin',NULL,'admin',0), (91102,'binding-delivery-member','+70000091102','user',2)`);
    });
    afterEach(() => vi.restoreAllMocks());
    afterAll(async () => {
      if (conn) {
        await cleanup();
        await conn.end();
      }
      if (pool) await pool.end();
      if (smtp) await smtp.close();
      vi.unstubAllEnvs();
    });
    async function queue() {
      const requestKey = randomUUID();
      await requestMemberEmailBinding(
        database,
        { userId: 91101, sessionVersion: 0 },
        {
          userId: 91102,
          email: "binding-delivery@example.test",
          requestKey,
        },
      );
      return requestKey;
    }
    async function status(key: string) {
      return (
        await rows(
          "SELECT b.state,b.email,b.proofHash,o.* FROM member_email_bindings b JOIN member_email_binding_outbox o ON o.requestKey=b.requestKey WHERE b.requestKey=?",
          [key],
        )
      )[0];
    }
    function emailedProof() {
      const decoded = smtp.messages[0]
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
      const match = decoded.match(
        /https:\/\/darcy\.example\.test\/api\/auth\/email-binding#token=([A-Za-z0-9_-]{43})/,
      );
      expect(match).not.toBeNull();
      return match![1];
    }
    it("delivers a single-use fragment proof, clears its cipher and leaves the account unchanged until confirmation", async () => {
      const key = await queue();
      const before = await rows("SELECT * FROM users WHERE id=91102");
      await processMemberEmailBindingEmails(database, sendTransactionalEmail);
      expect(smtp.recipients).toEqual([
        "RCPT TO:<binding-delivery@example.test>",
      ]);
      expect(smtp.messages).toHaveLength(1);
      expect(await status(key)).toMatchObject({
        state: "pending",
        attempts: 1,
        sentAt: expect.any(Date),
        tokenCipher: null,
        leaseId: null,
        leaseUntil: null,
      });
      expect(await rows("SELECT * FROM users WHERE id=91102")).toEqual(before);
      const token = emailedProof();
      expect(await confirmMemberEmailBinding(database, token)).toBe(true);
      expect(await confirmMemberEmailBinding(database, token)).toBe(false);
      await processMemberEmailBindingEmails(database, sendTransactionalEmail);
      expect(smtp.messages).toHaveLength(1);
    });
    it("keeps an SMTP rejection retryable without changing its proof or sending on the backoff interval", async () => {
      const key = await queue();
      const before = await status(key);
      smtp.rejectRecipients(true);
      vi.spyOn(console, "error").mockImplementation(() => {});
      await processMemberEmailBindingEmails(database, sendTransactionalEmail);
      expect(await status(key)).toMatchObject({
        attempts: 1,
        sentAt: null,
        tokenCipher: before.tokenCipher,
        proofHash: before.proofHash,
        leaseId: null,
        lastError: "delivery_failed",
      });
      await processMemberEmailBindingEmails(database, sendTransactionalEmail);
      expect((await status(key)).attempts).toBe(1);
      smtp.rejectRecipients(false);
      await conn.query(
        "UPDATE member_email_binding_outbox SET nextAttemptAt=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE requestKey=?",
        [key],
      );
      await processMemberEmailBindingEmails(database, sendTransactionalEmail);
      expect(smtp.messages).toHaveLength(1);
      expect(await status(key)).toMatchObject({
        attempts: 2,
        sentAt: expect.any(Date),
        tokenCipher: null,
      });
    });
    it.each(["blocked", "deleting", "expired", "bound"])(
      "discards a %s recipient proof without an SMTP request",
      async (condition) => {
        const key = await queue();
        if (condition === "blocked")
          await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=91102");
        if (condition === "deleting")
          await conn.query(
            "UPDATE users SET accountDeletionRequestedAt=NOW() WHERE id=91102",
          );
        if (condition === "bound")
          await conn.query(
            "UPDATE users SET email='already-bound@example.test' WHERE id=91102",
          );
        if (condition === "expired")
          await conn.query(
            "UPDATE member_email_bindings SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE requestKey=?",
            [key],
          );
        await processMemberEmailBindingEmails(database, sendTransactionalEmail);
        expect(await status(key)).toMatchObject({
          state: condition === "expired" ? "expired" : "cancelled",
          tokenCipher: null,
          proofHash: null,
          email: null,
        });
        expect(smtp.recipients).toEqual([]);
      },
    );
    it("two concurrent workers deliver one message", async () => {
      const key = await queue();
      await Promise.all([
        processMemberEmailBindingEmails(database, sendTransactionalEmail),
        processMemberEmailBindingEmails(database, sendTransactionalEmail),
      ]);
      expect(smtp.messages).toHaveLength(1);
      expect(await status(key)).toMatchObject({
        attempts: 1,
        sentAt: expect.any(Date),
        tokenCipher: null,
      });
    });
    it.each(["expired", "replaced", "cancelled"] as const)(
      "does not send a paused claim after it becomes %s",
      async (change) => {
        const key = await queue();
        let claimed!: () => void, resume!: () => void;
        const ready = new Promise<void>((resolve) => {
          claimed = resolve;
        });
        const gate = new Promise<void>((resolve) => {
          resume = resolve;
        });
        let paused = false;
        // Pause after the real claim commits; a second worker uses real SQL/SMTP.
        const slow = new Proxy(database, {
          get(target, property) {
            if (property === "transaction")
              return async (
                ...args: Parameters<typeof database.transaction>
              ) => {
                const result = await Reflect.apply(
                  target.transaction,
                  target,
                  args,
                );
                if (
                  !paused &&
                  result &&
                  typeof result === "object" &&
                  "binding" in result
                ) {
                  paused = true;
                  claimed();
                  await gate;
                }
                return result;
              };
            const value = Reflect.get(target, property);
            return typeof value === "function" ? value.bind(target) : value;
          },
        });
        const pending = processMemberEmailBindingEmails(
          slow,
          sendTransactionalEmail,
        );
        try {
          await Promise.race([
            ready,
            pending.then(() => {
              throw Error("Claim was not paused");
            }),
          ]);
          if (change === "cancelled") {
            await conn.query(
              "UPDATE member_email_bindings SET state='cancelled' WHERE requestKey=?",
              [key],
            );
          } else {
            await conn.query(
              "UPDATE member_email_binding_outbox SET leaseUntil=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE requestKey=?",
              [key],
            );
            if (change === "replaced")
              await processMemberEmailBindingEmails(
                database,
                sendTransactionalEmail,
              );
          }
          resume();
          await pending;
          expect(smtp.messages).toHaveLength(change === "replaced" ? 1 : 0);
          if (change === "expired") {
            expect(await status(key)).toMatchObject({ sentAt: null });
            await processMemberEmailBindingEmails(
              database,
              sendTransactionalEmail,
            );
            expect(smtp.messages).toHaveLength(1);
          }
        } finally {
          resume();
          await pending.catch(() => {});
        }
      },
    );
    it("recovers a crashed lease only after expiry", async () => {
      const key = await queue();
      await conn.query(
        "UPDATE member_email_binding_outbox SET attempts=1,leaseId=?,leaseUntil=DATE_ADD(NOW(),INTERVAL 1 MINUTE) WHERE requestKey=?",
        [randomUUID(), key],
      );
      await processMemberEmailBindingEmails(database, sendTransactionalEmail);
      expect(smtp.messages).toEqual([]);
      await conn.query(
        "UPDATE member_email_binding_outbox SET leaseUntil=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE requestKey=?",
        [key],
      );
      await processMemberEmailBindingEmails(database, sendTransactionalEmail);
      expect(smtp.messages).toHaveLength(1);
      expect(await status(key)).toMatchObject({
        attempts: 2,
        tokenCipher: null,
        sentAt: expect.any(Date),
      });
    });
    it("does not let a stale acknowledgement overwrite a replacement lease", async () => {
      const key = await queue();
      const replacement = randomUUID();
      await processMemberEmailBindingEmails(database, async (mail) => {
        const accepted = await sendTransactionalEmail(mail);
        await conn.query(
          "UPDATE member_email_binding_outbox SET leaseId=?,leaseUntil=DATE_ADD(NOW(),INTERVAL 1 MINUTE) WHERE requestKey=?",
          [replacement, key],
        );
        return accepted;
      });
      expect(smtp.messages).toHaveLength(1);
      expect(await status(key)).toMatchObject({
        sentAt: null,
        leaseId: replacement,
        tokenCipher: expect.any(String),
      });
    });
    it("does not resurrect a proof confirmed before its SMTP acknowledgement is recorded", async () => {
      const key = await queue();
      await processMemberEmailBindingEmails(database, async (mail) => {
        const accepted = await sendTransactionalEmail(mail);
        expect(await confirmMemberEmailBinding(database, emailedProof())).toBe(
          true,
        );
        return accepted;
      });
      expect(await status(key)).toMatchObject({
        state: "confirmed",
        tokenCipher: null,
        proofHash: null,
        email: null,
        leaseId: null,
        sentAt: null,
        discardedAt: expect.any(Date),
      });
    });
    it.each([
      "missing-key",
      "bad-url",
      "corrupt-cipher",
      "different-proof",
      "different-intent",
    ])("never sends unverified proof material (%s)", async (condition) => {
      const key = await queue();
      if (condition === "missing-key")
        vi.stubEnv("AUTH_LINK_ENCRYPTION_KEY", "");
      if (condition === "bad-url")
        vi.stubEnv("PUBLIC_APP_URL", "https://username:password@example.test");
      if (condition === "corrupt-cipher")
        await conn.query(
          "UPDATE member_email_binding_outbox SET tokenCipher='broken' WHERE requestKey=?",
          [key],
        );
      if (condition === "different-proof")
        await conn.query(
          "UPDATE member_email_bindings SET proofHash=? WHERE requestKey=?",
          ["f".repeat(64), key],
        );
      if (condition === "different-intent")
        await conn.query(
          "UPDATE member_email_bindings SET payloadHash=? WHERE requestKey=?",
          ["a".repeat(64), key],
        );
      await processMemberEmailBindingEmails(database, sendTransactionalEmail);
      expect(smtp.recipients).toEqual([]);
      expect(await status(key)).toMatchObject({
        sentAt: null,
        lastError: "delivery_failed",
        leaseId: null,
      });
    });
    it("stops after twelve failed attempts and releases the pending intent", async () => {
      const key = await queue();
      await conn.query(
        "UPDATE member_email_binding_outbox SET attempts=11 WHERE requestKey=?",
        [key],
      );
      smtp.rejectRecipients(true);
      vi.spyOn(console, "error").mockImplementation(() => {});
      await processMemberEmailBindingEmails(database, sendTransactionalEmail);
      expect(await status(key)).toMatchObject({
        state: "cancelled",
        attempts: 12,
        email: null,
        proofHash: null,
        tokenCipher: null,
      });
      await queue();
    });
    it("does not create a thirteenth attempt after the last worker crashes", async () => {
      const key = await queue();
      await conn.query(
        "UPDATE member_email_binding_outbox SET attempts=12,leaseId=?,leaseUntil=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE requestKey=?",
        [randomUUID(), key],
      );
      await processMemberEmailBindingEmails(database, sendTransactionalEmail);
      expect(smtp.messages).toEqual([]);
      expect(await status(key)).toMatchObject({
        state: "cancelled",
        attempts: 12,
        tokenCipher: null,
        email: null,
        proofHash: null,
      });
    });
    it("retries an unrecorded SMTP acceptance with the same proof and message identity", async () => {
      const key = await queue();
      await conn.query(`CREATE TRIGGER binding_delivery_ack_failure BEFORE UPDATE ON member_email_binding_outbox FOR EACH ROW
      BEGIN IF NEW.sentAt IS NOT NULL AND OLD.requestKey='${key}' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic private SMTP acknowledgement failure'; END IF; END`);
      await expect(
        processMemberEmailBindingEmails(database, sendTransactionalEmail),
      ).rejects.toMatchObject({ code: "unavailable" });
      expect(smtp.messages).toHaveLength(1);
      const firstToken = emailedProof();
      const before = await status(key);
      expect(before).toMatchObject({
        state: "pending",
        sentAt: null,
        tokenCipher: expect.any(String),
        leaseId: expect.any(String),
      });
      await conn.query("DROP TRIGGER binding_delivery_ack_failure");
      await processMemberEmailBindingEmails(database, sendTransactionalEmail);
      expect(smtp.messages).toHaveLength(1);
      await conn.query(
        "UPDATE member_email_binding_outbox SET leaseUntil=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE requestKey=?",
        [key],
      );
      await processMemberEmailBindingEmails(database, sendTransactionalEmail);
      expect(smtp.messages).toHaveLength(2);
      const first = smtp.messages.shift()!;
      expect(emailedProof()).toBe(firstToken);
      const messageId = (message: string) =>
        message.replace(/\r\n[ \t]+/g, " ").match(/Message-ID: (.+)/)?.[1];
      expect(messageId(first)).toBe(`<email-binding-${key}@daryadarcy.com>`);
      expect(messageId(smtp.messages[0])).toBe(messageId(first));
      expect(await status(key)).toMatchObject({
        attempts: 2,
        sentAt: expect.any(Date),
        tokenCipher: null,
        proofHash: before.proofHash,
      });
      expect(await confirmMemberEmailBinding(database, firstToken)).toBe(true);
    });
  },
);
