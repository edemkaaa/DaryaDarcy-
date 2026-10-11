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
  await page.goto(frontend + "admin");
  await page.getByRole("button", { name: "Сезоны", exact: true }).click();
  const form = page.getByRole("form", { name: "Настройки сезонов" });
  await browserExpect(
    form.getByLabel("Зима: дата начала", { exact: true }),
  ).toHaveValue("12-01");
  return form;
}
export function registerSeasonAdminBrowserCases(fixture: () => SeasonFixture) {
  async function withSettings(run: (value: SeasonFixture) => Promise<void>) {
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
      await browserExpect(form.getByRole("status")).toHaveText(
        "Настройки сезонов сохранены.",
      );
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
      await browserExpect(form.getByRole("status")).toHaveText(
        "Актуальные настройки совпадают с вашим вариантом.",
      );
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
  it("S1 preserves a stale admin draft until an explicit confirmed load of the winning native revision", async () => {
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
      await browserExpect(winner.getByRole("status")).toHaveText(
        "Настройки сезонов сохранены.",
      );
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
      await browserExpect(stale.getByRole("status")).toHaveText(
        "Актуальные настройки загружены.",
      );
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
