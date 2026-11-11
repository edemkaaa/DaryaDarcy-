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
import { createDecipheriv, createHash, randomUUID } from "node:crypto";
import { requestMemberEmailBinding } from "../apps/backend/src/identity/email-binding";
import { completePassword } from "../apps/backend/src/identity/access";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";

/** Проверяет первое admin-намерение привязки email: отдельный proof, encrypted outbox и обязательный audit без смены аккаунта. */
describe.skipIf(!testDatabaseUrl)(
  "first email binding request on owned MySQL",
  () => {
    let conn: Connection;
    let pool: Pool;
    let database: MySql2Database;
    const actor = { userId: 90801, sessionVersion: 7 };
    const email = "email-binding-request@example.test";
    const key = Buffer.alloc(32, 19);
    /** Создаёт bounded-запрос собственного получателя с новым UUID операции. */
    const input = () => ({ userId: 90802, email, requestKey: randomUUID() });
    /** Читает фактические users, intents, outbox и audit через контрольное соединение. */
    async function rows(query: string, params: unknown[] = []) {
      return (await conn.query<RowDataPacket[]>(query, params))[0];
    }
    /** Удаляет только собственный fault-trigger, journals/outbox, audit и пять fixture-аккаунтов. */
    async function cleanup() {
      await conn.query(
        "DROP TRIGGER IF EXISTS email_binding_request_audit_failure",
      );
      await conn.query(
        "DELETE o FROM member_email_binding_outbox o JOIN member_email_bindings b ON b.requestKey=o.requestKey WHERE b.actorUserId IN (90801,90804)",
      );
      await conn.query(
        "DELETE FROM member_email_bindings WHERE actorUserId IN (90801,90804)",
      );
      await conn.query(
        "DELETE FROM admin_audit_log WHERE actorUserId IN (90801,90804)",
      );
      await conn.query(
        "DELETE FROM users WHERE id IN (90801,90802,90803,90804,90805) AND openId LIKE 'email-binding-request-%'",
      );
    }
    /** Открывает одноразовую БД и отдельный пул и настраивает synthetic 256-битный ключ ссылок. */
    beforeAll(async () => {
      conn = await openTestDatabase();
      pool = mysql.createPool({
        uri: testDatabaseUrl!,
        timezone: "Z",
        connectionLimit: 8,
      });
      database = drizzle(pool);
      vi.stubEnv("AUTH_LINK_ENCRYPTION_KEY", key.toString("base64"));
    });
    /** Восстанавливает admin, второго admin, двух телефонных получателей и занятого email-владельца. */
    beforeEach(async () => {
      await cleanup();
      await conn.query(`INSERT INTO users (id,openId,email,phone,passwordHash,sessionVersion,role) VALUES
      (90801,'email-binding-request-admin',NULL,NULL,'ADMIN_HASH',7,'admin'),
      (90802,'email-binding-request-member',NULL,'+70000090802','MEMBER_HASH',4,'user'),
      (90803,'email-binding-request-owner','email-binding-occupied@example.test',NULL,'OWNER_HASH',3,'user'),
      (90804,'email-binding-request-admin2',NULL,NULL,'ADMIN2_HASH',0,'admin'),
      (90805,'email-binding-request-member2',NULL,'+70000090805','MEMBER2_HASH',1,'user')`);
      vi.stubEnv("AUTH_LINK_ENCRYPTION_KEY", key.toString("base64"));
    });
    /** Очищает fixture и закрывает соединения с восстановлением окружения. */
    afterAll(async () => {
      if (conn) {
        await cleanup();
        await conn.end();
      }
      if (pool) await pool.end();
      vi.unstubAllEnvs();
    });
    /** Требует отсутствие собственного intent, audit и outbox после отказа до коммита. */
    async function expectNoRequest() {
      expect(
        await rows(
          "SELECT requestKey FROM member_email_bindings WHERE actorUserId IN (90801,90804)",
        ),
      ).toEqual([]);
      expect(
        await rows(
          "SELECT * FROM admin_audit_log WHERE actorUserId IN (90801,90804)",
        ),
      ).toEqual([]);
      expect(await rows("SELECT * FROM member_email_binding_outbox")).toEqual(
        [],
      );
    }
    /** Создание нормализует email и сохраняет 24-часовой proof в отдельном namespace с AEAD-привязкой к intent без изменения users. */
    it("atomically queues a separate encrypted proof and audits without touching any user fields", async () => {
      const request = { ...input(), email: `  ${email.toUpperCase()}  ` };
      const before = await rows(
        "SELECT * FROM users WHERE id IN (90801,90802,90803)",
      );
      const start = Date.now();
      expect(await requestMemberEmailBinding(database, actor, request)).toEqual(
        { requestKey: request.requestKey, state: "pending" },
      );
      expect(
        await rows("SELECT * FROM users WHERE id IN (90801,90802,90803)"),
      ).toEqual(before);
      const [binding] = await rows(
        "SELECT * FROM member_email_bindings WHERE requestKey=?",
        [request.requestKey],
      );
      expect(binding).toMatchObject({
        actorUserId: actor.userId,
        userId: request.userId,
        email,
        state: "pending",
        completedAt: null,
      });
      expect(binding.expiresAt.getTime() - start).toBeGreaterThan(
        86400000 - 2000,
      );
      expect(binding.expiresAt.getTime() - start).toBeLessThan(86400000 + 2000);
      const [outbox] = await rows(
        "SELECT * FROM member_email_binding_outbox WHERE requestKey=?",
        [request.requestKey],
      );
      expect(outbox).toMatchObject({
        sentAt: null,
        discardedAt: null,
        attempts: 0,
        leaseId: null,
      });
      const encrypted = Buffer.from(outbox.tokenCipher, "base64");
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        encrypted.subarray(0, 12),
      );
      decipher.setAAD(
        Buffer.from(
          `email-binding:v1:${request.requestKey}:${binding.payloadHash}`,
        ),
      );
      decipher.setAuthTag(encrypted.subarray(-16));
      const token = Buffer.concat([
        decipher.update(encrypted.subarray(12, -16)),
        decipher.final(),
      ]).toString("utf8");
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(binding.proofHash).toBe(
        createHash("sha256").update(`email-binding:v1:${token}`).digest("hex"),
      );
      expect(outbox.tokenCipher).not.toContain(token);
      expect(
        await rows("SELECT * FROM password_tokens WHERE userId=90802"),
      ).toEqual([]);
      expect(await completePassword(database, token, "newPassword123")).toBe(
        false,
      );
      const audit = await rows(
        "SELECT action,targetType,targetId,details FROM admin_audit_log WHERE actorUserId=90801",
      );
      expect(audit).toEqual([
        {
          action: "request_member_email_binding",
          targetType: "user",
          targetId: 90802,
          details: null,
        },
      ]);
    });
    /** Повтор нормализованного намерения возвращает receipt без нового proof, outbox или audit даже без текущего encryption-key. */
    it("replays the same normalized intent without regenerating proof, mail or audit", async () => {
      const request = input();
      const receipt = await requestMemberEmailBinding(database, actor, request);
      const before = await rows("SELECT * FROM member_email_binding_outbox");
      vi.stubEnv("AUTH_LINK_ENCRYPTION_KEY", "");
      expect(
        await requestMemberEmailBinding(database, actor, {
          ...request,
          email: ` ${email.toUpperCase()} `,
        }),
      ).toEqual(receipt);
      expect(await rows("SELECT * FROM member_email_binding_outbox")).toEqual(
        before,
      );
      expect(
        await rows("SELECT id FROM admin_audit_log WHERE actorUserId=90801"),
      ).toHaveLength(1);
    });
    /** Изменённые email или userId с тем же requestKey конфликтуют и сохраняют исходный intent. */
    it.each([
      { email: "email-binding-different@example.test" },
      { userId: 90805 },
    ])(
      "rejects same-key payload changes without damaging the original request: %j",
      async (change) => {
        const request = input();
        await requestMemberEmailBinding(database, actor, request);
        const before = await rows("SELECT * FROM member_email_bindings");
        await expect(
          requestMemberEmailBinding(database, actor, { ...request, ...change }),
        ).rejects.toMatchObject({ code: "conflict" });
        expect(await rows("SELECT * FROM member_email_bindings")).toEqual(
          before,
        );
        expect(
          await rows("SELECT id FROM admin_audit_log WHERE actorUserId=90801"),
        ).toHaveLength(1);
      },
    );
    /** Второй admin не может присвоить уже занятый requestKey первого инициатора. */
    it("another administrator cannot reuse an intent key", async () => {
      const request = input();
      await requestMemberEmailBinding(database, actor, request);
      await expect(
        requestMemberEmailBinding(
          database,
          { userId: 90804, sessionVersion: 0 },
          request,
        ),
      ).rejects.toMatchObject({ code: "conflict" });
      expect(
        await rows("SELECT id FROM admin_audit_log WHERE actorUserId=90804"),
      ).toEqual([]);
    });
    /** Terminal receipt восстанавливается после очистки PII без нового proof и повторного audit. */
    it("replays a terminal intent after its PII is scrubbed without issuing another proof", async () => {
      const request = input();
      await requestMemberEmailBinding(database, actor, request);
      // Model the next slice's terminal storage contract, not email confirmation.
      await conn.query(
        "UPDATE member_email_bindings SET state='cancelled',email=NULL,proofHash=NULL,completedAt=CURRENT_TIMESTAMP WHERE requestKey=?",
        [request.requestKey],
      );
      await conn.query(
        "UPDATE member_email_binding_outbox SET tokenCipher=NULL,discardedAt=CURRENT_TIMESTAMP WHERE requestKey=?",
        [request.requestKey],
      );
      const before = await rows("SELECT * FROM member_email_binding_outbox");
      vi.stubEnv("AUTH_LINK_ENCRYPTION_KEY", "");
      expect(await requestMemberEmailBinding(database, actor, request)).toEqual(
        { requestKey: request.requestKey, state: "cancelled" },
      );
      expect(await rows("SELECT * FROM member_email_binding_outbox")).toEqual(
        before,
      );
      expect(
        await rows("SELECT id FROM admin_audit_log WHERE actorUserId=90801"),
      ).toHaveLength(1);
    });
    /** Отсутствующий admin отклоняется до сохранения intent. */
    it("refuses a missing actor before committing any intent", async () => {
      await expect(
        requestMemberEmailBinding(
          database,
          { userId: 90806, sessionVersion: 0 },
          input(),
        ),
      ).rejects.toMatchObject({ code: "forbidden" });
      await expectNoRequest();
    });
    /** Отсутствующий получатель не оставляет даже claim-запись. */
    it("refuses a missing recipient without keeping its claim", async () => {
      await expect(
        requestMemberEmailBinding(database, actor, {
          ...input(),
          userId: 90806,
        }),
      ).rejects.toMatchObject({ code: "recipient_unavailable" });
      await expectNoRequest();
    });
    /** Повтор намерения заново проверяет текущие роль, блокировку, epoch и удаление инициатора. */
    it.each([
      ["moderator", "role='moderator'"],
      ["ordinary user", "role='user'"],
      ["blocked administrator", "blockedAt=CURRENT_TIMESTAMP"],
      ["revoked session", "sessionVersion=8"],
      ["pending deletion", "accountDeletionRequestedAt=CURRENT_TIMESTAMP"],
    ])(
      "rechecks current actor authority for %s",
      async (_label, assignment) => {
        const request = input();
        await requestMemberEmailBinding(database, actor, request);
        await conn.query(`UPDATE users SET ${assignment} WHERE id=90801`);
        await expect(
          requestMemberEmailBinding(database, actor, request),
        ).rejects.toMatchObject({ code: "forbidden" });
        expect(
          await rows("SELECT id FROM admin_audit_log WHERE actorUserId=90801"),
        ).toHaveLength(1);
      },
    );
    /** Первая привязка допускается только доступному обычному телефонному аккаунту без существующей почты. */
    it.each([
      ["email already present", "email='email-binding-existing@example.test'"],
      ["whitespace email", "email='   '"],
      ["no phone", "phone=NULL"],
      ["empty phone", "phone=''"],
      ["staff recipient", "role='moderator'"],
      ["blocked recipient", "blockedAt=CURRENT_TIMESTAMP"],
      ["deletion pending", "accountDeletionRequestedAt=CURRENT_TIMESTAMP"],
      ["deleted identity", "openId='deleted-90802-fixture'"],
    ])(
      "refuses %s and leaves no request, mail or audit",
      async (_label, assignment) => {
        await conn.query(`UPDATE users SET ${assignment} WHERE id=90802`);
        try {
          await expect(
            requestMemberEmailBinding(database, actor, input()),
          ).rejects.toMatchObject({ code: "recipient_unavailable" });
          await expectNoRequest();
        } finally {
          await conn.query(
            "UPDATE users SET openId='email-binding-request-member' WHERE id=90802",
          );
        }
      },
    );
    /** Занятый нормализованный email вызывает конфликт без изменения прежнего владельца. */
    it("rejects an occupied normalized address without modifying its owner", async () => {
      const before = await rows("SELECT * FROM users WHERE id=90803");
      await expect(
        requestMemberEmailBinding(database, actor, {
          ...input(),
          email: "  EMAIL-BINDING-OCCUPIED@EXAMPLE.TEST  ",
        }),
      ).rejects.toMatchObject({ code: "conflict" });
      expect(await rows("SELECT * FROM users WHERE id=90803")).toEqual(before);
      await expectNoRequest();
    });
    /** Пустой, неверный и чрезмерный email отклоняются до записи. */
    it.each(["", "not-an-email", "a".repeat(321) + "@example.test"])(
      "validates the email before creating anything: %j",
      async (badEmail) => {
        await expect(
          requestMemberEmailBinding(database, actor, {
            ...input(),
            email: badEmail,
          }),
        ).rejects.toMatchObject({ code: "invalid_input" });
        await expectNoRequest();
      },
    );
    /** Нет encryption-key — claim откатывается, секретное намерение не создаётся. */
    it("fails closed with missing encryption and rolls back the claim", async () => {
      vi.stubEnv("AUTH_LINK_ENCRYPTION_KEY", "");
      await expect(
        requestMemberEmailBinding(database, actor, input()),
      ).rejects.toMatchObject({ code: "unavailable" });
      await expectNoRequest();
    });
    /** Неканонический Base64 или ключ не 32 байта запрещает запись proof и PII. */
    it.each([
      "not-base64",
      Buffer.alloc(31).toString("base64"),
      key.toString("base64") + "\n",
    ])(
      "rejects malformed encryption configuration without creating PII: %#",
      async (value) => {
        vi.stubEnv("AUTH_LINK_ENCRYPTION_KEY", value);
        await expect(
          requestMemberEmailBinding(database, actor, input()),
        ).rejects.toMatchObject({ code: "unavailable" });
        await expectNoRequest();
      },
    );
    /** Невалидные UUID, userId и лишние поля отклоняются как invalid_input. */
    it.each([
      { requestKey: "not-an-intent" },
      { userId: -1 },
      { userId: 2147483648 },
      { extra: "not-allowed" },
    ])("rejects invalid bounded request input: %j", async (change) => {
      await expect(
        requestMemberEmailBinding(database, actor, { ...input(), ...change }),
      ).rejects.toMatchObject({ code: "invalid_input" });
      await expectNoRequest();
    });
    /** Отказ обязательного audit откатывает intent и outbox и скрывает SQL-детали. */
    it("rolls back proof and outbox when auditing fails, without leaking SQL details", async () => {
      await conn.query(`CREATE TRIGGER email_binding_request_audit_failure BEFORE INSERT ON admin_audit_log FOR EACH ROW BEGIN
      IF NEW.actorUserId=90801 AND NEW.action='request_member_email_binding' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='private fixture audit failure';
      END IF;
    END`);
      await expect(
        requestMemberEmailBinding(database, actor, input()),
      ).rejects.toMatchObject({
        code: "unavailable",
        message: "Email binding: unavailable",
      });
      await expectNoRequest();
    });
    /** Шесть параллельных повторов создают один intent, один outbox и один audit. */
    it("concurrent identical intent retries create exactly one request, outbox and audit", async () => {
      const request = input();
      const results = await Promise.all(
        Array.from({ length: 6 }, () =>
          requestMemberEmailBinding(database, actor, request),
        ),
      );
      expect(results).toEqual(
        Array(6).fill({ requestKey: request.requestKey, state: "pending" }),
      );
      expect(
        await rows(
          "SELECT requestKey FROM member_email_bindings WHERE userId=90802",
        ),
      ).toHaveLength(1);
      expect(
        await rows("SELECT requestKey FROM member_email_binding_outbox"),
      ).toHaveLength(1);
      expect(
        await rows("SELECT id FROM admin_audit_log WHERE actorUserId=90801"),
      ).toHaveLength(1);
    });
    /** Разные admin и ключи за одного получателя создают только один pending-proof. */
    it("competing intent keys for the same member produce one pending binding, not two proofs", async () => {
      const results = await Promise.allSettled([
        requestMemberEmailBinding(database, actor, input()),
        requestMemberEmailBinding(
          database,
          { userId: 90804, sessionVersion: 0 },
          { ...input(), email: "email-binding-other@example.test" },
        ),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.find((result) => result.status === "rejected"),
      ).toMatchObject({ reason: { code: "conflict" } });
      expect(
        await rows("SELECT requestKey FROM member_email_binding_outbox"),
      ).toHaveLength(1);
      expect(
        await rows(
          "SELECT id FROM admin_audit_log WHERE actorUserId IN (90801,90804)",
        ),
      ).toHaveLength(1);
    });
  },
);
