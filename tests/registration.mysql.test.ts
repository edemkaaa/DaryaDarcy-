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
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Connection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import * as db from "../apps/backend/src/db";
import { registerOAuthRoutes } from "../apps/backend/src/_core/oauth";
import { EMAIL_REGISTER_CONSENT_VERSION } from "../packages/shared/src/consent-texts";
import { registerPasswordRoutes } from "../apps/backend/src/identity/routes";
import { processAccessEmails } from "../apps/backend/src/identity/access";

describe.skipIf(!testDatabaseUrl)(
  "insert-only email registration on disposable MySQL",
  () => {
    let conn: Connection, server: Server, base: string;
    const prefix = "registration-fixture-";
    const email = `${prefix}race@example.test`;
    const originalLookup = db.getUserByEmail;
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
      const app = express();
      app.use(express.json({ limit: "16kb" }));
      registerOAuthRoutes(app);
      registerPasswordRoutes(app);
      server = await new Promise<Server>((resolve) => {
        const s = app.listen(0, "127.0.0.1", () => resolve(s));
      });
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
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
      await new Promise<void>((resolve) => server?.close(() => resolve()));
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
      expect(results.map((result) => result.status).sort()).toEqual([202, 409]);
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
      await conn.query(
        `CREATE TRIGGER backend_test_registration_consent BEFORE INSERT ON user_consent_events FOR EACH ROW BEGIN IF (SELECT email FROM users WHERE id=NEW.userId) LIKE '${prefix}%' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='local consent failure'; END IF; END`,
      );
      try {
        const result = await post();
        expect(result.status).toBe(500);
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
      vi.stubEnv("AUTH_LINK_ENCRYPTION_KEY", "invalid-test-key");
      try {
        expect((await post()).status).toBe(500);
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
