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
import { SessionService } from "../apps/backend/src/identity/session.service";

/** Проверяет атомарные настройки запуска, сезоны, managerEmail, ревизии и текущие admin-права. */
describe.skipIf(!testDatabaseUrl)(
  "administrator launch settings on disposable MySQL",
  () => {
    let conn: Connection;
    let application: INestApplication;
    let base: string;
    let token: string;
    const admin = { id: 783, openId: "settings-admin", sessionVersion: 0 };
    const member = { id: 784, openId: "settings-member", sessionVersion: 0 };
    /** Создаёт одноразовую схему, администратора и участника и локальный API с настоящим JWT. */
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
    /** Очищает единственную settings-строку и свой audit и восстанавливает identity администратора. */
    beforeEach(async () => {
      await conn.query("DELETE FROM launch_settings WHERE id=1");
      await conn.query(
        "DELETE FROM admin_audit_log WHERE actorUserId IN (783,784)",
      );
      await conn.query(
        "UPDATE users SET openId='settings-admin', sessionVersion=0, blockedAt=NULL, role='admin' WHERE id=783",
      );
    });
    /** Возвращает перехваченные SessionService методы. */
    afterEach(() => vi.restoreAllMocks());
    /** Закрывает API и соединения и восстанавливает окружение. */
    afterAll(async () => {
      await application?.close();
      await conn?.end();
      await (
        (await getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    /** Сохранение четырёх сезонов и managerEmail увеличивает revision и записывает автора в audit. */
    it("persists all four seasonal sets and manager email and audits the author", async () => {
      const config = structuredClone(defaultLaunchConfiguration);
      config.seasonMode = "calendar";
      config.managerEmail = "manager@example.test";
      config.seasons.spring.bannerUrl =
        "https://assets.example.test/spring.webp";
      const saved = await saveLaunchConfiguration(
        (await getDb())!,
        admin,
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
    /** Две конкурирующие правки revision=0 дают только один коммит. */
    it("allows one concurrent edit and rejects the stale edit instead of overwriting it", async () => {
      const results = await Promise.allSettled([
        saveLaunchConfiguration(
          (await getDb())!,
          admin,
          0,
          defaultLaunchConfiguration,
        ),
        saveLaunchConfiguration((await getDb())!, admin, 0, {
          ...defaultLaunchConfiguration,
          managerEmail: "other@example.test",
        }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
      expect((await getLaunchConfiguration((await getDb())!)).revision).toBe(1);
    });
    /** HTML sharing-page Яндекс Диска отклоняется понятной ошибкой прямого URL без settings/audit записи. */
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
    /** User и недавно заблокированный admin не сохраняют настройки. */
    it("rejects ordinary users and freshly blocked administrators", async () => {
      await expect(
        saveLaunchConfiguration(
          (await getDb())!,
          member,
          0,
          defaultLaunchConfiguration,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=783");
      await expect(
        saveLaunchConfiguration(
          (await getDb())!,
          admin,
          0,
          defaultLaunchConfiguration,
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect((await getLaunchConfiguration((await getDb())!)).revision).toBe(0);
    });
    /** Email injection, неверные сезонные даты и активные URL отклоняются до записи. */
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
          saveLaunchConfiguration((await getDb())!, admin, 0, {
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
    /** Admin REST roundtrip сохраняет конфигурацию, публичный endpoint выдаёт текущий сезон с no-store, приватный требует сессию. */
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
    /** Отправляет REST PUT настроек с выбранным Bearer и JSON-телом. */
    const update = (body: unknown, bearer = token) =>
      fetch(`${base}/api/admin/launch-settings`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${bearer}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    /** Logout либо замена identity после session-read запрещают поздний save и сохраняют прежний settings/audit. */
    it.each(["logout", "account replacement"])(
      "preserves settings and audit history after %s during a save",
      async (change) => {
        const initial = await update({
          expectedRevision: 0,
          config: defaultLaunchConfiguration,
        });
        expect(initial.status).toBe(200);
        const before = await initial.json();
        /** Читает собственный audit настроек для сравнения до и после отозванного save. */
        const readAudit = async () => {
          const [audit] = await conn.query<RowDataPacket[]>(
            "SELECT id,action,details FROM admin_audit_log WHERE actorUserId=783 ORDER BY id",
          );
          return audit;
        };
        const auditBefore = await readAudit();
        expect(auditBefore).toHaveLength(1);
        const sessions = application.get(SessionService);
        const readSession = sessions.optionalUser.bind(sessions);
        let entered!: () => void;
        let release!: () => void;
        const authenticated = new Promise<void>((resolve) => {
          entered = resolve;
        });
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        // Останавливаем запрос после проверки JWT и до записи настроек.
        vi.spyOn(sessions, "optionalUser").mockImplementationOnce(async (req) => {
          const actor = await readSession(req);
          entered();
          await gate;
          return actor;
        });
        const pending = update({
          expectedRevision: 1,
          config: {
            ...defaultLaunchConfiguration,
            managerEmail: "late-edit@example.test",
          },
        });
        try {
          await Promise.race([
            authenticated,
            pending.then(() => {
              throw new Error("Expected authenticated request to pause");
            }),
          ]);
          if (change === "logout") {
            const logout = await fetch(`${base}/api/auth/logout`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            });
            expect(logout.status).toBe(200);
            expect(await logout.json()).toEqual({ success: true });
          } else {
            await conn.query(
              "UPDATE users SET openId='settings-replaced-admin' WHERE id=783",
            );
          }
          release();
          const response = await pending;
          expect(response.status).toBe(401);
          expect(response.headers.get("cache-control")).toBe("no-store");
          expect(await response.json()).toEqual({ error: "Запрос недоступен" });
          expect(await getLaunchConfiguration((await getDb())!)).toEqual(before);
          expect(await readAudit()).toEqual(auditBefore);
        } finally {
          release();
          await pending.catch(() => {});
        }
      },
    );
    /** REST 409 сохраняет принятую конфигурацию и не добавляет audit для stale revision. */
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
    /** Невалидный JSON не отражает injection в ответе и не создаёт settings/audit. */
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
    /** Действующая JWT не сохраняет admin-доступ после снятия роли ни для GET, ни для PUT. */
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
    /** Новая блокировка запрещает чтение и запись по прежней JWT. */
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
    /** Неверный Content-Type отклоняется с 415 до аутентификации. */
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
/** Проверяет годовую границу сезонов по московскому времени независимо от timezone сервера. */
describe("annual season selection uses Moscow time, not server locale", () => {
  const config = {
    ...defaultLaunchConfiguration,
    seasonMode: "calendar" as const,
  };
  /** Граничные UTC-моменты выбирают согласованный сезон московского календаря. */
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
