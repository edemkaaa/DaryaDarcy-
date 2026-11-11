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
import {
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { requestMemberEmailBinding } from "../apps/backend/src/identity/email-binding";
import { confirmMemberEmailBinding } from "../apps/backend/src/identity/email-binding-confirmation";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";

/** Проверяет одноразовое подтверждение email с атомарной сменой только почты и очисткой proof. */
describe.skipIf(!testDatabaseUrl)(
  "single-use member email confirmation on owned MySQL",
  () => {
    let conn: Connection;
    let pool: Pool;
    let database: MySql2Database;
    const actor = { userId: 90901, sessionVersion: 2 };
    const email = "email-binding-confirmation@example.test";
    const key = Buffer.alloc(32, 31);
    /** Читает identity, intents, outbox и audit для независимой проверки подтверждения. */
    async function rows(query: string, params: unknown[] = []) {
      return (await conn.query<RowDataPacket[]>(query, params))[0];
    }
    /** Убирает свой fault-trigger, journals, audit, paid-fixture и четыре аккаунта. */
    async function cleanup() {
      await conn.query(
        "DROP TRIGGER IF EXISTS email_binding_confirmation_audit_failure",
      );
      await conn.query(
        "DELETE o FROM member_email_binding_outbox o JOIN member_email_bindings b ON b.requestKey=o.requestKey WHERE b.actorUserId=90901",
      );
      await conn.query(
        "DELETE FROM member_email_bindings WHERE actorUserId=90901",
      );
      await conn.query("DELETE FROM admin_audit_log WHERE actorUserId=90901");
      await conn.query(
        "DELETE FROM club_payments WHERE orderId='email-binding-confirmation-payment'",
      );
      await conn.query("DELETE FROM password_tokens WHERE userId=90902");
      await conn.query(
        "DELETE FROM users WHERE id IN (90901,90902,90903,90904) AND (openId LIKE 'email-binding-confirmation-%' OR openId='deleted-email-binding-confirmation-member')",
      );
    }
    /** Открывает отдельный восьмисоединительный пул одноразовой БД. */
    beforeAll(async () => {
      conn = await openTestDatabase();
      pool = mysql.createPool({
        uri: testDatabaseUrl!,
        timezone: "Z",
        connectionLimit: 8,
      });
      database = drizzle(pool);
    });
    /** Восстанавливает инициатора, двух телефонных получателей, соседнего владельца и существующий paid-период. */
    beforeEach(async () => {
      await cleanup();
      await conn.query(`INSERT INTO users (id,openId,email,phone,passwordHash,sessionVersion,role,updatedAt) VALUES
      (90901,'email-binding-confirmation-admin',NULL,NULL,'ADMIN_HASH',2,'admin','2020-01-01'),
      (90902,'email-binding-confirmation-member',NULL,'+70000090902','MEMBER_HASH',5,'user','2020-01-01'),
      (90903,'email-binding-confirmation-owner',NULL,NULL,'OWNER_HASH',3,'user','2020-01-01'),
      (90904,'email-binding-confirmation-member2',NULL,'+70000090904','MEMBER2_HASH',6,'user','2020-01-01')`);
      await conn.query(
        "INSERT INTO club_payments (userId,orderId,status,expiresAt) VALUES (90902,'email-binding-confirmation-payment','paid','2030-01-01')",
      );
      vi.stubEnv("AUTH_LINK_ENCRYPTION_KEY", key.toString("base64"));
    });
    /** Удаляет свои данные и закрывает соединения с восстановлением окружения. */
    afterAll(async () => {
      if (conn) {
        await cleanup();
        await conn.end();
      }
      if (pool) await pool.end();
      vi.unstubAllEnvs();
    });
    /** Ждёт реального data-lock wait, сопоставляя blocking transaction с connectionId через innodb_trx. */
    async function waitForBlocker(blockerId: number) {
      const deadline = performance.now() + 3000;
      while (performance.now() < deadline) {
        // Native evidence showed secondary-index THREAD_ID attribution did not
        // identify the owner; the blocking transaction ID maps to its connection.
        const waits = await rows(
          `SELECT 1 FROM performance_schema.data_lock_waits w
        JOIN information_schema.innodb_trx t ON t.trx_id=w.BLOCKING_ENGINE_TRANSACTION_ID
        WHERE t.trx_mysql_thread_id=?`,
          [blockerId],
        );
        if (waits.length) return;
        // Leave time for native transaction metadata to refresh between reads:
        // faster sampling retained the previous transaction in this fixture.
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      throw new Error(
        "Confirmation did not reach the expected native lock wait",
      );
    }
    /** Создаёт настоящий intent и расшифровывает synthetic outbox-proof для контролируемого подтверждения. */
    async function queue(userId = 90902) {
      const requestKey = randomUUID();
      await requestMemberEmailBinding(database, actor, {
        userId,
        email,
        requestKey,
      });
      const [binding] = await rows(
        "SELECT b.*,o.tokenCipher FROM member_email_bindings b JOIN member_email_binding_outbox o ON o.requestKey=b.requestKey WHERE b.requestKey=?",
        [requestKey],
      );
      const encrypted = Buffer.from(binding.tokenCipher, "base64");
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        encrypted.subarray(0, 12),
      );
      decipher.setAAD(
        Buffer.from(`email-binding:v1:${requestKey}:${binding.payloadHash}`),
      );
      decipher.setAuthTag(encrypted.subarray(-16));
      const token = Buffer.concat([
        decipher.update(encrypted.subarray(12, -16)),
        decipher.final(),
      ]).toString("utf8");
      return { token, requestKey };
    }
    /** Проверяет terminal state, завершение и очистку email, proofHash, cipher и lease с сохранением intent identity. */
    async function expectTerminal(requestKey: string, state: string) {
      const [binding] = await rows(
        "SELECT * FROM member_email_bindings WHERE requestKey=?",
        [requestKey],
      );
      expect(binding).toMatchObject({
        state,
        email: null,
        proofHash: null,
        actorUserId: 90901,
      });
      expect(binding.completedAt).toBeInstanceOf(Date);
      expect(binding.payloadHash).toMatch(/^[a-f0-9]{64}$/);
      const [mail] = await rows(
        "SELECT * FROM member_email_binding_outbox WHERE requestKey=?",
        [requestKey],
      );
      expect(mail).toMatchObject({
        tokenCipher: null,
        leaseId: null,
        leaseUntil: null,
      });
      expect(mail.discardedAt).toBeInstanceOf(Date);
    }
    /** Подтверждение меняет только email, потребляет proof, пишет audit и сохраняет credentials и paid-доступ; повтор false. */
    it("binds only email, atomically consumes and scrubs the proof, and never changes credentials or paid access", async () => {
      const proof = await queue();
      const before = await rows(
        "SELECT * FROM users WHERE id IN (90901,90902,90903)",
      );
      const payments = await rows(
        "SELECT * FROM club_payments WHERE orderId='email-binding-confirmation-payment'",
      );
      await conn.query(
        "UPDATE member_email_binding_outbox SET leaseId=?,leaseUntil=DATE_ADD(NOW(),INTERVAL 1 MINUTE) WHERE requestKey=?",
        [randomUUID(), proof.requestKey],
      );
      vi.stubEnv("AUTH_LINK_ENCRYPTION_KEY", "");
      expect(await confirmMemberEmailBinding(database, proof.token)).toBe(true);
      expect(
        await rows("SELECT * FROM users WHERE id IN (90901,90902,90903)"),
      ).toEqual(
        before.map((user) => (user.id === 90902 ? { ...user, email } : user)),
      );
      expect(
        await rows(
          "SELECT * FROM club_payments WHERE orderId='email-binding-confirmation-payment'",
        ),
      ).toEqual(payments);
      expect(
        await rows("SELECT * FROM password_tokens WHERE userId=90902"),
      ).toEqual([]);
      await expectTerminal(proof.requestKey, "confirmed");
      const audit = await rows(
        "SELECT * FROM admin_audit_log WHERE actorUserId=90901 AND action='confirm_member_email_binding'",
      );
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({
        targetType: "user",
        targetId: 90902,
        details: null,
      });
      expect(await confirmMemberEmailBinding(database, proof.token)).toBe(
        false,
      );
    });
    /** Неверный или неизвестный proof не меняет pending-intent и не мешает правильному подтверждению. */
    it.each([
      "",
      "short",
      "a".repeat(44),
      "!".repeat(43),
      "a".repeat(10000),
      randomBytes(32).toString("base64url"),
    ])(
      "rejects invalid or unknown proof without altering a pending intent (%#)",
      async (token) => {
        const proof = await queue();
        const before = await rows(
          "SELECT * FROM member_email_bindings WHERE requestKey=?",
          [proof.requestKey],
        );
        expect(await confirmMemberEmailBinding(database, token)).toBe(false);
        expect(
          await rows("SELECT * FROM member_email_bindings WHERE requestKey=?", [
            proof.requestKey,
          ]),
        ).toEqual(before);
        expect(await confirmMemberEmailBinding(database, proof.token)).toBe(
          true,
        );
      },
    );
    /** Из шести конкурентных подтверждений только одно true и один audit. */
    it("has exactly one winner for six concurrent uses of the same proof", async () => {
      const proof = await queue();
      const results = await Promise.all(
        Array.from({ length: 6 }, () =>
          confirmMemberEmailBinding(database, proof.token),
        ),
      );
      expect(results.filter(Boolean)).toHaveLength(1);
      expect(results.filter((value) => value === false)).toHaveLength(5);
      expect(
        await rows(
          "SELECT id FROM admin_audit_log WHERE actorUserId=90901 AND action='confirm_member_email_binding'",
        ),
      ).toHaveLength(1);
      await expectTerminal(proof.requestKey, "confirmed");
    });
    /** Нестроковый proof безопасно отклоняется до запроса или изменения identity. */
    it.each([null, 123, {}])(
      "refuses non-string input before querying or mutating identity (%#)",
      async (token) => {
        expect(await confirmMemberEmailBinding(database, token as never)).toBe(
          false,
        );
      },
    );
    /** Парольные setup/reset токены не принимаются и не потребляются email-binding подтверждением. */
    it.each(["setup", "reset"])(
      "never accepts or consumes a password %s proof",
      async (purpose) => {
        const proof = await queue();
        const passwordToken = randomBytes(32).toString("base64url");
        await conn.query(
          "INSERT INTO password_tokens (userId,tokenHash,purpose,expiresAt) VALUES (90902,?,?,DATE_ADD(NOW(),INTERVAL 1 DAY))",
          [createHash("sha256").update(passwordToken).digest("hex"), purpose],
        );
        const before = await rows(
          "SELECT * FROM password_tokens WHERE userId=90902",
        );
        expect(await confirmMemberEmailBinding(database, passwordToken)).toBe(
          false,
        );
        expect(
          await rows("SELECT * FROM password_tokens WHERE userId=90902"),
        ).toEqual(before);
        expect(await confirmMemberEmailBinding(database, proof.token)).toBe(
          true,
        );
      },
    );
    /** Terminal intent не подтверждается повторно даже с оставшимся секретным материалом. */
    it.each(["confirmed", "expired", "cancelled"])(
      "refuses terminal %s state even with residual proof material",
      async (state) => {
        const proof = await queue();
        await conn.query(
          "UPDATE member_email_bindings SET state=? WHERE requestKey=?",
          [state, proof.requestKey],
        );
        const before = await rows(
          "SELECT * FROM member_email_bindings WHERE requestKey=?",
          [proof.requestKey],
        );
        expect(await confirmMemberEmailBinding(database, proof.token)).toBe(
          false,
        );
        expect(
          await rows("SELECT * FROM member_email_bindings WHERE requestKey=?", [
            proof.requestKey,
          ]),
        ).toEqual(before);
        expect(
          (await rows("SELECT email FROM users WHERE id=90902"))[0].email,
        ).toBeNull();
      },
    );
    /** Proof на границе expiresAt истекает с очисткой секретов без привязки почты. */
    it("expires and scrubs a valid but expired proof without granting email", async () => {
      const proof = await queue();
      await conn.query(
        "UPDATE member_email_bindings SET expiresAt=NOW() WHERE requestKey=?",
        [proof.requestKey],
      );
      expect(await confirmMemberEmailBinding(database, proof.token)).toBe(
        false,
      );
      await expectTerminal(proof.requestKey, "expired");
      expect(
        (await rows("SELECT email FROM users WHERE id=90902"))[0].email,
      ).toBeNull();
    });
    /** Изменившаяся доступность, роль, phone, openId или уже заданный email отменяют proof без перезаписи аккаунта. */
    it.each([
      "role='admin'",
      "role='moderator'",
      "blockedAt=NOW()",
      "accountDeletionRequestedAt=NOW()",
      "openId='deleted-email-binding-confirmation-member'",
      "phone=NULL",
      "phone=''",
      "email='already-bound@example.test'",
      "email='email-binding-confirmation@example.test'",
      "email=' '",
    ])(
      "rechecks recipient after queuing and never overwrites it (%s)",
      async (change) => {
        const proof = await queue();
        await conn.query(`UPDATE users SET ${change} WHERE id=90902`);
        const before = await rows("SELECT * FROM users WHERE id=90902");
        expect(await confirmMemberEmailBinding(database, proof.token)).toBe(
          false,
        );
        expect(await rows("SELECT * FROM users WHERE id=90902")).toEqual(
          before,
        );
        await expectTerminal(proof.requestKey, "cancelled");
      },
    );
    /** Удалённый получатель завершает proof cancelled и очищает секреты. */
    it("cancels and scrubs an intent if its recipient has been deleted", async () => {
      const proof = await queue();
      await conn.query(
        "DELETE FROM users WHERE id=90902 AND openId='email-binding-confirmation-member'",
      );
      expect(await confirmMemberEmailBinding(database, proof.token)).toBe(
        false,
      );
      await expectTerminal(proof.requestKey, "cancelled");
    });
    /** Email, занятый после создания intent, не перезаписывает ни нового, ни прежнего владельца. */
    it("refuses normalized email occupied after queueing without changing either identity", async () => {
      const proof = await queue();
      await conn.query("UPDATE users SET email=? WHERE id=90903", [
        `  ${email.toUpperCase()}  `,
      ]);
      const before = await rows(
        "SELECT * FROM users WHERE id IN (90902,90903)",
      );
      expect(await confirmMemberEmailBinding(database, proof.token)).toBe(
        false,
      );
      expect(
        await rows("SELECT * FROM users WHERE id IN (90902,90903)"),
      ).toEqual(before);
      await expectTerminal(proof.requestKey, "cancelled");
    });
    /** Два разных получателя одного email имеют ровно одного победителя, второй intent очищается cancelled. */
    it("arbitrates two distinct pending members for the same email with exactly one owner", async () => {
      const first = await queue();
      const second = await queue(90904);
      const results = await Promise.all([
        confirmMemberEmailBinding(database, first.token),
        confirmMemberEmailBinding(database, second.token),
      ]);
      expect(results.filter(Boolean)).toHaveLength(1);
      expect(results.filter((value) => value === false)).toHaveLength(1);
      expect(
        await rows(
          "SELECT id FROM users WHERE NULLIF(LOWER(TRIM(email)),'')=?",
          [email],
        ),
      ).toHaveLength(1);
      for (const [index, proof] of [first, second].entries())
        await expectTerminal(
          proof.requestKey,
          results[index] ? "confirmed" : "cancelled",
        );
    });
    /** Реальная гонка unique-index после свободного SELECT завершается безопасной отменой proof без утечки или остаточной PII. */
    it("handles a real unique-index race after its occupied-address snapshot without leaking or retaining PII", async () => {
      const proof = await queue();
      const blocker = await pool.getConnection();
      let confirmation: Promise<boolean> | undefined;
      try {
        const [[connection]] = await blocker.query<RowDataPacket[]>(
          "SELECT CONNECTION_ID() AS id",
        );
        await blocker.beginTransaction();
        await blocker.query("UPDATE users SET email=? WHERE id=90903", [email]);
        confirmation = confirmMemberEmailBinding(database, proof.token);
        // SELECT saw no owner; the UPDATE now waits on the real unique index.
        await waitForBlocker(connection.id);
        await blocker.commit();
        expect(await confirmation).toBe(false);
        await expectTerminal(proof.requestKey, "cancelled");
        expect(
          (await rows("SELECT email FROM users WHERE id=90902"))[0].email,
        ).toBeNull();
        expect(
          (await rows("SELECT email FROM users WHERE id=90903"))[0].email,
        ).toBe(email);
      } finally {
        await blocker.rollback();
        blocker.release();
        await confirmation?.catch(() => {});
      }
    });
    /** Proof, истёкший во время ожидания unique-index, откатывает допустившийся UPDATE identity. */
    it("does not bind if the proof expires while its email update waits on the unique index", async () => {
      const proof = await queue();
      const blocker = await pool.getConnection();
      let confirmation: Promise<boolean> | undefined;
      const clock = vi.spyOn(Date, "now");
      const start = Date.now();
      clock.mockReturnValue(start);
      try {
        const [[connection]] = await blocker.query<RowDataPacket[]>(
          "SELECT CONNECTION_ID() AS id",
        );
        await blocker.beginTransaction();
        await blocker.query("UPDATE users SET email=? WHERE id=90903", [email]);
        confirmation = confirmMemberEmailBinding(database, proof.token);
        await waitForBlocker(connection.id);
        clock.mockReturnValue(start + 86400000 + 1000);
        // Releasing a rolled-back contender permits the email UPDATE, but the
        // now-expired proof must still leave the user's identity unchanged.
        await blocker.rollback();
        expect(await confirmation).toBe(false);
        await expectTerminal(proof.requestKey, "expired");
        expect(
          (await rows("SELECT email FROM users WHERE id=90902"))[0].email,
        ).toBeNull();
      } finally {
        await blocker.rollback();
        blocker.release();
        await confirmation?.catch(() => {});
        clock.mockRestore();
      }
    });
    /** После recipient-lock wait подтверждение видит новую блокировку и не назначает email. */
    it("observes a recipient revocation committed while waiting on the recipient lock", async () => {
      const proof = await queue();
      const blocker = await pool.getConnection();
      let confirmation: Promise<boolean> | undefined;
      try {
        const [[connection]] = await blocker.query<RowDataPacket[]>(
          "SELECT CONNECTION_ID() AS id",
        );
        await blocker.beginTransaction();
        await blocker.query("UPDATE users SET blockedAt=NOW() WHERE id=90902");
        confirmation = confirmMemberEmailBinding(database, proof.token);
        await waitForBlocker(connection.id);
        await blocker.commit();
        expect(await confirmation).toBe(false);
        await expectTerminal(proof.requestKey, "cancelled");
        expect(
          (await rows("SELECT email FROM users WHERE id=90902"))[0].email,
        ).toBeNull();
      } finally {
        await blocker.rollback();
        blocker.release();
        await confirmation?.catch(() => {});
      }
    });
    /** Сбой подтверждающего audit откатывает identity, proof и outbox; повтор после снятия сбоя проходит. */
    it("rolls back the identity, proof and outbox together when confirmation audit fails, hiding SQL details", async () => {
      const proof = await queue();
      const before = await rows(
        "SELECT b.*,o.tokenCipher,o.leaseId FROM member_email_bindings b JOIN member_email_binding_outbox o ON o.requestKey=b.requestKey WHERE b.requestKey=?",
        [proof.requestKey],
      );
      await conn.query(
        "CREATE TRIGGER email_binding_confirmation_audit_failure BEFORE INSERT ON admin_audit_log FOR EACH ROW BEGIN IF NEW.action='confirm_member_email_binding' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PRIVATE_CONFIRM_SQL'; END IF; END",
      );
      await expect(
        confirmMemberEmailBinding(database, proof.token),
      ).rejects.toMatchObject({
        code: "unavailable",
        message: "Email binding: unavailable",
      });
      expect(
        await rows(
          "SELECT b.*,o.tokenCipher,o.leaseId FROM member_email_bindings b JOIN member_email_binding_outbox o ON o.requestKey=b.requestKey WHERE b.requestKey=?",
          [proof.requestKey],
        ),
      ).toEqual(before);
      expect(
        (await rows("SELECT email FROM users WHERE id=90902"))[0].email,
      ).toBeNull();
      await conn.query("DROP TRIGGER email_binding_confirmation_audit_failure");
      expect(await confirmMemberEmailBinding(database, proof.token)).toBe(true);
    });
    /** Для подтверждения достаточно proofHash после очистки delivery-cipher; исторический sentAt сохраняется. */
    it("allows confirmation after delivery discarded its cipher, preserving historical sent time", async () => {
      const proof = await queue();
      await conn.query(
        "UPDATE member_email_binding_outbox SET tokenCipher=NULL,sentAt='2020-01-01' WHERE requestKey=?",
        [proof.requestKey],
      );
      expect(await confirmMemberEmailBinding(database, proof.token)).toBe(true);
      expect(
        (
          await rows(
            "SELECT sentAt FROM member_email_binding_outbox WHERE requestKey=?",
            [proof.requestKey],
          )
        )[0].sentAt.toISOString(),
      ).toBe("2020-01-01T00:00:00.000Z");
    });
  },
);
