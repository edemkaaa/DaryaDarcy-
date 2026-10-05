import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import type { Connection } from "mysql2/promise";
import { createHmac } from "node:crypto";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { hashPassword } from "../apps/backend/src/_core/password";
import { getDb } from "../apps/backend/src/db";
import { sdk } from "../apps/backend/src/_core/sdk";
import { COOKIE_NAME } from "../packages/shared/src/const";

describe.skipIf(!testDatabaseUrl)(
  "native Nest sessions with real JWT/MySQL/passwords",
  () => {
    let application: INestApplication, conn: Connection, base: string;
    const password = "native-session-fixture-password";
    const memberEmail = "native-session-member@example.test";
    const staffEmail = "native-session-staff@example.test";
    // RFC-style public test key, not an operator's secret.
    const totpSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    const totpAt = (counter: number) => {
      const buffer = Buffer.alloc(8);
      buffer.writeBigUInt64BE(BigInt(counter));
      const digest = createHmac("sha1", "12345678901234567890")
        .update(buffer)
        .digest();
      const offset = digest[digest.length - 1] & 15;
      return String(
        (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000,
      ).padStart(6, "0");
    };
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "native-sessions-fixture-secret-32-characters");
      vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
      const hash = await hashPassword(password);
      await conn.query("DELETE FROM users WHERE id IN (8940,8941)");
      await conn.query(
        "INSERT INTO users (id,openId,email,passwordHash,role) VALUES (8940,'native-session-member',?,?,'user'),(8941,'native-session-staff',?,?,'admin')",
        [memberEmail, hash, staffEmail, hash],
      );
      application = await createBackendApplication();
      await application.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
    });
    beforeEach(async () => {
      vi.stubEnv("ADMIN_TOTP_SECRET", "");
      await conn.query(
        "UPDATE users SET blockedAt=NULL,sessionVersion=0 WHERE id IN (8940,8941)",
      );
    });
    afterAll(async () => {
      await application?.close();
      await conn?.query("DELETE FROM users WHERE id IN (8940,8941)");
      await conn?.end();
      await (
        (await getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    const post = (
      path: string,
      body: unknown,
      headers: Record<string, string> = {},
    ) =>
      fetch(base + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
    const token = () =>
      sdk.createSessionToken("native-session-member", { sessionVersion: 0 });
    it("logs in with a real password and emits a safe user and host-only cookie", async () => {
      const response = await post("/api/auth/login", {
        email: memberEmail,
        password,
      });
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.user).toMatchObject({
        id: 8940,
        role: "user",
        email: memberEmail,
      });
      expect(data.user).not.toHaveProperty("passwordHash");
      expect(data.user).not.toHaveProperty("sessionVersion");
      expect(await sdk.verifySession(data.sessionToken)).toMatchObject({
        openId: "native-session-member",
        sessionVersion: 0,
      });
      expect(response.headers.get("set-cookie")).toContain("HttpOnly");
      expect(response.headers.get("set-cookie")).not.toContain("Domain=");
      expect(response.headers.get("cache-control")).toBe("no-store");
    });
    it("reads a valid real JWT from the host-only cookie without exposing a hash", async () => {
      const response = await fetch(base + "/api/auth/me", {
        headers: { Cookie: `${COOKIE_NAME}=${await token()}` },
      });
      const data = await response.json();
      expect(data.user).toMatchObject({ id: 8940, role: "user" });
      expect(data.user).not.toHaveProperty("passwordHash");
    });
    it("bridges a valid Bearer JWT into the same cookie, not a newly issued identity", async () => {
      const original = await token();
      const response = await post(
        "/api/auth/session",
        {},
        { Authorization: `Bearer ${original}` },
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        success: true,
        user: { id: 8940 },
      });
      expect(response.headers.get("set-cookie")).toContain(
        `${COOKIE_NAME}=${original}`,
      );
    });
    it("does not bridge a cookie-only session, even from the trusted origin", async () => {
      const response = await post(
        "/api/auth/session",
        {},
        {
          Cookie: `${COOKIE_NAME}=${await token()}`,
          Origin: "https://club.example.test",
        },
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Bearer token required" });
      expect(response.headers.get("set-cookie")).toBeNull();
    });
    it("rejects an invalid Bearer JWT without setting a cookie", async () => {
      const response = await post(
        "/api/auth/session",
        {},
        { Authorization: "Bearer invalid.fixture" },
      );
      expect(response.status).toBe(401);
      expect(response.headers.get("set-cookie")).toBeNull();
    });
    it("rechecks session version and blocking in MySQL for a previously valid JWT", async () => {
      const bearer = await token();
      for (const patch of [
        "sessionVersion=1",
        "sessionVersion=0,blockedAt=NOW()",
      ]) {
        await conn.query(`UPDATE users SET ${patch} WHERE id=8940`);
        const headers = { Authorization: `Bearer ${bearer}` };
        const me = await fetch(base + "/api/auth/me", { headers });
        expect(await me.json()).toEqual({ user: null });
        expect((await post("/api/auth/session", {}, headers)).status).toBe(401);
      }
    });
    it("does not issue a session for a blocked password login", async () => {
      await conn.query(
        "UPDATE users SET blockedAt=NOW(),lastSignedIn='2020-01-01 00:00:00' WHERE id=8940",
      );
      const response = await post("/api/auth/login", {
        email: memberEmail,
        password,
      });
      expect(response.status).toBe(401);
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(await response.json()).toEqual({
        error: "Неверный email или пароль",
      });
      const [rows] = await conn.query<import("mysql2/promise").RowDataPacket[]>(
        "SELECT lastSignedIn FROM users WHERE id=8940",
      );
      expect(rows[0].lastSignedIn.toISOString()).toBe(
        "2020-01-01T00:00:00.000Z",
      );
    });
    it("requires staff TOTP and rejects a wrong code without creating a session", async () => {
      vi.stubEnv("ADMIN_TOTP_SECRET", totpSecret);
      const missing = await post("/api/auth/login", {
        email: staffEmail,
        password,
      });
      expect(missing.status).toBe(403);
      expect(await missing.json()).toMatchObject({ requiresTotp: true });
      expect(missing.headers.get("set-cookie")).toBeNull();
      const counter = Math.floor(Date.now() / 30_000);
      const valid = [-1, 0, 1].map((delta) => totpAt(counter + delta));
      const wrong = ["000000", "111111", "222222", "333333"].find(
        (code) => !valid.includes(code),
      )!;
      const rejected = await post("/api/auth/login", {
        email: staffEmail,
        password,
        totp: wrong,
      });
      expect(rejected.status).toBe(401);
      expect(await rejected.json()).toMatchObject({ requiresTotp: true });
      expect(rejected.headers.get("set-cookie")).toBeNull();
    });
    it("allows a real password + independently calculated valid staff TOTP", async () => {
      vi.stubEnv("ADMIN_TOTP_SECRET", totpSecret);
      const response = await post("/api/auth/login", {
        email: staffEmail,
        password,
        totp: totpAt(Math.floor(Date.now() / 30_000)),
      });
      expect(response.status).toBe(200);
      expect((await response.json()).user).toMatchObject({
        id: 8941,
        role: "admin",
      });
      expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    });
    it("retains the login quota in the real Nest runtime", async () => {
      let last: Response | undefined;
      for (let attempt = 0; attempt < 21; attempt++)
        last = await post("/api/auth/login", {
          email: memberEmail,
          password: "wrong-password",
        });
      expect(last!.status).toBe(429);
      expect(await last!.json()).toMatchObject({
        retryAfterSec: expect.any(Number),
      });
      expect(last!.headers.get("set-cookie")).toBeNull();
    });
  },
);
