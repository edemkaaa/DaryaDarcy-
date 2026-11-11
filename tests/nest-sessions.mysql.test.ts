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
import type { Request } from "express";
import { SessionService } from "../apps/backend/src/identity/session.service";
import { ENV } from "../apps/backend/src/_core/env";

/** Проверяет REST и tRPC сессии с настоящими JWT, паролями и отдельной MySQL-базой. */
describe.skipIf(!testDatabaseUrl)(
  "native Nest sessions with real JWT/MySQL/passwords",
  () => {
    let application: INestApplication, conn: Connection, base: string;
    const password = "native-session-fixture-password";
    const memberEmail = "native-session-member@example.test";
    const staffEmail = "native-session-staff@example.test";
    // RFC-style public test key, not an operator's secret.
    const totpSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    /** Независимо вычисляет TOTP из публичной тестовой RFC-последовательности для проверки серверной валидации. */
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
    /** Создаёт два тестовых аккаунта с настоящим password hash и запускает локальный API с управляемыми origin. */
    beforeAll(async () => {
      conn = await openTestDatabase();
      // Выход отвязывает устройства, поэтому таблица нужна и при отдельном запуске.
      await conn.query(`CREATE TABLE IF NOT EXISTS push_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,token VARCHAR(256) NOT NULL UNIQUE,userId INT NULL,
        platform VARCHAR(16),enabled BOOLEAN NOT NULL DEFAULT TRUE,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB`);
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "native-sessions-fixture-secret-32-characters");
      vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
      vi.stubEnv("CORS_ALLOWED_ORIGINS", "https://manager.example.test");
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
    /** Возвращает роли, блокировку и эпохи сессий и выключает тестовую настройку TOTP между сценариями. */
    beforeEach(async () => {
      vi.stubEnv("ADMIN_TOTP_SECRET", "");
      await conn.query(
        "UPDATE users SET blockedAt=NULL,sessionVersion=0 WHERE id IN (8940,8941)",
      );
      await conn.query("UPDATE users SET role='user' WHERE id=8940");
      await conn.query("UPDATE users SET role='admin' WHERE id=8941");
    });
    /** Удаляет свои аккаунты, закрывает приложение и SQL-пул и возвращает окружение. */
    afterAll(async () => {
      await application?.close();
      await conn?.query("DELETE FROM users WHERE id IN (8940,8941)");
      await conn?.end();
      await (
        (await getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    /** Отправляет настоящий JSON POST с выбранными заголовками авторизации и origin. */
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
    /** Подписывает JWT обычного пользователя с исходной эпохой сессии. */
    const token = () =>
      sdk.createSessionToken("native-session-member", { sessionVersion: 0 });
    /** Подписывает JWT администратора с исходной эпохой сессии. */
    const staffToken = () =>
      sdk.createSessionToken("native-session-staff", { sessionVersion: 0 });
    /** Извлекает и декодирует только именованную session cookie из успешного HTTP-ответа. */
    const cookieToken = (response: Response) => {
      const cookie = response.headers
        .getSetCookie()
        .find((value) => value.startsWith(`${COOKIE_NAME}=`));
      expect(cookie).toBeDefined();
      return decodeURIComponent(
        cookie!.split(";")[0].slice(COOKIE_NAME.length + 1),
      );
    };
    /** Проверяет прежний plain-формат отказа настроек и невозможность передать полномочия actor через JSON. */
    it.each(["GET", "PUT"])(
      "preserves plain settings denial and rejects identity supplied in JSON on %s",
      async (method) => {
        for (const [bearer, status, text] of [
          ["invalid.fixture", 401, "Unauthorized"],
          [await token(), 403, "Forbidden"],
        ] as const) {
          const response = await fetch(base + "/api/admin/launch-settings", {
            method,
            headers: {
              Authorization: `Bearer ${bearer}`,
              "Content-Type": "application/json",
            },
            ...(method === "PUT"
              ? { body: JSON.stringify({ actor: { id: 8941, role: "admin" } }) }
              : {}),
          });
          expect(response.status).toBe(status);
          expect(await response.text()).toBe(text);
          expect(response.headers.get("cache-control")).toBe("no-store");
          expect(response.headers.get("set-cookie")).toBeNull();
        }
      },
    );
    /** Проверяет различие безопасного JSON-отказа resend без сессии и plain-отказа недостаточной роли. */
    it("keeps resend's JSON authentication denial distinct from plain role denial", async () => {
      const attempts: Record<string, string>[] = [
        {},
        { Authorization: "Bearer invalid.fixture" },
      ];
      for (const headers of attempts) {
        const response = await post(
          "/api/admin/access-email/resend",
          { userId: -1 },
          headers,
        );
        expect(response.status).toBe(403);
        expect(await response.json()).toEqual({ error: "Запрос недоступен." });
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(response.headers.get("set-cookie")).toBeNull();
      }
      const denied = await post(
        "/api/admin/access-email/resend",
        {
          userId: -1,
          actor: { id: 8941, role: "admin" },
        },
        { Authorization: `Bearer ${await token()}` },
      );
      expect(denied.status).toBe(403);
      expect(await denied.text()).toBe("Forbidden");
      expect(denied.headers.get("cache-control")).toBe("no-store");
    });
    /** Проверяет право staff на resend и отдельное право только администратора на настройки запуска. */
    it("allows staff resend but does not grant launch settings to moderators", async () => {
      const bearer = await staffToken();
      for (const role of ["admin", "moderator"]) {
        await conn.query("UPDATE users SET role=? WHERE id=8941", [role]);
        const resend = await post(
          "/api/admin/access-email/resend",
          { userId: -1 },
          { Authorization: `Bearer ${bearer}` },
        );
        expect(resend.status).toBe(400);
        expect(await resend.text()).toBe("Bad Request");
        expect(resend.headers.get("cache-control")).toBe("no-store");
        const settings = await fetch(base + "/api/admin/launch-settings", {
          headers: { Authorization: `Bearer ${bearer}` },
        });
        expect(settings.status).toBe(role === "admin" ? 200 : 403);
      }
    });
    /** Проверяет отказ административных маршрутов после отзыва сессии или блокировки без cookie и изменения lastSignedIn. */
    it.each(["sessionVersion=1", "blockedAt=NOW()"])(
      "denies both administrative routes after %s without touching sign-in or issuing cookies",
      async (patch) => {
        const bearer = await staffToken();
        await conn.query(
          `UPDATE users SET ${patch},lastSignedIn='2020-01-01 00:00:00' WHERE id=8941`,
        );
        const settings = await fetch(base + "/api/admin/launch-settings", {
          headers: { Authorization: `Bearer ${bearer}` },
        });
        const resend = await post(
          "/api/admin/access-email/resend",
          { userId: -1 },
          { Authorization: `Bearer ${bearer}` },
        );
        expect(settings.status).toBe(401);
        expect(await settings.text()).toBe("Unauthorized");
        expect(resend.status).toBe(403);
        expect(await resend.json()).toEqual({ error: "Запрос недоступен." });
        for (const response of [settings, resend]) {
          expect(response.headers.get("cache-control")).toBe("no-store");
          expect(response.headers.get("set-cookie")).toBeNull();
        }
        const [rows] = await conn.query<
          import("mysql2/promise").RowDataPacket[]
        >("SELECT lastSignedIn FROM users WHERE id=8941");
        expect(rows[0].lastSignedIn.toISOString()).toBe(
          "2020-01-01T00:00:00.000Z",
        );
      },
    );
    /** Проверяет отказ не-JSON административных записей до авторизации. */
    it("preserves non-JSON rejection before auth on both administrative writes", async () => {
      for (const [path, method] of [
        ["/api/admin/launch-settings", "PUT"],
        ["/api/admin/access-email/resend", "POST"],
      ]) {
        const response = await fetch(base + path, {
          method,
          body: "userId=8941",
        });
        expect(response.status).toBe(415);
        expect(await response.text()).toBe("Unsupported Media Type");
        expect(response.headers.get("cache-control")).toBe("no-store");
      }
    });
    /** Проверяет отдельное same-origin правило resend даже для другого CORS-разрешённого домена. */
    it("retains the stricter resend origin rule even for another CORS-allowed origin", async () => {
      await conn.query(
        "UPDATE users SET lastSignedIn='2020-01-01 00:00:00' WHERE id=8941",
      );
      const response = await post(
        "/api/admin/access-email/resend",
        { userId: -1 },
        {
          Origin: "https://manager.example.test",
          Authorization: `Bearer ${await staffToken()}`,
        },
      );
      expect(response.status).toBe(403);
      expect(await response.text()).toBe("Forbidden");
      expect(response.headers.get("cache-control")).toBe("no-store");
      const [rows] = await conn.query<import("mysql2/promise").RowDataPacket[]>(
        "SELECT lastSignedIn FROM users WHERE id=8941",
      );
      expect(rows[0].lastSignedIn.toISOString()).toBe(
        "2020-01-01T00:00:00.000Z",
      );
    });
    /** Проверяет общий session policy на реальном JWT с актуальными ролями, блокировкой и эпохой из SQL. */
    it("exports a shared session policy that rechecks real JWTs and database roles", async () => {
      const sessions = application.get(SessionService);
      expect(sessions).toHaveProperty(
        "authenticateRequest",
        expect.any(Function),
      );
      expect(sessions).toHaveProperty("optionalUser", expect.any(Function));
      expect(sessions).toHaveProperty("isAdministrator", expect.any(Function));
      const request = {
        headers: { authorization: `Bearer ${await token()}` },
      } as Request;
      const member = await sessions.authenticateRequest(request);
      expect(member.id).toBe(8940);
      expect(sessions.isStaff(member)).toBe(false);
      expect(sessions.isAdministrator(member)).toBe(false);
      await conn.query("UPDATE users SET role='moderator' WHERE id=8940");
      const moderator = await sessions.authenticateRequest(request);
      expect(sessions.isStaff(moderator)).toBe(true);
      expect(sessions.isAdministrator(moderator)).toBe(false);
      await conn.query("UPDATE users SET role='admin' WHERE id=8940");
      expect(
        sessions.isAdministrator(await sessions.authenticateRequest(request)),
      ).toBe(true);
      await conn.query("UPDATE users SET sessionVersion=1 WHERE id=8940");
      await expect(sessions.authenticateRequest(request)).rejects.toThrow();
      expect(await sessions.optionalUser(request)).toBeNull();
      await conn.query(
        "UPDATE users SET role='user',sessionVersion=0,blockedAt=NOW() WHERE id=8940",
      );
      expect(await sessions.optionalUser(request)).toBeNull();
    });
    /** Проверяет настоящий вход с безопасным публичным профилем и host-only HttpOnly-cookie без sessionToken в JSON. */
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
      expect(Object.keys(data)).toEqual(["user"]);
      expect(await sdk.verifySession(cookieToken(response))).toMatchObject({
        openId: "native-session-member",
        sessionVersion: 0,
      });
      expect(response.headers.get("set-cookie")).toContain("HttpOnly");
      expect(response.headers.get("set-cookie")).not.toContain("Domain=");
      expect(response.headers.get("cache-control")).toBe("no-store");
    });
    /** Проверяет, что длинное имя остаётся в профиле, но не раздувает cookie выше браузерного предела. */
    it("keeps a long stored display name out of the login cookie", async () => {
      const name = "Ж".repeat(2048);
      await conn.query("UPDATE users SET name=? WHERE id=8940", [name]);
      try {
        const response = await post("/api/auth/login", {
          email: memberEmail,
          password,
        });
        expect(response.status).toBe(200);
        expect((await response.json()).user.name).toBe(name);
        const cookie = response.headers.getSetCookie().find(value =>
          value.startsWith(`${COOKIE_NAME}=`),
        )!;
        expect(Buffer.byteLength(cookie, "utf8")).toBeLessThan(4096);
        const me = await fetch(`${base}/api/auth/me`, {
          headers: { Cookie: cookie.split(";")[0] },
        });
        expect((await me.json()).user).toMatchObject({ id: 8940, name });
      } finally {
        await conn.query("UPDATE users SET name=NULL WHERE id=8940");
      }
    });
    /** Проверяет совместимость прежнего подписанного JWT с сохранённым display name. */
    it("accepts an earlier signed session containing the display name", async () => {
      const legacy = await sdk.signSession({
        openId: "native-session-member",
        appId: ENV.appId,
        name: "Earlier display name",
        sessionVersion: 0,
      });
      const response = await fetch(`${base}/api/auth/me`, {
        headers: { Cookie: `${COOKIE_NAME}=${encodeURIComponent(legacy)}` },
      });
      expect(response.status).toBe(200);
      expect((await response.json()).user.id).toBe(8940);
    });
    /** Проверяет чтение JWT из host-only cookie без выдачи passwordHash. */
    it("reads a valid real JWT from the host-only cookie without exposing a hash", async () => {
      const response = await fetch(base + "/api/auth/me", {
        headers: { Cookie: `${COOKIE_NAME}=${await token()}` },
      });
      const data = await response.json();
      expect(data.user).toMatchObject({ id: 8940, role: "user" });
      expect(data.user).not.toHaveProperty("passwordHash");
    });
    /** Проверяет перенос исходного валидного Bearer в cookie без выпуска новой идентичности. */
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
    /** Проверяет запрет session bridge по одной cookie даже с доверенным origin. */
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
    /** Проверяет отказ неверного Bearer без установки cookie. */
    it("rejects an invalid Bearer JWT without setting a cookie", async () => {
      const response = await post(
        "/api/auth/session",
        {},
        { Authorization: "Bearer invalid.fixture" },
      );
      expect(response.status).toBe(401);
      expect(response.headers.get("set-cookie")).toBeNull();
    });
    /** Проверяет отзыв всех старых устройств через REST и tRPC logout без влияния на другой аккаунт и последующий вход. */
    it.each(
      ["/api/auth/logout", "/api/trpc/auth.logout"].flatMap((path) =>
        ["cookie", "bearer"].map((transport) => ({ path, transport })),
      ),
    )(
      "$path via $transport revokes existing tokens on every device, but not another account or a later login",
      async ({ path, transport }) => {
        const original = await token();
        const otherDevice = await sdk.createSessionToken(
          "native-session-member",
          {
            name: "second device",
            sessionVersion: 0,
          },
        );
        const otherAccount = await staffToken();
        const headers: Record<string, string> =
          transport === "cookie"
            ? { Cookie: `${COOKIE_NAME}=${original}` }
            : { Authorization: `Bearer ${original}` };
        const response = await post(path, { json: null }, headers);
        expect(response.status).toBe(200);
        expect(response.headers.get("set-cookie")).toContain(
          "Expires=Thu, 01 Jan 1970",
        );
        expect(response.headers.get("cache-control")).toBe("no-store");
        for (const revoked of [original, otherDevice]) {
          const bearer = { Authorization: `Bearer ${revoked}` };
          const me = await fetch(base + "/api/auth/me", { headers: bearer });
          expect(await me.json()).toEqual({ user: null });
          expect((await post("/api/auth/session", {}, bearer)).status).toBe(
            401,
          );
          const protectedRead = await fetch(
            base + "/api/trpc/admin.postCounts",
            { headers: bearer },
          );
          expect(protectedRead.status).toBe(401);
        }
        const [rows] = await conn.query<
          import("mysql2/promise").RowDataPacket[]
        >(
          "SELECT id,sessionVersion FROM users WHERE id IN (8940,8941) ORDER BY id",
        );
        expect(rows.map((row) => [row.id, row.sessionVersion])).toEqual([
          [8940, 1],
          [8941, 0],
        ]);
        expect(
          (
            await sdk.authenticateRequest({
              headers: { authorization: `Bearer ${otherAccount}` },
            } as Request)
          ).id,
        ).toBe(8941);
        const login = await post("/api/auth/login", {
          email: memberEmail,
          password,
        });
        expect(login.status).toBe(200);
        expect(await login.json()).not.toHaveProperty("sessionToken");
        const fresh = cookieToken(login);
        expect(await sdk.verifySession(fresh)).toMatchObject({
          sessionVersion: 1,
        });
        // A lost logout response/replay must not revoke a newly issued session.
        expect((await post(path, { json: null }, headers)).status).toBe(200);
        expect(
          (
            await sdk.authenticateRequest({
              headers: { authorization: `Bearer ${fresh}` },
            } as Request)
          ).id,
        ).toBe(8940);
      },
    );
    /** Проверяет, что запоздавший повтор отзыва с прежним actor-снимком не отзывает новую сессию. */
    it("a delayed revocation with an old actor snapshot cannot revoke a later session", async () => {
      const sessions = application.get(SessionService);
      const actor = await sessions.authenticateRequest({
        headers: { authorization: `Bearer ${await token()}` },
      } as Request);
      await Promise.all([
        sessions.revokeSessions(actor),
        sessions.revokeSessions(actor),
      ]);
      const fresh = await sdk.createSessionToken(actor.openId, {
        sessionVersion: 1,
      });
      await sessions.revokeSessions(actor);
      expect(
        (
          await sessions.authenticateRequest({
            headers: { authorization: `Bearer ${fresh}` },
          } as Request)
        ).id,
      ).toBe(8940);
    });
    /** Проверяет повторяемый logout отсутствующих и неверных реквизитов без отзыва посторонних сессий. */
    it.each(["/api/auth/logout", "/api/trpc/auth.logout"])(
      "%s is idempotent for absent and invalid credentials without revoking other accounts",
      async (path) => {
        const attempts: Record<string, string>[] = [
          {},
          { Authorization: "Bearer invalid.fixture" },
        ];
        for (const headers of attempts) {
          const response = await post(path, { json: null }, headers);
          expect(response.status).toBe(200);
          expect(response.headers.get("set-cookie")).toContain(
            "Expires=Thu, 01 Jan 1970",
          );
        }
        const [rows] = await conn.query<
          import("mysql2/promise").RowDataPacket[]
        >(
          "SELECT sessionVersion FROM users WHERE id IN (8940,8941) ORDER BY id",
        );
        expect(rows.map((row) => row.sessionVersion)).toEqual([0, 0]);
      },
    );
    /** Проверяет отказ logout без очистки cookie, если отзыв невозможно сохранить в SQL. */
    it.each(["/api/auth/logout", "/api/trpc/auth.logout"])(
      "%s does not report success or clear cookies when revocation cannot be stored",
      async (path) => {
        const bearer = await token();
        await conn.query(`CREATE TRIGGER backend_test_logout_write_failure BEFORE UPDATE ON users FOR EACH ROW
          BEGIN IF OLD.id=8940 AND NEW.sessionVersion<>OLD.sessionVersion THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='PRIVATE_LOGOUT_SQL_SENTINEL'; END IF; END`);
        try {
          const response = await post(
            path,
            { json: null },
            { Authorization: `Bearer ${bearer}` },
          );
          expect(response.status).toBeGreaterThanOrEqual(500);
          expect(response.headers.get("set-cookie")).toBeNull();
          expect(await response.text()).not.toMatch(
            /success|PRIVATE_LOGOUT_SQL_SENTINEL|stack/,
          );
          expect(
            (
              await sdk.authenticateRequest({
                headers: { authorization: `Bearer ${bearer}` },
              } as Request)
            ).id,
          ).toBe(8940);
        } finally {
          await conn.query("DROP TRIGGER backend_test_logout_write_failure");
        }
      },
    );
    /** Проверяет актуальную эпоху и блокировку ранее валидного JWT при каждом серверном чтении. */
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
    /** Проверяет отсутствие сессии и изменения lastSignedIn при парольном входе заблокированного аккаунта. */
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
    /** Проверяет требование настроенного staff-TOTP и отказ неверного кода без выдачи cookie. */
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
    /** Проверяет пароль и независимо рассчитанный корректный staff-TOTP с выдачей HttpOnly-cookie. */
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
    /** Проверяет действующий лимит попыток входа в настоящем Nest runtime. */
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
    /** Проверяет общую account-квоту с разных IP и вариантов нормализации email и допустимый вход после cooldown. */
    it("shares account cooldown across IPs, then accepts the real password and cookie after expiry", async () => {
      const email = "native-distributed-limit@example.test";
      await conn.query(
        "UPDATE users SET email=?,lastSignedIn='2020-01-01 00:00:00' WHERE id=8940",
        [email],
      );
      try {
        for (let attempt = 0; attempt < 5; attempt++) {
          const response = await post(
            "/api/auth/login",
            {
              email: [
                email,
                `  ${email.toUpperCase()} `,
                "nátive-distributed-limit@example.test",
                "native-distributed-límít@example.test",
                "native-distributed-limit@exámple.test",
              ][attempt],
              password: "wrong-password",
            },
            { "X-Forwarded-For": `203.0.113.${120 + attempt}` },
          );
          expect(response.status).toBe(401);
          expect(response.headers.get("set-cookie")).toBeNull();
        }
        const refused = await post(
          "/api/auth/login",
          { email, password },
          { "X-Forwarded-For": "203.0.113.130" },
        );
        expect(refused.status).toBe(429);
        const retryAfter = Number(refused.headers.get("Retry-After"));
        expect(retryAfter).toBeGreaterThan(0);
        expect(await refused.json()).toMatchObject({
          retryAfterSec: retryAfter,
        });
        expect(refused.headers.get("set-cookie")).toBeNull();
        const [rows] = await conn.query<
          import("mysql2/promise").RowDataPacket[]
        >("SELECT lastSignedIn FROM users WHERE id=8940");
        expect(rows[0].lastSignedIn.toISOString()).toBe(
          "2020-01-01T00:00:00.000Z",
        );
        const clock = vi
          .spyOn(Date, "now")
          .mockReturnValue(Date.now() + retryAfter * 1000 + 1);
        try {
          const login = await post(
            "/api/auth/login",
            { email, password },
            { "X-Forwarded-For": "203.0.113.131" },
          );
          expect(login.status).toBe(200);
          expect(Object.keys(await login.json())).toEqual(["user"]);
          const me = await fetch(base + "/api/auth/me", {
            headers: { Cookie: `${COOKIE_NAME}=${cookieToken(login)}` },
          });
          expect(me.status).toBe(200);
          expect((await me.json()).user).toMatchObject({
            id: 8940,
            email,
            role: "user",
          });
        } finally {
          clock.mockRestore();
        }
      } finally {
        await conn.query("UPDATE users SET email=? WHERE id=8940", [
          memberEmail,
        ]);
      }
    });
  },
);
