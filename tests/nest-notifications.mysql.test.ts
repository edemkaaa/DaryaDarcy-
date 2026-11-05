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
import type { Connection, RowDataPacket } from "mysql2/promise";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import * as db from "../apps/backend/src/db";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { SessionService } from "../apps/backend/src/identity/session.service";
import { sendServicePushNotification } from "../apps/backend/src/push";
import type { AppRouter } from "../apps/backend/src/routers";
import * as capabilities from "../apps/backend/src/launch/capabilities";

describe.skipIf(!testDatabaseUrl)(
  "notifications through real HTTP, JWT and disposable SQL",
  () => {
    let conn: Connection;
    let app: INestApplication;
    let base: string;
    const fixtureToken = "ExpoPushToken[synthetic-notification-http-device]";
    const device = (suffix: string) => fixtureToken.replace("]", `${suffix}]`);
    let clock = Date.now();
    beforeAll(async () => {
      conn = await openTestDatabase();
      // Audience checks query all devices: keep both fixtures mutually exclusive.
      const [lock] = await conn.query<RowDataPacket[]>(
        "SELECT GET_LOCK('backend_test_push_audience',30) AS acquired",
      );
      expect(lock[0]?.acquired).toBe(1);
      await conn.query(`CREATE TABLE IF NOT EXISTS push_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY, token VARCHAR(256) NOT NULL UNIQUE,
      userId INT NULL, platform VARCHAR(16), enabled BOOLEAN NOT NULL DEFAULT TRUE,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
      await conn.query(`CREATE TABLE IF NOT EXISTS push_consent_events (
      id INT AUTO_INCREMENT PRIMARY KEY, userId INT NOT NULL,
      consentType ENUM('service','marketing') NOT NULL,
      status ENUM('granted','revoked') NOT NULL, consentVersion VARCHAR(32) NOT NULL,
      consentText TEXT, platform VARCHAR(16),
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "notifications-http-synthetic-secret-32");
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    });
    beforeEach(async () => {
      // Production remains disabled. Only replace the capability policy for
      // enabled-path HTTP/JWT/SQL tests; the actual limiter is never doubled.
      vi.spyOn(capabilities, "requireCapability").mockImplementation(() => {});
      clock += 16 * 60_000;
      vi.spyOn(Date, "now").mockImplementation(() => clock);
      await conn.query(
        "DROP TRIGGER IF EXISTS notification_http_write_refusal",
      );
      await conn.query(
        "DELETE FROM push_tokens WHERE token LIKE 'ExpoPushToken[synthetic-notification-http-%'",
      );
      await conn.query(
        "DELETE FROM push_consent_events WHERE userId BETWEEN 8430 AND 8433",
      );
      await conn.query("DELETE FROM users WHERE id BETWEEN 8430 AND 8433");
      await conn.query(`INSERT INTO users (id,openId,role) VALUES
      (8430,'notification-http-8430','admin'),(8431,'notification-http-8431','user'),
      (8432,'notification-http-8432','user'),(8433,'notification-http-8433','moderator')`);
    });
    afterEach(async () => {
      await conn.query(
        "DROP TRIGGER IF EXISTS notification_http_write_refusal",
      );
      vi.restoreAllMocks();
    });
    afterAll(async () => {
      await app?.close();
      await conn?.query(
        "DELETE FROM push_tokens WHERE token LIKE 'ExpoPushToken[synthetic-notification-http-%'",
      );
      await conn?.query(
        "DELETE FROM push_consent_events WHERE userId BETWEEN 8430 AND 8433",
      );
      await conn?.query("DELETE FROM users WHERE id BETWEEN 8430 AND 8433");
      await conn?.query("SELECT RELEASE_LOCK('backend_test_push_audience')");
      await conn?.end();
      const database = await db.getDb();
      await (
        database as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    function client(userId?: number, sessionVersion = 0) {
      return createTRPCProxyClient<AppRouter>({
        links: [
          httpLink({
            url: `${base}/api/trpc`,
            transformer: superjson,
            headers: async () =>
              userId === undefined
                ? {}
                : {
                    Authorization: `Bearer ${await sdk.createSessionToken(`notification-http-${userId}`, { sessionVersion })}`,
                  },
          }),
        ],
      });
    }
    async function restLogout(userId: number) {
      const token = await sdk.createSessionToken(`notification-http-${userId}`, {
        sessionVersion: 0,
      });
      return fetch(`${base}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    async function tokens() {
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT token,userId,platform,enabled FROM push_tokens WHERE token LIKE 'ExpoPushToken[synthetic-notification-http-%' ORDER BY token",
      );
      return rows;
    }
    it.each([undefined, 8431, 8430])(
      "disabled capability prevents inserts and re-enables for actor %s",
      async (actor) => {
        vi.mocked(capabilities.requireCapability).mockRestore();
        await conn.query(
          "INSERT INTO push_tokens (token,userId,enabled) VALUES (?,8431,FALSE)",
          [fixtureToken],
        );
        const before = await tokens();
        for (const token of [fixtureToken, device("-new")]) {
          await expect(
            client(actor).notifications.registerToken.mutate({ token }),
          ).rejects.toMatchObject({
            data: { code: "FORBIDDEN", httpStatus: 403 },
          });
        }
        expect(await tokens()).toEqual(before);
      },
    );
    it.each([
      { token: "   " },
      { token: "arbitrary-device" },
      { token: `ExpoPushToken[${"a".repeat(256)}]` },
      { token: fixtureToken, platform: "a".repeat(17) },
    ])(
      "validation refuses invalid input without SQL errors or writes (%j)",
      async (input) => {
        await expect(
          client(8431).notifications.registerToken.mutate(input),
        ).rejects.toMatchObject({
          data: { code: "BAD_REQUEST", httpStatus: 400 },
        });
        expect(await tokens()).toEqual([]);
      },
    );
    it("limits an account's concurrent HTTP requests before SQL writes", async () => {
      const results = await Promise.all(
        Array.from({ length: 14 }, async (_, i) => {
          try {
            await client(8431).notifications.registerToken.mutate({
              token: device(`-burst-${i}`),
            });
            return "ok";
          } catch (error) {
            expect(error).toMatchObject({
              data: { code: "TOO_MANY_REQUESTS", httpStatus: 429 },
            });
            return "limited";
          }
        }),
      );
      expect(results.filter((result) => result === "ok")).toHaveLength(10);
      expect(results.filter((result) => result === "limited")).toHaveLength(4);
      expect(await tokens()).toHaveLength(10);
    });
    it("upserts one device using the authenticated actor and re-enables it", async () => {
      expect(
        await client(8431).notifications.registerToken.mutate({
          token: fixtureToken,
          platform: "ios",
          userId: 8432,
        } as { token: string; platform: string }),
      ).toEqual({ success: true });
      await conn.query("UPDATE push_tokens SET enabled=FALSE WHERE token=?", [
        fixtureToken,
      ]);
      expect(
        await client(8431).notifications.registerToken.mutate({
          token: fixtureToken,
          platform: "android",
        }),
      ).toEqual({ success: true });
      expect(await tokens()).toEqual([
        { token: fixtureToken, userId: 8431, platform: "android", enabled: 1 },
      ]);
    });
    it("registers an anonymous device without inventing a user or consent", async () => {
      await client().notifications.registerToken.mutate({
        token: fixtureToken,
      });
      expect(await tokens()).toEqual([
        { token: fixtureToken, userId: null, platform: null, enabled: 1 },
      ]);
      const [events] = await conn.query<RowDataPacket[]>(
        "SELECT userId FROM push_consent_events WHERE userId BETWEEN 8430 AND 8433",
      );
      expect(events).toEqual([]);
    });
    it("moves a device to the new account without carrying over marketing consent", async () => {
      await client(8431).notifications.registerToken.mutate({
        token: fixtureToken,
      });
      await client(8431).notifications.setMarketingConsent.mutate({
        enabled: true,
      });
      expect(await db.getMarketingPushTokens()).toContain(fixtureToken);

      await client(8432).notifications.registerToken.mutate({
        token: fixtureToken,
      });
      await client().notifications.registerToken.mutate({ token: fixtureToken });

      expect(await tokens()).toEqual([
        { token: fixtureToken, userId: 8432, platform: null, enabled: 1 },
      ]);
      expect(await db.getPushTokensForUser(8431)).toEqual([]);
      expect(await db.getPushTokensForUser(8432)).toEqual([fixtureToken]);
      expect(await db.getMarketingPushTokens()).not.toContain(fixtureToken);
    });
    it.each(["REST", "tRPC"])(
      "removes the signed-out account's devices from audiences through %s logout",
      async (transport) => {
        const firstAccount = client(8431);
        const secondAccount = client(8432);
        const secondDevice = device("-second");
        const otherAccountDevice = device("-other-account");
        await firstAccount.notifications.registerToken.mutate({
          token: fixtureToken,
        });
        await firstAccount.notifications.registerToken.mutate({
          token: secondDevice,
        });
        await secondAccount.notifications.registerToken.mutate({
          token: otherAccountDevice,
        });
        await firstAccount.notifications.setMarketingConsent.mutate({
          enabled: true,
        });
        const previousActor = await db.getUserByOpenId("notification-http-8431");
        expect(previousActor?.sessionVersion).toBe(0);

        if (transport === "REST") {
          const response = await restLogout(8431);
          expect(response.status).toBe(200);
          expect(await response.json()).toEqual({ success: true });
        } else {
          expect(await firstAccount.auth.logout.mutate()).toEqual({
            success: true,
          });
        }

        expect(await db.getPushTokensForUser(8431)).toEqual([]);
        expect(await db.getServicePushTokens("feed")).toEqual([otherAccountDevice]);
        expect(await db.getMarketingPushTokens()).toEqual([]);
        expect(await db.hasMarketingPushConsent(8431)).toBe(true);
        await client().notifications.registerToken.mutate({ token: fixtureToken });
        expect(await db.getPushTokensForUser(8431)).toEqual([]);

        await secondAccount.notifications.registerToken.mutate({
          token: fixtureToken,
        });
        await client(8431, 1).notifications.registerToken.mutate({
          token: secondDevice,
        });
        // Повторяем уже начатый выход со снимком старой сессии.
        await app.get(SessionService).revokeSessions(previousActor ?? null);
        expect(await db.getPushTokensForUser(8431)).toEqual([secondDevice]);
        expect((await db.getPushTokensForUser(8432)).sort()).toEqual(
          [fixtureToken, otherAccountDevice].sort(),
        );
      },
    );
    it("keeps the session and device binding when logout cannot detach the device", async () => {
      await client(8431).notifications.registerToken.mutate({
        token: fixtureToken,
      });
      const before = await tokens();
      await conn.query(`CREATE TRIGGER notification_http_write_refusal BEFORE UPDATE ON push_tokens FOR EACH ROW
        BEGIN IF OLD.userId=8431 AND NEW.userId IS NULL THEN
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic push detach refusal';
        END IF; END`);

      const response = await restLogout(8431);
      expect(response.status).toBe(503);
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(await response.text()).not.toContain("synthetic push detach refusal");
      expect(await tokens()).toEqual(before);
      expect(await client(8431).auth.me.query()).toMatchObject({ id: 8431 });
    });
    it("drops a personal push after the selected device switches accounts", async () => {
      await client(8431).notifications.registerToken.mutate({
        token: fixtureToken,
      });
      const readOwnerTokens = db.getPushTokensForUser;
      // Перепривязываем устройство через HTTP после чтения старого владельца.
      vi.spyOn(db, "getPushTokensForUser").mockImplementationOnce(
        async (userId) => {
          const selected = await readOwnerTokens(userId);
          expect(selected).toEqual([fixtureToken]);
          await client(8432).notifications.registerToken.mutate({
            token: fixtureToken,
          });
          return selected;
        },
      );
      const sendToExpo = vi.fn(async (_request: RequestInit | undefined) =>
        Response.json({ data: [{ status: "ok", id: "synthetic-ticket" }] }),
      );
      const realFetch = globalThis.fetch;
      vi.spyOn(globalThis, "fetch").mockImplementation((input, init) =>
        input === "https://exp.host/--/api/v2/push/send"
          ? sendToExpo(init)
          : realFetch(input, init),
      );

      const message = {
        title: "Synthetic push",
        body: "Synthetic reply",
        target: "feed",
      } as const;
      expect(
        await sendServicePushNotification({ ...message, userId: 8431 }),
      ).toBe(0);
      expect(await db.getPushTokensForUser(8432)).toEqual([fixtureToken]);
      expect(sendToExpo).not.toHaveBeenCalled();

      expect(
        await sendServicePushNotification({ ...message, userId: 8432 }),
      ).toBe(1);
      expect(sendToExpo).toHaveBeenCalledTimes(1);
      expect(JSON.parse(String(sendToExpo.mock.calls[0][0]?.body))).toMatchObject([
        { to: fixtureToken, body: message.body },
      ]);
    });
    it("persists legal consent for the session actor and honors the last same-second choice", async () => {
      expect(
        await client(8431).notifications.setMarketingConsent.mutate({
          enabled: true,
          platform: "ios",
          userId: 8432,
        } as { enabled: boolean; platform: string }),
      ).toEqual({ success: true, enabled: true });
      expect(
        await client(8431).notifications.setMarketingConsent.mutate({
          enabled: false,
          platform: "android",
        }),
      ).toEqual({ success: true, enabled: false });
      await conn.query(
        "UPDATE push_consent_events SET createdAt='2026-10-08 12:00:00' WHERE userId=8431",
      );
      const [events] = await conn.query<RowDataPacket[]>(
        "SELECT userId,consentType,status,consentVersion,consentText,platform FROM push_consent_events WHERE userId IN (8431,8432) ORDER BY id",
      );
      expect(events).toEqual([
        {
          userId: 8431,
          consentType: "marketing",
          status: "granted",
          consentVersion: "2026-08-1",
          consentText:
            "Получать новости, новые публикации, акции и предложения DARYADARCY",
          platform: "ios",
        },
        {
          userId: 8431,
          consentType: "marketing",
          status: "revoked",
          consentVersion: "2026-08-1",
          consentText:
            "Получать новости, новые публикации, акции и предложения DARYADARCY",
          platform: "android",
        },
      ]);
      expect(await client(8431).notifications.marketingConsent.query()).toEqual(
        {
          enabled: false,
          version: "2026-08-1",
          label:
            "Получать новости, новые публикации, акции и предложения DARYADARCY",
        },
      );
    });
    it("refuses anonymous consent without recording an event", async () => {
      await expect(
        client().notifications.setMarketingConsent.mutate({ enabled: true }),
      ).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED", httpStatus: 401 },
      });
      const [events] = await conn.query<RowDataPacket[]>(
        "SELECT userId FROM push_consent_events WHERE userId BETWEEN 8430 AND 8433",
      );
      expect(events).toEqual([]);
    });
    it.each([
      { operation: "consent", change: "logout" },
      { operation: "consent", change: "block" },
      { operation: "registration", change: "logout" },
      { operation: "registration", change: "block" },
      { operation: "purge", change: "logout" },
      { operation: "purge", change: "block" },
      { operation: "purge", change: "demotion to moderator" },
    ] as const)(
      "refuses $operation after $change during the request",
      async ({ operation, change }) => {
        await conn.query(
          "INSERT INTO push_tokens (token,userId,platform,enabled) VALUES (?,8432,'ios',FALSE)",
          [fixtureToken],
        );
        const before = await tokens();
        const actorId = operation === "purge" ? 8430 : 8431;
        const sessions = app.get(SessionService);
        const readSession = sessions.optionalUser.bind(sessions);
        let entered!: () => void;
        let release!: () => void;
        const authenticated = new Promise<void>((resolve) => {
          entered = resolve;
        });
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        // Приостанавливаем запрос после настоящей проверки JWT, до записи в MySQL.
        vi.spyOn(sessions, "optionalUser").mockImplementationOnce(
          async (req) => {
            const user = await readSession(req);
            entered();
            await gate;
            return user;
          },
        );
        const request = client(actorId);
        const run = {
          consent: () =>
            request.notifications.setMarketingConsent.mutate({ enabled: true }),
          registration: () =>
            request.notifications.registerToken.mutate({
              token: fixtureToken,
              platform: "android",
            }),
          purge: () => request.admin.purgeUserPushData.mutate({ userId: 8432 }),
        };
        const pending = run[operation]();
        try {
          await Promise.race([
            authenticated,
            pending.then(() => {
              throw new Error("Expected authenticated request to pause");
            }),
          ]);
          if (change === "logout") {
            const response = await restLogout(actorId);
            expect(response.status).toBe(200);
            expect(await response.json()).toEqual({ success: true });
          } else if (change === "demotion to moderator") {
            await conn.query("UPDATE users SET role='moderator' WHERE id=?", [
              actorId,
            ]);
          } else {
            await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=?", [
              actorId,
            ]);
          }
          release();
          await expect(pending).rejects.toMatchObject({
            data: { httpStatus: change === "logout" ? 401 : 403 },
          });
          const [events] = await conn.query<RowDataPacket[]>(
            "SELECT userId FROM push_consent_events WHERE userId=?",
            [actorId],
          );
          expect(events).toEqual([]);
          expect(await tokens()).toEqual(before);
        } finally {
          release();
          await pending.catch(() => {});
        }
      },
    );
    it("purges only the requested user's tokens and retains consent history", async () => {
      await client(8431).notifications.registerToken.mutate({
        token: fixtureToken,
      });
      await client(8431).notifications.registerToken.mutate({
        token: device("-second"),
      });
      await client(8432).notifications.registerToken.mutate({
        token: device("-other"),
      });
      await client().notifications.registerToken.mutate({
        token: device("-anonymous"),
      });
      await client(8431).notifications.setMarketingConsent.mutate({
        enabled: true,
      });
      expect(
        await client(8430).admin.purgeUserPushData.mutate({ userId: 8431 }),
      ).toEqual({ success: true });
      expect(await tokens()).toEqual([
        {
          token: device("-anonymous"),
          userId: null,
          platform: null,
          enabled: 1,
        },
        {
          token: device("-other"),
          userId: 8432,
          platform: null,
          enabled: 1,
        },
      ]);
      const [events] = await conn.query<RowDataPacket[]>(
        "SELECT userId,status FROM push_consent_events WHERE userId=8431",
      );
      expect(events).toEqual([{ userId: 8431, status: "granted" }]);
    });
    it.each([8431, 8433])(
      "refuses token purge by non-admin %s without deleting a device",
      async (actor) => {
        await client(8432).notifications.registerToken.mutate({
          token: fixtureToken,
        });
        await expect(
          client(actor).admin.purgeUserPushData.mutate({ userId: 8432 }),
        ).rejects.toMatchObject({
          data: { code: "FORBIDDEN", httpStatus: 403 },
        });
        expect(await tokens()).toEqual([
          { token: fixtureToken, userId: 8432, platform: null, enabled: 1 },
        ]);
      },
    );
    it.each([
      {
        name: "registration",
        table: "push_tokens",
        event: "INSERT",
        row: "NEW",
        run: () =>
          client(8431).notifications.registerToken.mutate({
            token: fixtureToken,
            platform: "ios",
          }),
      },
      {
        name: "consent",
        table: "push_consent_events",
        event: "INSERT",
        row: "NEW",
        run: () =>
          client(8431).notifications.setMarketingConsent.mutate({
            enabled: true,
          }),
      },
      {
        name: "purge",
        table: "push_tokens",
        event: "DELETE",
        row: "OLD",
        run: () =>
          client(8430).admin.purgeUserPushData.mutate({ userId: 8431 }),
      },
    ])(
      "does not report success or expose SQL when $name persistence fails",
      async ({ table, event, row, run }) => {
        await client(8431).notifications.registerToken.mutate({
          token: fixtureToken,
        });
        const before = await tokens();
        await conn.query(`CREATE TRIGGER notification_http_write_refusal BEFORE ${event} ON ${table} FOR EACH ROW
      BEGIN IF ${row}.userId=8431 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic notification SQL failure'; END IF; END`);
        await expect(run()).rejects.toMatchObject({
          message: "Внутренняя ошибка сервера",
          data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
        });
        expect(await tokens()).toEqual(before);
        const [events] = await conn.query<RowDataPacket[]>(
          "SELECT userId FROM push_consent_events WHERE userId=8431",
        );
        expect(events).toEqual([]);
      },
    );
  },
);
