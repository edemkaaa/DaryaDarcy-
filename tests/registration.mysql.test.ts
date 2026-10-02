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
import type { Connection, RowDataPacket } from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import * as db from "../apps/backend/src/db";
import { registerOAuthRoutes } from "../apps/backend/src/_core/oauth";
import { EMAIL_REGISTER_CONSENT_VERSION } from "../packages/shared/src/consent-texts";

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
      await conn.query(
        `CREATE TABLE IF NOT EXISTS user_consent_events (id INT AUTO_INCREMENT PRIMARY KEY, userId INT NOT NULL, consentKey VARCHAR(64) NOT NULL, status ENUM('granted','revoked') NOT NULL, consentVersion VARCHAR(32) NOT NULL, consentText TEXT, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`,
      );
      const app = express();
      app.use(express.json({ limit: "16kb" }));
      registerOAuthRoutes(app);
      server = await new Promise<Server>((resolve) => {
        const s = app.listen(0, "127.0.0.1", () => resolve(s));
      });
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });
    async function cleanup() {
      await conn.query(
        "DELETE c FROM user_consent_events c INNER JOIN users u ON u.id=c.userId WHERE u.email LIKE ?",
        [`${prefix}%`],
      );
      await conn.query("DELETE FROM users WHERE email LIKE ?", [`${prefix}%`]);
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
    it("concurrent registration has one winner and never replaces its password", async () => {
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
      expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM users WHERE email=?",
        [email],
      );
      expect(rows).toHaveLength(1);
      const winner = results.findIndex((result) => result.status === 200);
      const winnerData = await results[winner].json();
      expect(winnerData.user.role).toBe("user");
      const { verifyPassword } =
        await import("../apps/backend/src/_core/password");
      expect(
        await verifyPassword(
          winner === 0 ? "first-password" : "second-password",
          rows[0].passwordHash,
        ),
      ).toBe(true);
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
  },
);
