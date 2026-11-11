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

/** Проверяет delivery proof-письма, retry и lease fencing реальными SQL и локальным SMTP. */
describe.skipIf(!testDatabaseUrl)(
  "binding proof delivery through MySQL and loopback SMTP",
  () => {
    let conn: Connection, pool: Pool, database: MySql2Database;
    let smtp: Awaited<ReturnType<typeof openLoopbackSmtp>>;
    /** Читает intents, outbox и пользователя независимо от delivery результата. */
    async function rows(query: string, values: unknown[] = []) {
      return (await conn.query<RowDataPacket[]>(query, values))[0];
    }
    /** Удаляет свой ACK-fault trigger, intents/outbox, audit и два аккаунта suite. */
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
    /** Создаёт одноразовый пул и loopback SMTP с synthetic отправителем. */
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
    /** Очищает fixture и локальные письма и восстанавливает ключ шифрования, public origin и два аккаунта. */
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
    /** Возвращает spies доставки и логирования. */
    afterEach(() => vi.restoreAllMocks());
    /** Удаляет fixture и закрывает соединения и локальный SMTP с восстановлением окружения. */
    afterAll(async () => {
      if (conn) {
        await cleanup();
        await conn.end();
      }
      if (pool) await pool.end();
      if (smtp) await smtp.close();
      vi.unstubAllEnvs();
    });
    /** Создаёт pending email-binding собственного получателя с уникальным ключом. */
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
    /** Читает полную delivery-строку вместе с текущими state, email и proofHash. */
    async function status(key: string) {
      return (
        await rows(
          "SELECT b.state,b.email,b.proofHash,o.* FROM member_email_bindings b JOIN member_email_binding_outbox o ON o.requestKey=b.requestKey WHERE b.requestKey=?",
          [key],
        )
      )[0];
    }
    /** Декодирует MIME локального письма и извлекает proof только из fragment URL ожидаемого origin. */
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
    /** SMTP принимает proof один раз, cipher удаляется, а email пользователя меняется только отдельным подтверждением. */
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
    /** SMTP-отказ сохраняет исходный proof и backoff; успешный последующий retry очищает cipher. */
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
    /** Блокировка, удаление, expiry или уже привязанная почта отменяют proof до SMTP с очисткой секретов. */
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
    /** Два одновременно работающих sender получают одну delivery-попытку по owned lease. */
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
    /** Claim, просроченный, заменённый либо отменённый после коммита, не отправляет stale-письмо. */
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
        // Приостанавливаем после подтверждённого claim: финальная проверка должна увидеть сменившиеся lease или state перед SMTP.
        const slow = new Proxy(database, {
          /** Перехватывает только настоящий transaction-return и ставит паузу после коммита claim, остальные методы сохраняют this. */
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
    /** Активный lease погибшего worker не забирается до истечения, после expiry delivery повторяется. */
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
    /** Поздний ACK принятого SMTP не перезаписывает lease, уже назначенный другому worker. */
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
    /** Подтверждение proof между SMTP и ACK остаётся terminal и не получает обратно cipher или lease. */
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
    /** Отсутствующий ключ, плохой origin, повреждённый cipher и несовпадение proof/intent запрещают SMTP. */
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
    /** Двенадцатый отказ завершает intent cancelled и очищает секреты, разрешая новое намерение. */
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
    /** Истёкший lease после двенадцатой попытки не создаёт тринадцатую отправку. */
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
    /** После принятого SMTP и отказа SQL-ACK допускается повтор того же proof и Message-ID, а не выдуманная exactly-once гарантия. */
    it("retries an unrecorded SMTP acceptance with the same proof and message identity", async () => {
      const key = await queue();
      await conn.query(`CREATE TRIGGER binding_delivery_ack_failure BEFORE UPDATE ON member_email_binding_outbox FOR EACH ROW
      BEGIN IF NEW.sentAt IS NOT NULL AND OLD.requestKey='${key}' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic private SMTP acknowledgement failure'; END IF; END`);
      await expect(
        processMemberEmailBindingEmails(database, sendTransactionalEmail),
      ).rejects.toMatchObject({ code: "unavailable" });
      expect(smtp.messages).toHaveLength(1);
      // SMTP уже принял письмо, но SQL-ACK упал: следующий retry обязан сохранить тот же proof, хотя дубль письма возможен.
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
      /** Разворачивает folded MIME-заголовок и извлекает Message-ID для сравнения повторных SMTP-писем. */
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
