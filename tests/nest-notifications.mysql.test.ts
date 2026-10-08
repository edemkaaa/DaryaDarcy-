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
import { getDb } from "../apps/backend/src/db";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import type { AppRouter } from "../apps/backend/src/routers";

describe.skipIf(!testDatabaseUrl)(
  "notifications through real HTTP, JWT and disposable SQL",
  () => {
    let conn: Connection;
    let app: INestApplication;
    let base: string;
    const fixtureToken = "synthetic-notification-http-device";
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
      await conn.query(
        "DROP TRIGGER IF EXISTS notification_http_write_refusal",
      );
      await conn.query(
        "DELETE FROM push_tokens WHERE token LIKE 'synthetic-notification-http-%'",
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
    });
    afterAll(async () => {
      await app?.close();
      await conn?.query("DELETE FROM push_tokens WHERE token LIKE 'synthetic-notification-http-%'");
      await conn?.query("DELETE FROM push_consent_events WHERE userId BETWEEN 8430 AND 8433");
      await conn?.query("DELETE FROM users WHERE id BETWEEN 8430 AND 8433");
      await conn?.query("SELECT RELEASE_LOCK('backend_test_push_audience')");
      await conn?.end();
      const database = await getDb();
      await (
        database as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    function client(userId?: number) {
      return createTRPCProxyClient<AppRouter>({
        links: [
          httpLink({
            url: `${base}/api/trpc`,
            transformer: superjson,
            headers: async () =>
              userId === undefined
                ? {}
                : {
                    Authorization: `Bearer ${await sdk.createSessionToken(`notification-http-${userId}`, { sessionVersion: 0 })}`,
                  },
          }),
        ],
      });
    }
    async function tokens() {
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT token,userId,platform,enabled FROM push_tokens WHERE token LIKE 'synthetic-notification-http-%' ORDER BY token",
      );
      return rows;
    }
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
    it("purges only the requested user's tokens and retains consent history", async () => {
      await client(8431).notifications.registerToken.mutate({
        token: fixtureToken,
      });
      await client(8431).notifications.registerToken.mutate({
        token: `${fixtureToken}-second`,
      });
      await client(8432).notifications.registerToken.mutate({
        token: `${fixtureToken}-other`,
      });
      await client().notifications.registerToken.mutate({
        token: `${fixtureToken}-anonymous`,
      });
      await client(8431).notifications.setMarketingConsent.mutate({
        enabled: true,
      });
      expect(
        await client(8430).admin.purgeUserPushData.mutate({ userId: 8431 }),
      ).toEqual({ success: true });
      expect(await tokens()).toEqual([
        {
          token: `${fixtureToken}-anonymous`,
          userId: null,
          platform: null,
          enabled: 1,
        },
        {
          token: `${fixtureToken}-other`,
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
