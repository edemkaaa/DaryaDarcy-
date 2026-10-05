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
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import type {
  Connection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import * as db from "../apps/backend/src/db";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { EMAIL_REGISTER_CONSENT_VERSION } from "../packages/shared/src/consent-texts";
import { processAccessEmails } from "../apps/backend/src/identity/access";
import { SessionService } from "../apps/backend/src/identity/session.service";

// An HTTP 500 intentionally contains no internal cause. Keep bounded diagnostic
// codes in the assertion, not raw SQL/params, recipients, tokens or key material.
function registrationFailureCodes(error: unknown): string[] {
  const codes: string[] = [];
  let current = error;
  for (let depth = 0; depth < 4 && current instanceof Error; depth++) {
    const detail = current as Error & { code?: string; cause?: unknown };
    if (
      typeof detail.code === "string" &&
      /^[A-Z][A-Z0-9_]{1,63}$/.test(detail.code)
    )
      codes.push(detail.code);
    if (detail.message === "Invalid mail recipient")
      codes.push("MAIL_RECIPIENT_INVALID");
    if (detail.message.startsWith("AUTH_LINK_ENCRYPTION_KEY must be"))
      codes.push("AUTH_LINK_KEY_INVALID");
    if (detail.message === "Pool is closed.") codes.push("MYSQL_POOL_CLOSED");
    current = detail.cause;
  }
  return codes.length ? codes : ["UNCLASSIFIED_REGISTRATION_ERROR"];
}

describe.skipIf(!testDatabaseUrl)(
  "insert-only email registration on disposable MySQL",
  () => {
    let conn: Connection, application: INestApplication, base: string;
    const prefix = "registration-fixture-";
    const email = `${prefix}race@example.test`;
    const originalLookup = db.getUserByEmail;
    function captureRegistrationFailures() {
      const failures: string[][] = [];
      const originalRegister = SessionService.prototype.register;
      vi.spyOn(SessionService.prototype, "register").mockImplementation(
        async function (this: SessionService, email, name) {
          try {
            return await originalRegister.call(this, email, name);
          } catch (error) {
            failures.push(registrationFailureCodes(error));
            throw error;
          }
        },
      );
      return failures;
    }
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv(
        "JWT_SECRET",
        "registration-local-test-secret-with-at-least-32-characters",
      );
      vi.stubEnv(
        "AUTH_LINK_ENCRYPTION_KEY",
        Buffer.alloc(32, 11).toString("base64"),
      );
      await conn.query(
        `CREATE TABLE IF NOT EXISTS user_consent_events (id INT AUTO_INCREMENT PRIMARY KEY, userId INT NOT NULL, consentKey VARCHAR(64) NOT NULL, status ENUM('granted','revoked') NOT NULL, consentVersion VARCHAR(32) NOT NULL, consentText TEXT, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`,
      );
      application = await createBackendApplication();
      await application.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
      vi.stubEnv("PUBLIC_APP_URL", base);
    });
    async function cleanup() {
      // Resolve owned fixture IDs without locks, then use indexed predicates.
      // DELETE JOIN previously scanned/locked other suites' tokens and owners.
      const [owned] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE email LIKE ?",
        [`${prefix}%`],
      );
      if (!owned.length) return;
      const ids = owned.map((row) => row.id);
      const placeholders = ids.map(() => "?").join(",");
      for (const table of [
        "password_tokens",
        "access_email_outbox",
        "user_consent_events",
      ]) {
        await conn.query(
          `DELETE FROM ${table} WHERE userId IN (${placeholders})`,
          ids,
        );
      }
      await conn.query(`DELETE FROM users WHERE id IN (${placeholders})`, ids);
    }
    beforeEach(cleanup);
    afterEach(() => vi.restoreAllMocks());
    afterAll(async () => {
      await cleanup();
      await application?.close();
      await conn?.end();
      await (
        (await db.getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    const post = (
      recipient = email,
      password = "first-password",
      consentVersion = EMAIL_REGISTER_CONSENT_VERSION,
    ) =>
      fetch(`${base}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: recipient,
          password,
          name: "Member",
          consentVersion,
        }),
      });
    it("auto-generated account IDs do not overlap reserved parallel fixture ranges", async () => {
      const recipient = `${prefix}isolation@example.test`;
      const [inserted] = await conn.query<ResultSetHeader>(
        "INSERT INTO users (openId,email) VALUES (?,?)",
        [db.emailToOpenId(recipient), recipient],
      );
      expect(inserted.insertId).toBeGreaterThanOrEqual(1_000_000);
    });
    it("concurrent registration has one winner and queues one setup without a password or session", async () => {
      const failures = captureRegistrationFailures();
      let arrivals = 0;
      let release!: () => void;
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      vi.spyOn(db, "getUserByEmail").mockImplementation(async (recipient) => {
        const result = await originalLookup(recipient);
        if (recipient === email && !result) {
          if (++arrivals === 2) release();
          await barrier;
        }
        return result;
      });
      const results = await Promise.all([
        post(email, "first-password"),
        post(email, "second-password"),
      ]);
      expect({
        statuses: results.map((result) => result.status).sort(),
        failures,
      }).toEqual({ statuses: [202, 409], failures: [] });
      expect(
        results.every((result) => result.headers.getSetCookie().length === 0),
      ).toBe(true);
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM users WHERE email=?",
        [email],
      );
      expect(rows).toHaveLength(1);
      const winner = results.findIndex((result) => result.status === 202);
      const winnerData = await results[winner].json();
      expect(winnerData).not.toHaveProperty("sessionToken");
      expect(winnerData).not.toHaveProperty("user");
      expect(rows[0].role).toBe("user");
      expect(rows[0].passwordHash).toBeNull();
      const [outbox] = await conn.query<RowDataPacket[]>(
        "SELECT kind FROM access_email_outbox WHERE userId=?",
        [rows[0].id],
      );
      expect(outbox).toEqual([
        expect.objectContaining({ kind: "password-setup" }),
      ]);
      const [consents] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM user_consent_events WHERE userId=?",
        [rows[0].id],
      );
      expect(consents).toHaveLength(1);
    });
    it("arbitrates twenty simultaneous registrations without claiming an existing account", async () => {
      const recipient = `${prefix}burst@example.test`;
      let arrivals = 0;
      let release!: () => void;
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      const failures = captureRegistrationFailures();
      vi.spyOn(db, "getUserByEmail").mockImplementation(async (value) => {
        const result = await originalLookup(value).finally(() => {
          // A failed lookup must still release other real requests, not strand
          // their precheck barriers and turn a useful SQL failure into a timeout.
          if (value === recipient && ++arrivals === 20) release();
        });
        if (value === recipient) await barrier;
        return result;
      });
      // Exercise actual domain transactions; HTTP's 15/IP quota intentionally
      // precludes a twenty-request burst and is not disabled for this test.
      const sessions = application.get(SessionService);
      const results = await Promise.allSettled(
        Array.from({ length: 20 }, (_, index) =>
          sessions.register(recipient, `Member ${index}`),
        ),
      );
      expect(failures).toEqual([]);
      expect(
        results.filter((result) => result.status === "rejected"),
      ).toHaveLength(0);
      const outcomes = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      expect(outcomes.filter((value) => value === "created")).toHaveLength(1);
      expect(outcomes.filter((value) => value === "duplicate")).toHaveLength(
        19,
      );
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT id,role,passwordHash FROM users WHERE email=?",
        [recipient],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ role: "user", passwordHash: null });
      for (const table of [
        "access_email_outbox",
        "password_tokens",
        "user_consent_events",
      ]) {
        const [records] = await conn.query<RowDataPacket[]>(
          `SELECT id FROM ${table} WHERE userId=?`,
          [rows[0].id],
        );
        expect(records).toHaveLength(1);
      }
    });
    it("a checkout-created account appearing after the precheck cannot be claimed", async () => {
      vi.spyOn(db, "getUserByEmail").mockImplementationOnce(
        async (recipient) => {
          expect(await originalLookup(recipient)).toBeUndefined();
          await conn.query(
            "INSERT INTO users (openId,email,role,passwordHash) VALUES (?,?,'user',NULL)",
            [db.emailToOpenId(email), email],
          );
          return undefined;
        },
      );
      const result = await post();
      expect(result.status).toBe(409);
      expect(result.headers.getSetCookie()).toHaveLength(0);
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT passwordHash FROM users WHERE email=?",
        [email],
      );
      expect(rows[0].passwordHash).toBeNull();
    });
    it("rejects a consent version other than the current displayed text", async () => {
      const result = await post(email, "first-password", "invented-version");
      expect(result.status).toBe(400);
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE email=?",
        [email],
      );
      expect(rows).toHaveLength(0);
    });
    it("does not leave an account or issue a session if consent recording fails", async () => {
      const failures = captureRegistrationFailures();
      await conn.query(
        `CREATE TRIGGER backend_test_registration_consent BEFORE INSERT ON user_consent_events FOR EACH ROW BEGIN IF (SELECT email FROM users WHERE id=NEW.userId) LIKE '${prefix}%' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='local consent failure'; END IF; END`,
      );
      try {
        const result = await post();
        expect(result.status).toBe(500);
        expect(failures).toEqual([["ER_SIGNAL_EXCEPTION"]]);
        expect(result.headers.getSetCookie()).toHaveLength(0);
        const [rows] = await conn.query<RowDataPacket[]>(
          "SELECT id FROM users WHERE email=?",
          [email],
        );
        expect(rows).toHaveLength(0);
      } finally {
        await conn.query("DROP TRIGGER backend_test_registration_consent");
      }
    });
    it("can log in only after consuming the emailed setup link, without an automatic session on completion", async () => {
      const recipient = `${prefix}proof@example.test`;
      expect((await post(recipient)).status).toBe(202);
      const login = () =>
        fetch(`${base}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: recipient,
            password: "verified-password",
          }),
        });
      expect((await login()).status).toBe(401);
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM users WHERE email=?",
        [recipient],
      );
      let text = "";
      await vi.waitFor(
        async () => {
          if (!text)
            await processAccessEmails(
              (await db.getDb())!,
              async (mail) => {
                text = mail.text;
                return true;
              },
              rows[0].id,
            );
          expect(text).not.toBe("");
        },
        { timeout: 3000, interval: 20 },
      );
      const token = new URL(text.match(/http:\/\/\S+/)![0]).hash.slice(
        "#token=".length,
      );
      const completed = await fetch(`${base}/api/auth/password/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: "verified-password" }),
      });
      expect(completed.status).toBe(200);
      expect(completed.headers.getSetCookie()).toHaveLength(0);
      const signedIn = await login();
      expect(signedIn.status).toBe(200);
      expect(signedIn.headers.getSetCookie()).toHaveLength(1);
    });
    it("fixture cleanup does not lock an unrelated owner's password token", async () => {
      expect((await post()).status).toBe(202);
      const [inserted] = await conn.execute<
        import("mysql2/promise").ResultSetHeader
      >(
        "INSERT INTO users (openId,email) VALUES ('registration-cleanup-unrelated','cleanup-unrelated@example.test')",
      );
      const otherId = inserted.insertId;
      await conn.query(
        "INSERT INTO password_tokens (userId,email,tokenHash,purpose,expiresAt) VALUES (?,? ,?,'setup',DATE_ADD(NOW(),INTERVAL 1 DAY))",
        [
          otherId,
          "cleanup-unrelated@example.test",
          "cleanup-unrelated-token".padEnd(64, "x"),
        ],
      );
      const guard = await openTestDatabase();
      let timer: ReturnType<typeof setTimeout> | undefined;
      let cleaned: Promise<boolean> | undefined;
      try {
        await guard.beginTransaction();
        await guard.query("SELECT id FROM users WHERE id=? FOR UPDATE", [
          otherId,
        ]);
        cleaned = cleanup().then(() => true);
        const result = await Promise.race([
          cleaned,
          new Promise<boolean>((resolve) => {
            timer = setTimeout(() => resolve(false), 1000);
          }),
        ]);
        expect(result).toBe(true);
      } finally {
        if (timer) clearTimeout(timer);
        await guard.rollback();
        await cleaned;
        await guard.end();
        await conn.query("DELETE FROM password_tokens WHERE userId=?", [
          otherId,
        ]);
        await conn.query("DELETE FROM users WHERE id=?", [otherId]);
      }
    });
    it("rolls registration back if durable mail cannot be encrypted", async () => {
      const failures = captureRegistrationFailures();
      vi.stubEnv("AUTH_LINK_ENCRYPTION_KEY", "invalid-test-key");
      try {
        expect((await post()).status).toBe(500);
        expect(failures).toEqual([["AUTH_LINK_KEY_INVALID"]]);
        const [rows] = await conn.query<RowDataPacket[]>(
          "SELECT id FROM users WHERE email=?",
          [email],
        );
        expect(rows).toHaveLength(0);
      } finally {
        vi.stubEnv(
          "AUTH_LINK_ENCRYPTION_KEY",
          Buffer.alloc(32, 11).toString("base64"),
        );
      }
    });
  },
);
