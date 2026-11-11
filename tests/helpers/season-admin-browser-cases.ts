import { expect, it, vi } from "vitest";
import {
  expect as browserExpect,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import type { Connection, RowDataPacket } from "mysql2/promise";
import type { LaunchConfiguration } from "../../packages/shared/src/launch-settings";
import { COOKIE_NAME } from "../../packages/shared/src/const";
import { sdk } from "../../apps/backend/src/_core/sdk";

interface SeasonFixture {
  connection: Pick<Connection, "query">;
  rows(sql: string, args?: unknown[]): Promise<RowDataPacket[]>;
  context: BrowserContext;
  frontend: string;
  base: string;
  actorId: number;
  memberId: number;
}
const initial: LaunchConfiguration = {
  timezone: "Europe/Moscow",
  seasonMode: "calendar",
  fixedSeason: "winter",
  managerEmail: "synthetic-season-manager@example.test",
  seasons: {
    winter: { startsOn: "12-01", backgroundUrl: null, bannerUrl: null },
    spring: { startsOn: "03-01", backgroundUrl: null, bannerUrl: null },
    summer: { startsOn: "06-01", backgroundUrl: null, bannerUrl: null },
    autumn: { startsOn: "09-01", backgroundUrl: null, bannerUrl: null },
  },
};
async function open(page: Page, frontend: string) {
  // Открывает реальную форму сезонов и ждёт базовую дату тестовой конфигурации до начала изменений.

  await page.goto(frontend + "admin");
  await page.getByRole("button", { name: "Сезоны", exact: true }).click();
  const form = page.getByRole("form", { name: "Настройки сезонов" });
  await browserExpect(
    form.getByLabel("Зима: дата начала", { exact: true }),
  ).toHaveValue("12-01");
  return form;
}
export function registerSeasonAdminBrowserCases(fixture: () => SeasonFixture) {
  // Проверяет весь контракт сезонов: валидацию, ревизии, потерю ACK, отзыв сессии, fallback картинок и московские границы.

  async function withSettings(run: (value: SeasonFixture) => Promise<void>) {
    // Требует пустой singleton одноразовой БД и удаляет его только при собственной почте-маркере и ожидаемом диапазоне ревизий.

    const value = fixture();
    expect(
      await value.rows("SELECT id FROM launch_settings WHERE id=1"),
    ).toEqual([]);
    await value.connection.query(
      "INSERT INTO launch_settings (id,revision,config) VALUES (1,31,?)",
      [JSON.stringify(initial)],
    );
    try {
      await run(value);
    } finally {
      await value.connection.query(
        "DELETE FROM launch_settings WHERE id=1 AND revision BETWEEN 31 AND 35 AND JSON_UNQUOTE(JSON_EXTRACT(config,'$.managerEmail'))=?",
        [initial.managerEmail],
      );
    }
  }
  it("S1 validates annual dates and saves all seasonal fields through native API and SQL", async () => {
    // Сценарий: Валидация 29 февраля и одинаковых дат не пишет SQL; корректные даты, режим и ссылки сохраняются одной ревизией и аудитом.

    await withSettings(async ({ rows, context, frontend, actorId }) => {
      const before = await rows("SELECT * FROM launch_settings WHERE id=1");
      const paymentIds = await rows("SELECT id FROM club_payments ORDER BY id");
      const page = await context.newPage();
      const form = await open(page, frontend);
      const save = form.getByRole("button", {
        name: "Сохранить сезоны",
        exact: true,
      });
      const spring = form.getByLabel("Весна: дата начала", { exact: true });
      await spring.fill("02-29");
      await save.click();
      await browserExpect(form.getByRole("alert")).toContainText(
        "29 февраля не поддерживается",
      );
      expect(await rows("SELECT * FROM launch_settings WHERE id=1")).toEqual(
        before,
      );
      await spring.fill("12-01");
      await save.click();
      await browserExpect(form.getByRole("alert")).toContainText(
        "Даты начала четырёх сезонов должны отличаться",
      );
      expect(await rows("SELECT * FROM launch_settings WHERE id=1")).toEqual(
        before,
      );
      await spring.fill("03-21");
      await form
        .getByRole("combobox", { name: "Режим смены сезонов", exact: true })
        .selectOption("fixed");
      await form
        .getByRole("combobox", { name: "Фиксированный сезон", exact: true })
        .selectOption("summer");
      await form
        .getByLabel("Лето: фон", { exact: true })
        .fill("https://assets.example.test/summer.webp");
      await form
        .getByLabel("Лето: баннер", { exact: true })
        .fill("https://assets.example.test/summer-banner.webp");
      const expected = {
        ...initial,
        seasonMode: "fixed",
        fixedSeason: "summer",
        seasons: {
          ...initial.seasons,
          spring: { ...initial.seasons.spring, startsOn: "03-21" },
          summer: {
            startsOn: "06-01",
            backgroundUrl: "https://assets.example.test/summer.webp",
            bannerUrl: "https://assets.example.test/summer-banner.webp",
          },
        },
      };
      const [response] = await Promise.all([
        page.waitForResponse(
          (reply) =>
            new URL(reply.url()).pathname === "/api/admin/launch-settings" &&
            reply.request().method() === "PUT",
        ),
        save.click(),
      ]);
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual({ revision: 32, config: expected });
      await browserExpect(
        form
          .getByRole("status")
          .getByText("Настройки сезонов сохранены.", { exact: true }),
      ).toBeVisible();
      const saved = await rows(
        "SELECT revision,CAST(config AS CHAR) AS config,updatedBy FROM launch_settings WHERE id=1",
      );
      expect(saved).toHaveLength(1);
      expect(saved[0].revision).toBe(32);
      expect(saved[0].updatedBy).toBe(actorId);
      expect(JSON.parse(saved[0].config)).toEqual(expected);
      expect(
        await rows(
          "SELECT action,details FROM admin_audit_log WHERE actorUserId=?",
          [actorId],
        ),
      ).toEqual([{ action: "update_launch_settings", details: "revision:32" }]);
      await page.reload();
      await page.getByRole("button", { name: "Сезоны", exact: true }).click();
      const reopened = page.getByRole("form", { name: "Настройки сезонов" });
      await browserExpect(
        reopened.getByLabel("Весна: дата начала", { exact: true }),
      ).toHaveValue("03-21");
      await browserExpect(
        reopened.getByLabel("Лето: фон", { exact: true }),
      ).toHaveValue("https://assets.example.test/summer.webp");
      await browserExpect(
        reopened.getByLabel("Лето: баннер", { exact: true }),
      ).toHaveValue("https://assets.example.test/summer-banner.webp");
      await browserExpect(
        reopened.getByRole("combobox", {
          name: "Фиксированный сезон",
          exact: true,
        }),
      ).toHaveValue("summer");
      expect(await rows("SELECT id FROM club_payments ORDER BY id")).toEqual(
        paymentIds,
      );
    });
  }, 30_000);
  it("S1 confirms a committed season save after losing its native HTTP reply without a second write", async () => {
    // Сценарий: Потеря ответа после commit блокирует PUT до чтения; совпавшая серверная конфигурация подтверждает исходную запись без второго эффекта.

    await withSettings(async ({ rows, context, frontend, base, actorId }) => {
      const page = await context.newPage();
      const form = await open(page, frontend);
      await form
        .getByLabel("Весна: дата начала", { exact: true })
        .fill("03-21");
      let writes = 0;
      await page.route("**/api/admin/launch-settings", async (route) => {
        if (route.request().method() !== "PUT") return route.fallback();
        writes++;
        const response = await route.fetch({
          url: base + "/api/admin/launch-settings",
          maxRedirects: 0,
        });
        expect(response.status()).toBe(200);
        expect(await response.json()).toMatchObject({
          revision: 32,
          config: {
            managerEmail: initial.managerEmail,
            seasons: { spring: { startsOn: "03-21" } },
          },
        });
        return route.abort("failed");
      });
      const save = form.getByRole("button", {
        name: "Сохранить сезоны",
        exact: true,
      });
      await save.click();
      await browserExpect(form.getByRole("alert")).toContainText(
        "Сохранение не подтверждено",
      );
      await browserExpect(save).toBeDisabled();
      await browserExpect(
        form.getByLabel("Весна: дата начала", { exact: true }),
      ).toHaveValue("03-21");
      const committed = await rows("SELECT * FROM launch_settings WHERE id=1");
      expect(committed[0].revision).toBe(32);
      await form
        .getByRole("button", { name: "Проверить настройки", exact: true })
        .click();
      await browserExpect(
        form
          .getByRole("status")
          .getByText("Актуальные настройки совпадают с вашим вариантом.", {
            exact: true,
          }),
      ).toBeVisible();
      await browserExpect(
        form.getByLabel("Весна: дата начала", { exact: true }),
      ).toBeEnabled();
      await browserExpect(save).toBeDisabled();
      expect(writes).toBe(1);
      expect(await rows("SELECT * FROM launch_settings WHERE id=1")).toEqual(
        committed,
      );
      expect(
        await rows(
          "SELECT action,details FROM admin_audit_log WHERE actorUserId=?",
          [actorId],
        ),
      ).toEqual([{ action: "update_launch_settings", details: "revision:32" }]);
    });
  }, 30_000);
  it.each([
    ["http://assets.example.test/summer.webp", "Лето: фон"],
    ["javascript:alert(1)", "Лето: баннер"],
    [
      "https://synthetic:synthetic@assets.example.test/summer.webp",
      "Лето: фон",
    ],
  ])(
    "S1 rejects unsafe seasonal image URL %s before any native write",
    async (url, label) => {
    // Сценарий: HTTP, javascript и URL с credentials отклоняются до сети, сохраняя ввод и не создавая аудит.

      await withSettings(async ({ rows, context, frontend, actorId }) => {
        const before = await rows("SELECT * FROM launch_settings WHERE id=1");
        const page = await context.newPage();
        const form = await open(page, frontend);
        let writes = 0;
        page.on("request", (request) => {
          if (
            new URL(request.url()).pathname === "/api/admin/launch-settings" &&
            request.method() === "PUT"
          )
            writes++;
        });
        await form.getByLabel(label, { exact: true }).fill(url);
        await form
          .getByRole("button", { name: "Сохранить сезоны", exact: true })
          .click();
        await browserExpect(form.getByRole("alert")).toContainText(
          "HTTPS-ссылки без логина и пароля",
        );
        await browserExpect(
          form.getByLabel(label, { exact: true }),
        ).toHaveValue(url);
        await browserExpect(form.getByRole("status")).toHaveCount(0);
        expect(await rows("SELECT * FROM launch_settings WHERE id=1")).toEqual(
          before,
        );
        expect(
          await rows("SELECT action FROM admin_audit_log WHERE actorUserId=?", [
            actorId,
          ]),
        ).toEqual([]);
        expect(writes).toBe(0);
      });
    },
    30_000,
  );
  it("S1 discards a committed native season reply released after server session revocation", async () => {
    // Сценарий: Удержанный закоммиченный ответ после отзыва сессии не возвращает закрытую форму или сообщение успеха.

    await withSettings(
      async ({ rows, connection, context, frontend, base, actorId }) => {
        const page = await context.newPage();
        const form = await open(page, frontend);
        await form
          .getByLabel("Весна: дата начала", { exact: true })
          .fill("03-21");
        let release!: () => void, finish!: () => void;
        const held = new Promise<void>((resolve) => {
          release = resolve;
        });
        const finished = new Promise<void>((resolve) => {
          finish = resolve;
        });
        let writes = 0,
          captured = false;
        await page.route("**/api/admin/launch-settings", async (route) => {
          if (route.request().method() !== "PUT") return route.fallback();
          writes++;
          try {
            const response = await route.fetch({
              url: base + "/api/admin/launch-settings",
              maxRedirects: 0,
            });
            expect(response.status()).toBe(200);
            expect(await response.json()).toMatchObject({
              revision: 32,
              config: {
                managerEmail: initial.managerEmail,
                seasons: { spring: { startsOn: "03-21" } },
              },
            });
            captured = true;
            // Native commit is complete; only the return transport is held.
            await held;
            await route.fulfill({ response });
          } finally {
            finish();
          }
        });
        try {
          await form
            .getByRole("button", { name: "Сохранить сезоны", exact: true })
            .click();
          await browserExpect.poll(() => captured).toBe(true);
          const committed = await rows(
            "SELECT * FROM launch_settings WHERE id=1",
          );
          expect(committed[0].revision).toBe(32);
          await connection.query(
            "UPDATE users SET sessionVersion=1 WHERE id=? AND openId='binding-browser-admin' AND sessionVersion=0",
            [actorId],
          );
          const [identity] = await Promise.all([
            page.waitForResponse(
              (reply) => new URL(reply.url()).pathname === "/api/auth/me",
            ),
            page.evaluate(() => window.dispatchEvent(new Event("online"))),
          ]);
          expect(identity.status()).toBe(200);
          expect(await identity.json()).toMatchObject({ user: null });
          await browserExpect(form).toHaveCount(0);
          await browserExpect(page).toHaveURL(/\/login(?:\?|$)/);
          release();
          await finished;
          await browserExpect(form).toHaveCount(0);
          await browserExpect(
            page.getByText("Настройки сезонов сохранены.", { exact: true }),
          ).toHaveCount(0);
          expect(writes).toBe(1);
          expect(
            await rows("SELECT * FROM launch_settings WHERE id=1"),
          ).toEqual(committed);
          expect(
            await rows(
              "SELECT action,details FROM admin_audit_log WHERE actorUserId=?",
              [actorId],
            ),
          ).toEqual([
            { action: "update_launch_settings", details: "revision:32" },
          ]);
          expect(
            await rows(
              "SELECT role,sessionVersion,blockedAt FROM users WHERE id=?",
              [actorId],
            ),
          ).toEqual([{ role: "admin", sessionVersion: 1, blockedAt: null }]);
        } finally {
          release();
          if (writes) await finished;
        }
      },
    );
  }, 30_000);
  it.each(["save", "inspect"] as const)(
    "S1 closes the private season form when a revoked native session attempts %s",
    async (action) => {
    // Сценарий: Отозванный JWT не читает и не изменяет приватные настройки; форма уходит во вход, конфигурация и аудит сохранены.

      await withSettings(
        async ({ rows, connection, context, frontend, actorId }) => {
          const before = await rows("SELECT * FROM launch_settings WHERE id=1");
          const page = await context.newPage();
          const form = await open(page, frontend);
          await form
            .getByLabel("Весна: дата начала", { exact: true })
            .fill("03-21");
          // Invalidate only this synthetic account's existing JWT, not its role.
          await connection.query(
            "UPDATE users SET sessionVersion=1 WHERE id=? AND openId='binding-browser-admin' AND sessionVersion=0",
            [actorId],
          );
          const identity = await rows(
            "SELECT id,role,sessionVersion,blockedAt FROM users WHERE id=?",
            [actorId],
          );
          expect(identity).toEqual([
            { id: actorId, role: "admin", sessionVersion: 1, blockedAt: null },
          ]);
          const method = action === "save" ? "PUT" : "GET";
          const [response] = await Promise.all([
            page.waitForResponse(
              (reply) =>
                new URL(reply.url()).pathname ===
                  "/api/admin/launch-settings" &&
                reply.request().method() === method,
            ),
            form
              .getByRole("button", {
                name:
                  action === "save"
                    ? "Сохранить сезоны"
                    : "Проверить настройки",
                exact: true,
              })
              .click(),
          ]);
          expect(response.status()).toBe(401);
          expect(response.headers()["cache-control"]).toBe("no-store");
          await browserExpect(form).toHaveCount(0);
          await browserExpect(page).toHaveURL(/\/login(?:\?|$)/);
          await browserExpect(
            page.getByText("Настройки сезонов сохранены.", { exact: true }),
          ).toHaveCount(0);
          expect(
            await rows("SELECT * FROM launch_settings WHERE id=1"),
          ).toEqual(before);
          expect(
            await rows(
              "SELECT action FROM admin_audit_log WHERE actorUserId=?",
              [actorId],
            ),
          ).toEqual([]);
          expect(
            await rows(
              "SELECT id,role,sessionVersion,blockedAt FROM users WHERE id=?",
              [actorId],
            ),
          ).toEqual(identity);
        },
      );
    },
    30_000,
  );
  it("S1 keeps an uncommitted draft blocked through failed inspection until native unchanged settings allow a manual save", async () => {
    // Сценарий: Потерянный до отправки PUT и отказ проверки удерживают draft заблокированным; неизменённая native база разрешает отдельное ручное сохранение.

    await withSettings(async ({ rows, context, frontend, actorId }) => {
      const before = await rows("SELECT * FROM launch_settings WHERE id=1");
      const page = await context.newPage();
      const form = await open(page, frontend);
      const field = form.getByLabel("Весна: дата начала", { exact: true });
      const save = form.getByRole("button", {
        name: "Сохранить сезоны",
        exact: true,
      });
      const inspect = form.getByRole("button", {
        name: "Проверить настройки",
        exact: true,
      });
      await field.fill("03-21");
      let writes = 0,
        reads = 0;
      await page.route("**/api/admin/launch-settings", async (route) => {
        // Fault before forwarding: neither failed request reaches native API.
        if (route.request().method() === "PUT" && ++writes === 1)
          return route.abort("failed");
        if (route.request().method() === "GET" && ++reads === 1)
          return route.abort("failed");
        return route.fallback();
      });
      await save.click();
      await browserExpect(form.getByRole("alert")).toContainText(
        "Сохранение не подтверждено",
      );
      await browserExpect(save).toBeDisabled();
      await browserExpect(field).toHaveValue("03-21");
      await inspect.click();
      await browserExpect(inspect).toBeEnabled();
      await browserExpect(form.getByRole("alert")).toBeVisible();
      await browserExpect(save).toBeDisabled();
      await browserExpect(field).toHaveValue("03-21");
      expect(writes).toBe(1);
      expect(reads).toBe(1);
      expect(await rows("SELECT * FROM launch_settings WHERE id=1")).toEqual(
        before,
      );
      expect(
        await rows("SELECT action FROM admin_audit_log WHERE actorUserId=?", [
          actorId,
        ]),
      ).toEqual([]);
      const [checked] = await Promise.all([
        page.waitForResponse(
          (reply) =>
            new URL(reply.url()).pathname === "/api/admin/launch-settings" &&
            reply.request().method() === "GET",
        ),
        inspect.click(),
      ]);
      expect(checked.status()).toBe(200);
      expect(await checked.json()).toEqual({ revision: 31, config: initial });
      await browserExpect(
        form
          .getByRole("status")
          .getByText(
            "Настройки проверены. Ваш ввод сохранён; можно сохранить его отдельно.",
            { exact: true },
          ),
      ).toBeVisible();
      await browserExpect(field).toHaveValue("03-21");
      await browserExpect(field).toBeEnabled();
      await browserExpect(save).toBeEnabled();
      expect(writes).toBe(1);
      expect(await rows("SELECT * FROM launch_settings WHERE id=1")).toEqual(
        before,
      );
      const [saved] = await Promise.all([
        page.waitForResponse(
          (reply) =>
            new URL(reply.url()).pathname === "/api/admin/launch-settings" &&
            reply.request().method() === "PUT",
        ),
        save.click(),
      ]);
      expect(saved.status()).toBe(200);
      expect(await saved.json()).toEqual({
        revision: 32,
        config: {
          ...initial,
          seasons: {
            ...initial.seasons,
            spring: { ...initial.seasons.spring, startsOn: "03-21" },
          },
        },
      });
      await browserExpect(
        form
          .getByRole("status")
          .getByText("Настройки сезонов сохранены.", { exact: true }),
      ).toBeVisible();
      expect(writes).toBe(2);
      const committed = await rows(
        "SELECT revision,updatedBy,CAST(config AS CHAR) AS config FROM launch_settings WHERE id=1",
      );
      expect(committed).toHaveLength(1);
      expect(committed[0].revision).toBe(32);
      expect(committed[0].updatedBy).toBe(actorId);
      expect(JSON.parse(committed[0].config).seasons.spring.startsOn).toBe(
        "03-21",
      );
      expect(
        await rows(
          "SELECT action,details FROM admin_audit_log WHERE actorUserId=?",
          [actorId],
        ),
      ).toEqual([{ action: "update_launch_settings", details: "revision:32" }]);
    });
  }, 30_000);
  it("S1 preserves a stale admin draft until an explicit confirmed load of the winning native revision", async () => {
    // Сценарий: Проигравшая ревизия сохраняет локальный ввод; загрузка выигравших настроек требует явного согласия, dismiss ничего не меняет.

    await withSettings(async ({ rows, context, frontend, actorId }) => {
      const stalePage = await context.newPage();
      const stale = await open(stalePage, frontend);
      await stale
        .getByLabel("Весна: дата начала", { exact: true })
        .fill("03-21");
      const winningPage = await context.newPage();
      const winner = await open(winningPage, frontend);
      await winner
        .getByRole("combobox", { name: "Режим смены сезонов", exact: true })
        .selectOption("fixed");
      await winner
        .getByRole("combobox", { name: "Фиксированный сезон", exact: true })
        .selectOption("summer");
      await winner
        .getByRole("button", { name: "Сохранить сезоны", exact: true })
        .click();
      await browserExpect(
        winner
          .getByRole("status")
          .getByText("Настройки сезонов сохранены.", { exact: true }),
      ).toBeVisible();
      const committed = await rows("SELECT * FROM launch_settings WHERE id=1");
      const [rejected] = await Promise.all([
        stalePage.waitForResponse(
          (reply) =>
            new URL(reply.url()).pathname === "/api/admin/launch-settings" &&
            reply.request().method() === "PUT",
        ),
        stale
          .getByRole("button", { name: "Сохранить сезоны", exact: true })
          .click(),
      ]);
      expect(rejected.status()).toBe(409);
      await browserExpect(stale.getByRole("alert")).toContainText(
        "Настройки уже изменились",
      );
      await browserExpect(
        stale.getByLabel("Весна: дата начала", { exact: true }),
      ).toHaveValue("03-21");
      await stale
        .getByRole("button", { name: "Проверить настройки", exact: true })
        .click();
      await browserExpect(stale.getByRole("alert")).toContainText(
        "На сервере другая версия",
      );
      const load = stale.getByRole("button", {
        name: "Загрузить актуальные настройки",
        exact: true,
      });
      stalePage.once("dialog", (dialog) => dialog.dismiss());
      await load.click();
      await browserExpect(
        stale.getByLabel("Весна: дата начала", { exact: true }),
      ).toHaveValue("03-21");
      await browserExpect(
        stale.getByRole("button", { name: "Сохранить сезоны", exact: true }),
      ).toBeDisabled();
      stalePage.once("dialog", (dialog) => dialog.accept());
      await load.click();
      await browserExpect(
        stale
          .getByRole("status")
          .getByText("Актуальные настройки загружены.", { exact: true }),
      ).toBeVisible();
      await browserExpect(
        stale.getByLabel("Весна: дата начала", { exact: true }),
      ).toHaveValue("03-01");
      await browserExpect(
        stale.getByRole("combobox", {
          name: "Фиксированный сезон",
          exact: true,
        }),
      ).toHaveValue("summer");
      expect(await rows("SELECT * FROM launch_settings WHERE id=1")).toEqual(
        committed,
      );
      expect(
        await rows(
          "SELECT action,details FROM admin_audit_log WHERE actorUserId=?",
          [actorId],
        ),
      ).toEqual([{ action: "update_launch_settings", details: "revision:32" }]);
    });
  }, 30_000);
  it("S1 refreshes the subscribed club from native SQL configuration on pageshow", async () => {
    // Сценарий: Событие pageshow перечитывает native SQL конфигурацию и меняет оформление без новых оплат или изменения настроек из клиента.

    await withSettings(
      async ({ rows, connection, context, frontend, memberId }) => {
        const winter = {
          ...initial,
          seasonMode: "fixed",
          fixedSeason: "winter",
        };
        await connection.query(
          "UPDATE launch_settings SET config=? WHERE id=1 AND revision=31",
          [JSON.stringify(winter)],
        );
        // Synthetic access only: no checkout or provider transaction is invoked.
        await connection.query(
          "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'s1-season-access','paid','0','2030-01-01')",
          [memberId],
        );
        try {
          const access = await rows(
            "SELECT * FROM club_payments WHERE userId=? ORDER BY id",
            [memberId],
          );
          await context.clearCookies();
          await context.addCookies([
            {
              name: COOKIE_NAME,
              value: await sdk.createSessionToken("binding-browser-member", {
                sessionVersion: 0,
              }),
              url: frontend,
              httpOnly: true,
              sameSite: "Lax",
            },
          ]);
          const page = await context.newPage();
          await page.goto(frontend + "club");
          const setup = page.getByRole("dialog", {
            name: "Настройка профиля клуба",
          });
          await browserExpect(setup).toBeVisible();
          await setup
            .getByRole("button", {
              name: "Закрыть настройку профиля",
              exact: true,
            })
            .click();
          const club = page.locator("#root [data-club-season]:visible");
          await browserExpect(club).toHaveAttribute(
            "data-club-season",
            "winter",
          );
          const summer = { ...winter, fixedSeason: "summer" };
          await connection.query(
            "UPDATE launch_settings SET revision=32,config=? WHERE id=1 AND revision=31",
            [JSON.stringify(summer)],
          );
          const committed = await rows(
            "SELECT * FROM launch_settings WHERE id=1",
          );
          const [response] = await Promise.all([
            page.waitForResponse(
              (reply) =>
                new URL(reply.url()).pathname === "/api/launch-config" &&
                reply.request().method() === "GET",
            ),
            // Lifecycle event only, not physical sleep or a mocked API response.
            page.evaluate(() => window.dispatchEvent(new Event("pageshow"))),
          ]);
          expect(response.status()).toBe(200);
          expect(await response.json()).toMatchObject({
            revision: 32,
            season: "summer",
            managerEmail: initial.managerEmail,
            appearance: { backgroundUrl: null, bannerUrl: null },
          });
          await browserExpect(club).toHaveAttribute(
            "data-club-season",
            "summer",
          );
          expect(
            await rows("SELECT * FROM launch_settings WHERE id=1"),
          ).toEqual(committed);
          expect(
            await rows(
              "SELECT * FROM club_payments WHERE userId=? ORDER BY id",
              [memberId],
            ),
          ).toEqual(access);
        } finally {
          await connection.query(
            "DELETE FROM club_payments WHERE userId=? AND orderId='s1-season-access'",
            [memberId],
          );
        }
      },
    );
  }, 30_000);
  it.each([
    ["spring", false, "winter"],
    ["summer", true, "winter"],
    ["autumn", false, "autumn"],
  ] as const)(
    "S1 renders decoded local fallback images for %s (unavailable configured assets: %s)",
    async (season, unavailable, fallback) => {
    // Сценарий: Fallback проверяется реальным декодированием локальных WebP и ненулевыми размерами, а не одним присутствием img.

      await withSettings(
        async ({ rows, connection, context, frontend, memberId }) => {
          const customBackground =
            "https://assets.example.test/s1-unavailable-background.webp";
          const customBanner =
            "https://assets.example.test/s1-unavailable-banner.webp";
          const config = {
            ...initial,
            seasonMode: "fixed",
            fixedSeason: season,
            seasons: {
              ...initial.seasons,
              [season]: {
                ...initial.seasons[season],
                backgroundUrl: unavailable ? customBackground : null,
                bannerUrl: unavailable ? customBanner : null,
              },
            },
          };
          await connection.query(
            "UPDATE launch_settings SET config=? WHERE id=1 AND revision=31",
            [JSON.stringify(config)],
          );
          await connection.query(
            "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'s1-fallback-access','paid','0','2030-01-01')",
            [memberId],
          );
          try {
            const before = await rows(
              "SELECT * FROM launch_settings WHERE id=1",
            );
            const access = await rows(
              "SELECT * FROM club_payments WHERE userId=? ORDER BY id",
              [memberId],
            );
            await context.clearCookies();
            await context.addCookies([
              {
                name: COOKIE_NAME,
                value: await sdk.createSessionToken("binding-browser-member", {
                  sessionVersion: 0,
                }),
                url: frontend,
                httpOnly: true,
                sameSite: "Lax",
              },
            ]);
            const page = await context.newPage();
            const failed = new Set<string>();
            // The existing external-traffic guard aborts these synthetic URLs.
            page.on("requestfailed", (request) => failed.add(request.url()));
            const reply = page.waitForResponse(
              (response) =>
                new URL(response.url()).pathname === "/api/launch-config",
            );
            await page.goto(frontend + "club");
            const response = await reply;
            expect(response.status()).toBe(200);
            expect(await response.json()).toMatchObject({
              revision: 31,
              season,
              appearance: {
                backgroundUrl: unavailable ? customBackground : null,
                bannerUrl: unavailable ? customBanner : null,
              },
            });
            const setup = page.getByRole("dialog", {
              name: "Настройка профиля клуба",
            });
            await browserExpect(setup).toBeVisible();
            await setup
              .getByRole("button", {
                name: "Закрыть настройку профиля",
                exact: true,
              })
              .click();
            const club = page.locator("#root [data-club-season]:visible");
            await browserExpect(club).toHaveAttribute(
              "data-club-season",
              season,
            );
            const background = club.locator(":scope > img");
            const banner = club
              .getByTestId("club-season-banner")
              .locator("img");
            const winter =
              "/assets/responsive/ea0b60bea0fe-EhNRvSBlhxWjRXfT.w1200.4cceecb893c4381e.webp";
            await browserExpect(background).toHaveAttribute(
              "src",
              fallback === "winter"
                ? winter
                : "/assets/responsive/ff49f6ba1a27-NdnEHWCbQbNuKmyB.w1199.6b2a60f6e3359cff.webp",
            );
            await browserExpect(banner).toHaveAttribute(
              "src",
              fallback === "winter"
                ? winter
                : "/assets/responsive/e8e5386d449f-xGuqHGnxPOYPLwJz.w900.c32035de391abc36.webp",
            );
            // Actual local WebP bytes must decode, not merely occupy an img tag.
            for (const picture of [background, banner]) {
              await browserExpect
                .poll(() =>
                  picture.evaluate(
                    (image: HTMLImageElement) =>
                      image.complete &&
                      image.naturalWidth > 0 &&
                      image.naturalHeight > 0,
                  ),
                )
                .toBe(true);
            }
            const bounds = await club
              .getByTestId("club-season-banner")
              .boundingBox();
            expect(bounds!.width).toBeGreaterThan(0);
            expect(bounds!.height).toBeGreaterThan(0);
            if (unavailable)
              expect(
                [...failed]
                  .filter(
                    (url) => url === customBackground || url === customBanner,
                  )
                  .sort(),
              ).toEqual([customBackground, customBanner].sort());
            expect(
              await rows("SELECT * FROM launch_settings WHERE id=1"),
            ).toEqual(before);
            expect(
              await rows(
                "SELECT * FROM club_payments WHERE userId=? ORDER BY id",
                [memberId],
              ),
            ).toEqual(access);
          } finally {
            await connection.query(
              "DELETE FROM club_payments WHERE userId=? AND orderId='s1-fallback-access'",
              [memberId],
            );
          }
        },
      );
    },
    30_000,
  );
  it.each([
    ["2026-02-28T20:59:59.999Z", "winter", "12-01"],
    ["2026-02-28T21:00:00.000Z", "spring", "03-01"],
    ["2026-05-31T20:59:59.999Z", "spring", "03-01"],
    ["2026-05-31T21:00:00.000Z", "summer", "06-01"],
    ["2026-08-31T20:59:59.999Z", "summer", "06-01"],
    ["2026-08-31T21:00:00.000Z", "autumn", "09-01"],
    ["2026-11-30T20:59:59.999Z", "autumn", "09-01"],
    ["2026-11-30T21:00:00.000Z", "winter", "12-01"],
  ])(
    "S1 serves the SQL-configured season at Moscow boundary %s",
    async (instant, season, startsOn) => {
    // Сценарий: Контролируется только Date API-процесса на московской полуночи каждого сезона; HTTP и SQL таймеры остаются настоящими.

      await withSettings(async ({ rows, base }) => {
        const before = await rows("SELECT * FROM launch_settings WHERE id=1");
        // Only the API process Date is controlled; HTTP/SQL timers remain real.
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date(instant));
        try {
          const response = await fetch(base + "/api/launch-config");
          expect(response.status).toBe(200);
          expect(response.headers.get("cache-control")).toBe("no-store");
          expect(await response.json()).toMatchObject({
            revision: 31,
            season,
            appearance: { startsOn, backgroundUrl: null, bannerUrl: null },
            managerEmail: initial.managerEmail,
          });
          expect(
            await rows("SELECT * FROM launch_settings WHERE id=1"),
          ).toEqual(before);
        } finally {
          vi.useRealTimers();
        }
      });
    },
  );
}
