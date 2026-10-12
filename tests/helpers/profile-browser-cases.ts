import { expect, it } from "vitest";
import { expect as browserExpect, type BrowserContext } from "@playwright/test";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { COOKIE_NAME } from "../../packages/shared/src/const";
import { sdk } from "../../apps/backend/src/_core/sdk";

interface ProfileFixture {
  rows(sql: string, args?: unknown[]): Promise<RowDataPacket[]>;
  connection: Pick<Connection, "query">;
  context: BrowserContext;
  frontend: string;
  base: string;
  memberId: number;
}

export function registerProfileBrowserCases(fixture: () => ProfileFixture) {
  it("C3 explicit club setup still saves the chosen name and gender through native SQL", async () => {
    const { rows, connection, context, frontend, memberId } = fixture();
    await connection.query(
      "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'c3-club-setup-access','paid','0','2030-01-01')",
      [memberId],
    );
    const identitySql =
      "SELECT id,email,phone,passwordHash,role,sessionVersion FROM users WHERE id=?";
    const identity = await rows(identitySql, [memberId]);
    const access = await rows("SELECT * FROM club_payments WHERE userId=?", [
      memberId,
    ]);
    try {
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
      let writes = 0;
      page.on("request", (request) => {
        if (
          request.method() === "POST" &&
          request.url().includes("profile.update")
        )
          writes++;
      });
      await page.goto(frontend + "club");
      const setup = page.getByRole("dialog", {
        name: "Настройка профиля клуба",
      });
      await browserExpect(setup).toBeVisible();
      await setup
        .getByPlaceholder("Как тебя зовут?")
        .fill("C3 Explicit club name");
      await setup.getByRole("button", { name: "Женский", exact: true }).click();
      const [saved] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.request().method() === "POST" &&
            response.url().includes("profile.update"),
        ),
        setup.getByRole("button", { name: "Продолжить", exact: true }).click(),
      ]);
      expect(saved.status()).toBe(200);
      await browserExpect(setup).toHaveCount(0);
      await browserExpect(
        page.getByText("Очень рада тебе, дорогая C3 Explicit club name", {
          exact: true,
        }),
      ).toBeVisible();
      expect(
        await rows("SELECT name,gender FROM users WHERE id=?", [memberId]),
      ).toEqual([{ name: "C3 Explicit club name", gender: "female" }]);
      expect(writes).toBe(1);
      expect(await rows(identitySql, [memberId])).toEqual(identity);
      expect(
        await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
      ).toEqual(access);
    } finally {
      await connection.query(
        "DELETE FROM club_payments WHERE userId=? AND orderId='c3-club-setup-access'",
        [memberId],
      );
    }
  }, 30_000);
  it("C3 direct club entry does not replay a stale cached name into native SQL", async () => {
    const { rows, connection, context, frontend, memberId } = fixture();
    await connection.query(
      "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'c3-direct-club-access','paid','0','2030-01-01')",
      [memberId],
    );
    const identitySql =
      "SELECT id,name,email,phone,passwordHash,role,sessionVersion,gender,avatarUrl FROM users WHERE id=?";
    const identity = await rows(identitySql, [memberId]);
    const access = await rows("SELECT * FROM club_payments WHERE userId=?", [
      memberId,
    ]);
    try {
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
      await context.addInitScript((id) => {
        localStorage.setItem(
          `darcy:user:${id}:@darcy_club_profile_name`,
          "C3 stale club name",
        );
        localStorage.setItem(
          `darcy:user:${id}:@darcy_club_profile_gender`,
          "male",
        );
      }, memberId);
      const page = await context.newPage();
      let identityReads = 0;
      let writes = 0;
      page.on("response", (response) => {
        if (new URL(response.url()).pathname === "/api/auth/me")
          identityReads++;
      });
      page.on("request", (request) => {
        if (
          request.method() === "POST" &&
          request.url().includes("profile.update")
        )
          writes++;
      });
      await page.goto(frontend + "club");
      // The mount sync finishes by refreshing native identity, even when no
      // avatar needs migrating. Do not replace it with an arbitrary sleep.
      await browserExpect.poll(() => identityReads).toBeGreaterThanOrEqual(2);
      expect(await rows(identitySql, [memberId])).toEqual(identity);
      expect(writes).toBe(0);
      await browserExpect(
        page.getByText(
          /^Очень рада тебе, (?:дорогая |дорогой )?Browser phone member$/,
        ),
      ).toBeVisible();
      await browserExpect(
        page.getByText(/^Очень рада тебе, .*C3 stale club name$/),
      ).toHaveCount(0);
      expect(
        await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
      ).toEqual(access);
    } finally {
      await connection.query(
        "DELETE FROM club_payments WHERE userId=? AND orderId='c3-direct-club-access'",
        [memberId],
      );
    }
  }, 30_000);
  it("C3 profile name reconciles native identity instead of replaying stale browser cache", async () => {
    const { rows, connection, context, frontend, memberId } = fixture();
    await connection.query(
      "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'c3-profile-access','paid','0','2030-01-01')",
      [memberId],
    );
    const identitySql =
      "SELECT id,email,phone,passwordHash,role,sessionVersion FROM users WHERE id=?";
    const identity = await rows(identitySql, [memberId]);
    const access = await rows("SELECT * FROM club_payments WHERE userId=?", [
      memberId,
    ]);
    try {
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
      await context.addInitScript(
        (id) =>
          localStorage.setItem(
            `darcy:user:${id}:@darcy_club_profile_name`,
            "C3 stale local name",
          ),
        memberId,
      );
      const page = await context.newPage();
      let writes = 0;
      page.on("request", (request) => {
        if (
          request.method() === "POST" &&
          request.url().includes("profile.update")
        )
          writes++;
      });
      const loaded = page.waitForResponse(
        (reply) => new URL(reply.url()).pathname === "/api/auth/me",
      );
      await page.goto(frontend + "profile");
      expect(await (await loaded).json()).toMatchObject({
        user: { name: "Browser phone member" },
      });
      if (process.env.PROFILE_SCREENSHOT_PREFIX) {
        await browserExpect(
          page.getByRole("button", {
            name: /Browser phone member|C3 stale local name/,
          }),
        ).toBeVisible();
        for (const width of [390, 1280]) {
          await page.setViewportSize({ width, height: 900 });
          await page.screenshot({
            path: `${process.env.PROFILE_SCREENSHOT_PREFIX}-${width}.png`,
          });
        }
      }
      await browserExpect(
        page.getByRole("button", { name: "Browser phone member", exact: true }),
      ).toBeVisible();
      await browserExpect(
        page.getByRole("button", { name: "C3 stale local name", exact: true }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(
          (id) =>
            localStorage.getItem(`darcy:user:${id}:@darcy_club_profile_name`),
          memberId,
        ),
      ).toBe("Browser phone member");
      await connection.query(
        "UPDATE users SET name='C3 Fresh server name' WHERE id=? AND openId='binding-browser-member'",
        [memberId],
      );
      const [refreshed] = await Promise.all([
        page.waitForResponse(
          (reply) => new URL(reply.url()).pathname === "/api/auth/me",
        ),
        page.evaluate(() => window.dispatchEvent(new Event("online"))),
      ]);
      expect(await refreshed.json()).toMatchObject({
        user: { name: "C3 Fresh server name" },
      });
      await browserExpect(
        page.getByRole("button", { name: "C3 Fresh server name", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          (id) =>
            localStorage.getItem(`darcy:user:${id}:@darcy_club_profile_name`),
          memberId,
        ),
      ).toBe("C3 Fresh server name");
      await page
        .getByRole("button", { name: "C3 Fresh server name", exact: true })
        .click();
      const draft = page.getByRole("textbox", { name: "Имя профиля" });
      await draft.fill("C3 unsaved draft");
      await connection.query(
        "UPDATE users SET name='C3 Updated during editing' WHERE id=? AND openId='binding-browser-member'",
        [memberId],
      );
      const [updatedDuringEditing] = await Promise.all([
        page.waitForResponse(
          (reply) => new URL(reply.url()).pathname === "/api/auth/me",
        ),
        page.evaluate(() => window.dispatchEvent(new Event("online"))),
      ]);
      expect(await updatedDuringEditing.json()).toMatchObject({
        user: { name: "C3 Updated during editing" },
      });
      await browserExpect(draft).toHaveValue("C3 unsaved draft");
      await browserExpect
        .poll(() =>
          page.evaluate(
            (id) =>
              localStorage.getItem(`darcy:user:${id}:@darcy_club_profile_name`),
            memberId,
          ),
        )
        .toBe("C3 Updated during editing");
      expect(writes).toBe(0);
      expect(
        await rows("SELECT name FROM users WHERE id=?", [memberId]),
      ).toEqual([{ name: "C3 Updated during editing" }]);
      expect(await rows(identitySql, [memberId])).toEqual(identity);
      expect(
        await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
      ).toEqual(access);
    } finally {
      await connection.query(
        "DELETE FROM club_payments WHERE userId=? AND orderId='c3-profile-access'",
        [memberId],
      );
    }
  }, 30_000);
  it("C3 profile name discards native committed success after switching the current account", async () => {
    const { rows, connection, context, frontend, base, memberId } = fixture();
    await connection.query(
      "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'c3-profile-access','paid','0','2030-01-01')",
      [memberId],
    );
    const identitySql =
      "SELECT id,email,phone,passwordHash,role,sessionVersion FROM users WHERE id=? OR openId='binding-browser-admin' ORDER BY id";
    const identities = await rows(identitySql, [memberId]);
    const access = await rows("SELECT * FROM club_payments WHERE userId=?", [
      memberId,
    ]);
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
    await page.goto(frontend + "profile");
    await page
      .getByRole("button", { name: "Browser phone member", exact: true })
      .click();
    const field = page.getByRole("textbox", {
      name: "Имя профиля",
      exact: true,
    });
    await field.fill("C3 Late member name");
    let release!: () => void, finish!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let captured = false,
      writes = 0;
    // A late native success must never publish the previous owner's name or cache.
    await page.route("**/api/trpc/*", async (route) => {
      if (!route.request().url().includes("profile.update"))
        return route.fallback();
      writes++;
      try {
        const url = new URL(route.request().url());
        const response = await route.fetch({
          url: base + url.pathname + url.search,
          maxRedirects: 0,
        });
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect((Array.isArray(body) ? body[0] : body).result.data.json).toEqual(
          { success: true },
        );
        captured = true;
        await held;
        await route.fulfill({ response });
      } finally {
        finish();
      }
    });
    try {
      await field.press("Enter");
      await browserExpect.poll(() => captured).toBe(true);
      await browserExpect(field).toBeDisabled();
      expect(
        await rows("SELECT name FROM users WHERE id=?", [memberId]),
      ).toEqual([{ name: "C3 Late member name" }]);
      await context.clearCookies();
      await context.addCookies([
        {
          name: COOKIE_NAME,
          value: await sdk.createSessionToken("binding-browser-admin", {
            sessionVersion: 0,
          }),
          url: frontend,
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
      const [identity] = await Promise.all([
        page.waitForResponse(
          (reply) => new URL(reply.url()).pathname === "/api/auth/me",
        ),
        page.evaluate(() => window.dispatchEvent(new Event("online"))),
      ]);
      expect(identity.status()).toBe(200);
      expect(await identity.json()).toMatchObject({
        user: { name: "Browser administrator" },
      });
      const adminName = page.getByRole("button", {
        name: "Browser administrator",
        exact: true,
      });
      await browserExpect(adminName).toBeVisible();
      await browserExpect(field).toHaveCount(0);
      release();
      await finished;
      await browserExpect(adminName).toBeVisible();
      await browserExpect(
        page.getByRole("button", { name: "C3 Late member name", exact: true }),
      ).toHaveCount(0);
      expect(
        await page.evaluate(() =>
          Object.entries(localStorage).filter(([key]) =>
            key.endsWith(":@darcy_club_profile_name"),
          ),
        ),
      ).toEqual([]);
      expect(writes).toBe(1);
      expect(
        await rows("SELECT name FROM users WHERE id=?", [memberId]),
      ).toEqual([{ name: "C3 Late member name" }]);
      expect(
        await rows(
          "SELECT name FROM users WHERE openId='binding-browser-admin'",
        ),
      ).toEqual([{ name: "Browser administrator" }]);
      expect(await rows(identitySql, [memberId])).toEqual(identities);
      expect(
        await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
      ).toEqual(access);
    } finally {
      release();
      if (writes) await finished;
      await connection.query(
        "DELETE FROM club_payments WHERE userId=? AND orderId='c3-profile-access'",
        [memberId],
      );
    }
  }, 30_000);
  it.each(["confirmed", "uncommitted", "committed"])(
    "C3 profile name requires native confirmation (%s)",
    async (lost) => {
      const { rows, connection, context, frontend, base, memberId } = fixture();
      await connection.query(
        "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'c3-profile-access','paid','0','2030-01-01')",
        [memberId],
      );
      try {
        const identitySql =
          "SELECT id,email,phone,passwordHash,role,sessionVersion FROM users WHERE id=?";
        const before = await rows(identitySql, [memberId]);
        const access = await rows(
          "SELECT * FROM club_payments WHERE userId=?",
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
        await page.goto(frontend + "profile");
        if (lost === "confirmed" && process.env.PROFILE_SCREENSHOT_PREFIX) {
          await browserExpect(
            page.getByRole("button", {
              name: "Browser phone member",
              exact: true,
            }),
          ).toBeVisible();
          for (const width of [390, 1280]) {
            await page.setViewportSize({ width, height: 900 });
            await page.screenshot({
              path: `${process.env.PROFILE_SCREENSHOT_PREFIX}-${width}.png`,
            });
          }
        }
        await page
          .getByRole("button", { name: "Browser phone member", exact: true })
          .click();
        const field = page.getByRole("textbox").filter({ visible: true });
        await field.fill("C3 Confirmed profile name");
        let writes = 0;
        page.on("request", (request) => {
          if (
            request.method() === "POST" &&
            request.url().includes("profile.update")
          )
            writes++;
        });
        if (lost !== "confirmed") {
          await page.route("**/api/trpc/*", async (route) => {
            if (!route.request().url().includes("profile.update"))
              return route.fallback();
            if (lost === "committed") {
              const response = await route.fetch({
                url:
                  base +
                  new URL(route.request().url()).pathname +
                  new URL(route.request().url()).search,
                maxRedirects: 0,
              });
              expect(response.status()).toBe(200);
              const body = await response.json();
              expect(
                (Array.isArray(body) ? body[0] : body).result.data.json,
              ).toEqual({ success: true });
            }
            return route.abort("failed");
          });
          const failed = page.waitForEvent("requestfailed", (request) =>
            request.url().includes("profile.update"),
          );
          await field.press("Enter");
          await failed;
          expect(
            await rows("SELECT name FROM users WHERE id=?", [memberId]),
          ).toEqual([
            {
              name:
                lost === "committed"
                  ? "C3 Confirmed profile name"
                  : "Browser phone member",
            },
          ]);
          // A failed transport must not present a local-only name as persisted.
          await browserExpect(
            page.getByRole("button", {
              name: "C3 Confirmed profile name",
              exact: true,
            }),
          ).toHaveCount(0);
          await browserExpect(
            page
              .getByRole("alert")
              .filter({ hasText: "Не удалось сохранить имя" }),
          ).toBeVisible();
          await browserExpect(field).toHaveValue("C3 Confirmed profile name");
          expect(
            await page.evaluate(
              (id) =>
                localStorage.getItem(
                  `darcy:user:${id}:@darcy_club_profile_name`,
                ),
              memberId,
            ),
          ).toBeNull();
          expect(writes).toBe(1);
          await field.blur();
          await browserExpect(
            page
              .getByRole("alert")
              .filter({ hasText: "Не удалось сохранить имя" }),
          ).toBeVisible();
          expect(writes).toBe(1);
          if (process.env.PROFILE_SCREENSHOT_PREFIX && lost === "uncommitted") {
            for (const width of [390, 1280]) {
              await page.setViewportSize({ width, height: 900 });
              await page.screenshot({
                path: `${process.env.PROFILE_SCREENSHOT_PREFIX}-error-${width}.png`,
              });
            }
          }
          await page.unrouteAll({ behavior: "wait" });
          await page
            .getByRole("button", {
              name: "Повторить сохранение имени",
              exact: true,
            })
            .click();
          await browserExpect(
            page.getByRole("button", {
              name: "C3 Confirmed profile name",
              exact: true,
            }),
          ).toBeVisible();
          expect(
            await rows("SELECT name FROM users WHERE id=?", [memberId]),
          ).toEqual([{ name: "C3 Confirmed profile name" }]);
          await page.reload();
          await browserExpect(
            page.getByRole("button", {
              name: "C3 Confirmed profile name",
              exact: true,
            }),
          ).toBeVisible();
        } else {
          const [response] = await Promise.all([
            page.waitForResponse(
              (reply) =>
                reply.url().includes("profile.update") &&
                reply.request().method() === "POST",
            ),
            field.press("Enter"),
          ]);
          expect(response.status()).toBe(200);
          const body = await response.json();
          expect(
            (Array.isArray(body) ? body[0] : body).result.data.json,
          ).toEqual({ success: true });
          await browserExpect(
            page.getByRole("button", {
              name: "C3 Confirmed profile name",
              exact: true,
            }),
          ).toBeVisible();
          expect(
            await rows("SELECT name FROM users WHERE id=?", [memberId]),
          ).toEqual([{ name: "C3 Confirmed profile name" }]);
          await page.reload();
          await browserExpect(
            page.getByRole("button", {
              name: "C3 Confirmed profile name",
              exact: true,
            }),
          ).toBeVisible();
        }
        expect(writes).toBe(lost === "confirmed" ? 1 : 2);
        if (lost === "confirmed") {
          await context.clearCookies();
          await context.addCookies([
            {
              name: COOKIE_NAME,
              value: await sdk.createSessionToken("binding-browser-admin", {
                sessionVersion: 0,
              }),
              url: frontend,
              httpOnly: true,
              sameSite: "Lax",
            },
          ]);
          await page.reload();
          await browserExpect(
            page.getByRole("button", {
              name: "Browser administrator",
              exact: true,
            }),
          ).toBeVisible();
          await browserExpect(
            page.getByRole("button", {
              name: "C3 Confirmed profile name",
              exact: true,
            }),
          ).toHaveCount(0);
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
          await page.reload();
          await browserExpect(
            page.getByRole("button", {
              name: "C3 Confirmed profile name",
              exact: true,
            }),
          ).toBeVisible();
          expect(writes).toBe(1);
        }
        expect(await rows(identitySql, [memberId])).toEqual(before);
        expect(
          await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
        ).toEqual(access);
      } finally {
        await connection.query(
          "DELETE FROM club_payments WHERE userId=? AND orderId='c3-profile-access'",
          [memberId],
        );
      }
    },
    30_000,
  );
}
