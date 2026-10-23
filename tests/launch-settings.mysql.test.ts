import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { getDb } from "../apps/backend/src/db";
import {
  currentSeason,
  defaultLaunchConfiguration,
  getLaunchConfiguration,
  saveLaunchConfiguration,
} from "../apps/backend/src/launch/settings";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";

describe.skipIf(!testDatabaseUrl)(
  "administrator launch settings on disposable MySQL",
  () => {
    let conn: Connection;
    let application: INestApplication;
    let base: string;
    let token: string;
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      await conn.query(
        "INSERT IGNORE INTO users (id,openId,role) VALUES (783,'settings-admin','admin'),(784,'settings-member','user')",
      );
      vi.stubEnv("JWT_SECRET", "settings-test-only-secret-32-chars");
      vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
      token = await sdk.createSessionToken("settings-admin", {
        sessionVersion: 0,
      });
      application = await createBackendApplication();
      await application.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
    });
    beforeEach(async () => {
      await conn.query("DELETE FROM launch_settings WHERE id=1");
      await conn.query(
        "DELETE FROM admin_audit_log WHERE actorUserId IN (783,784)",
      );
      await conn.query(
        "UPDATE users SET blockedAt=NULL, role='admin' WHERE id=783",
      );
    });
    afterAll(async () => {
      await application?.close();
      await conn?.end();
      await (
        (await getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    it("persists all four seasonal sets and manager email and audits the author", async () => {
      const config = structuredClone(defaultLaunchConfiguration);
      config.seasonMode = "calendar";
      config.managerEmail = "manager@example.test";
      config.seasons.spring.bannerUrl =
        "https://assets.example.test/spring.webp";
      const saved = await saveLaunchConfiguration(
        (await getDb())!,
        783,
        0,
        config,
      );
      expect(saved).toEqual({ revision: 1, config });
      expect(await getLaunchConfiguration((await getDb())!)).toEqual(saved);
      const [audit] = await conn.query<RowDataPacket[]>(
        "SELECT action FROM admin_audit_log WHERE actorUserId=783",
      );
      expect(audit).toEqual([{ action: "update_launch_settings" }]);
    });
    it("allows one concurrent edit and rejects the stale edit instead of overwriting it", async () => {
      const results = await Promise.allSettled([
        saveLaunchConfiguration(
          (await getDb())!,
          783,
          0,
          defaultLaunchConfiguration,
        ),
        saveLaunchConfiguration((await getDb())!, 783, 0, {
          ...defaultLaunchConfiguration,
          managerEmail: "other@example.test",
        }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
      expect((await getLaunchConfiguration((await getDb())!)).revision).toBe(1);
    });
    it("returns an actionable HTTP error for a Yandex sharing page without saving or auditing", async () => {
      const config = structuredClone(defaultLaunchConfiguration);
      config.seasons.winter.bannerUrl =
        "https://disk.yandex.ru/i/iXiEA9lCjqzCkA";
      const response = await fetch(base + "/api/admin/launch-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          cookie: `app_session_id=${token}`,
        },
        body: JSON.stringify({ expectedRevision: 0, config }),
      });
      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("прямую ссылку");
      expect((await getLaunchConfiguration((await getDb())!)).revision).toBe(0);
      const [audit] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM admin_audit_log WHERE actorUserId=783",
      );
      expect(audit).toHaveLength(0);
    });
    it("rejects ordinary users and freshly blocked administrators", async () => {
      await expect(
        saveLaunchConfiguration(
          (await getDb())!,
          784,
          0,
          defaultLaunchConfiguration,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=783");
      await expect(
        saveLaunchConfiguration(
          (await getDb())!,
          783,
          0,
          defaultLaunchConfiguration,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect((await getLaunchConfiguration((await getDb())!)).revision).toBe(0);
    });
    it.each([
      { managerEmail: "bad\r\nBcc:someone@example.test" },
      {
        seasons: {
          ...defaultLaunchConfiguration.seasons,
          spring: {
            ...defaultLaunchConfiguration.seasons.spring,
            startsOn: "02-29",
          },
        },
      },
      {
        seasons: {
          ...defaultLaunchConfiguration.seasons,
          spring: {
            ...defaultLaunchConfiguration.seasons.spring,
            startsOn: "04-31",
          },
        },
      },
      {
        seasons: {
          ...defaultLaunchConfiguration.seasons,
          spring: {
            ...defaultLaunchConfiguration.seasons.spring,
            startsOn: "11-20",
          },
        },
      },
      {
        seasons: {
          ...defaultLaunchConfiguration.seasons,
          spring: {
            ...defaultLaunchConfiguration.seasons.spring,
            bannerUrl: "javascript:alert(1)",
          },
        },
      },
    ])(
      "rejects invalid admin JSON without a settings row or audit event",
      async (patch) => {
        await expect(
          saveLaunchConfiguration((await getDb())!, 783, 0, {
            ...defaultLaunchConfiguration,
            ...patch,
          }),
        ).rejects.toMatchObject({ code: "BAD_REQUEST" });
        const [rows] = await conn.query<RowDataPacket[]>(
          "SELECT id FROM launch_settings",
        );
        const [audit] = await conn.query<RowDataPacket[]>(
          "SELECT id FROM admin_audit_log WHERE actorUserId=783",
        );
        expect(rows).toEqual([]);
        expect(audit).toEqual([]);
      },
    );
    it("supports real authenticated HTTP admin roundtrip and public current-season settings", async () => {
      const config = {
        ...defaultLaunchConfiguration,
        managerEmail: "manager@example.test",
      };
      const response = await fetch(`${base}/api/admin/launch-settings`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expectedRevision: 0, config }),
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ revision: 1, config });
      const privateRead = await fetch(`${base}/api/admin/launch-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(await privateRead.json()).toEqual({ revision: 1, config });
      const publicRead = await fetch(`${base}/api/launch-config`);
      expect(await publicRead.json()).toMatchObject({
        revision: 1,
        season: "winter",
        managerEmail: "manager@example.test",
        orderMethod: "email-client",
      });
      expect(publicRead.headers.get("cache-control")).toBe("no-store");
      expect((await fetch(`${base}/api/admin/launch-settings`)).status).toBe(
        401,
      );
    });
    const update = (body: unknown, bearer = token) =>
      fetch(`${base}/api/admin/launch-settings`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${bearer}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    it("preserves HTTP revision conflict and does not overwrite or audit a stale edit", async () => {
      const first = await update({
        expectedRevision: 0,
        config: defaultLaunchConfiguration,
      });
      expect(first.status).toBe(200);
      const stale = await update({
        expectedRevision: 0,
        config: {
          ...defaultLaunchConfiguration,
          managerEmail: "stale@example.test",
        },
      });
      expect(stale.status).toBe(409);
      expect(await stale.json()).toEqual({
        error: "Настройки изменились. Обновите страницу",
      });
      expect(stale.headers.get("cache-control")).toBe("no-store");
      expect((await getLaunchConfiguration((await getDb())!)).config).toEqual(
        defaultLaunchConfiguration,
      );
      const [audit] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM admin_audit_log WHERE actorUserId=783",
      );
      expect(audit).toHaveLength(1);
    });
    it("preserves safe validation errors without storing attacker JSON", async () => {
      const response = await update({
        expectedRevision: 0,
        config: {
          ...defaultLaunchConfiguration,
          managerEmail: "bad\r\nBcc:attacker@example.test",
        },
      });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Запрос недоступен" });
      expect((await getLaunchConfiguration((await getDb())!)).revision).toBe(0);
      const [audit] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM admin_audit_log WHERE actorUserId=783",
      );
      expect(audit).toEqual([]);
    });
    it.each(["GET", "PUT"])(
      "rechecks the current database role for a valid JWT on %s",
      async (method) => {
        await conn.query("UPDATE users SET role='user' WHERE id=783");
        const response = await fetch(`${base}/api/admin/launch-settings`, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          ...(method === "PUT"
            ? {
                body: JSON.stringify({
                  expectedRevision: 0,
                  config: defaultLaunchConfiguration,
                }),
              }
            : {}),
        });
        expect(response.status).toBe(403);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect((await getLaunchConfiguration((await getDb())!)).revision).toBe(
          0,
        );
      },
    );
    it.each(["GET", "PUT"])(
      "rejects a newly blocked administrator with an existing JWT on %s",
      async (method) => {
        await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=783");
        const response = await fetch(`${base}/api/admin/launch-settings`, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          ...(method === "PUT"
            ? {
                body: JSON.stringify({
                  expectedRevision: 0,
                  config: defaultLaunchConfiguration,
                }),
              }
            : {}),
        });
        expect(response.status).toBe(401);
        expect((await getLaunchConfiguration((await getDb())!)).revision).toBe(
          0,
        );
      },
    );
    it("rejects non-JSON settings before attempting admin authentication", async () => {
      const response = await fetch(`${base}/api/admin/launch-settings`, {
        method: "PUT",
        body: "expectedRevision=0",
      });
      expect(response.status).toBe(415);
      expect(response.headers.get("cache-control")).toBe("no-store");
    });
  },
);
describe("annual season selection uses Moscow time, not server locale", () => {
  const config = {
    ...defaultLaunchConfiguration,
    seasonMode: "calendar" as const,
  };
  it.each([
    ["2026-03-19T20:59:59Z", "winter"],
    ["2026-03-19T21:00:00Z", "spring"],
    ["2026-06-01T12:00:00Z", "summer"],
    ["2026-09-01T12:00:00Z", "autumn"],
    ["2026-11-20T12:00:00Z", "winter"],
    ["2027-01-01T12:00:00Z", "winter"],
  ])("selects season at %s", (date, expected) => {
    expect(currentSeason(config, new Date(date))).toBe(expected);
  });
});
