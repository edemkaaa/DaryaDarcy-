import { expect, it } from "vitest";
import {
  expect as browserExpect,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { COOKIE_NAME } from "../../packages/shared/src/const";
import { sdk } from "../../apps/backend/src/_core/sdk";

export interface ProfileFixture {
  removePageRoutes(page: Page): Promise<void>;
  rows(sql: string, args?: unknown[]): Promise<RowDataPacket[]>;
  connection: Pick<Connection, "query">;
  context: BrowserContext;
  frontend: string;
  base: string;
  memberId: number;
}

export function registerProfileBrowserCases(fixture: () => ProfileFixture) {
  it("C3 profile save supersedes a native auth read started before the write", async () => {
    const { connection, rows, context, frontend, base, memberId } = fixture();
    await connection.query(
      "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'c3-profile-ordered-read','paid','0','2030-01-01')",
      [memberId],
    );
    const access = await rows("SELECT * FROM club_payments WHERE userId=?", [
      memberId,
    ]);
    const identitySql =
      "SELECT id,email,phone,passwordHash,role,sessionVersion FROM users WHERE id=?";
    const identity = await rows(identitySql, [memberId]);
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
    await field.fill("C3 Profile ordered name");
    let enter!: () => void, release!: () => void, finish!: () => void;
    const entered = new Promise<void>((resolve) => {
      enter = resolve;
    });
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let reads = 0,
      writes = 0;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().includes("profile.update")
      )
        writes++;
    });
    await page.route("**/api/auth/me", async (route) => {
      const first = ++reads === 1;
      const response = await route.fetch({
        url: base + "/api/auth/me",
        maxRedirects: 0,
      });
      expect(response.status()).toBe(200);
      if (!first) return route.fulfill({ response });
      expect(await response.json()).toMatchObject({
        user: { name: "Browser phone member" },
      });
      enter();
      try {
        await held;
        await route.fulfill({ response });
      } finally {
        finish();
      }
    });
    try {
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await entered;
      const [saved] = await Promise.all([
        page.waitForResponse(
          (response) =>
            response.request().method() === "POST" &&
            response.url().includes("profile.update"),
        ),
        field.press("Enter"),
      ]);
      expect(saved.status()).toBe(200);
      await browserExpect(
        page.getByRole("button", {
          name: "C3 Profile ordered name",
          exact: true,
        }),
      ).toBeVisible();
      expect(
        await rows("SELECT name FROM users WHERE id=?", [memberId]),
      ).toEqual([{ name: "C3 Profile ordered name" }]);
      release();
      await finished;
      // A save must obtain a post-write snapshot rather than deduplicate against
      // the held read of the old SQL value. No second profile POST is allowed.
      await browserExpect.poll(() => reads).toBe(2);
      await browserExpect(
        page.getByRole("button", {
          name: "C3 Profile ordered name",
          exact: true,
        }),
      ).toBeVisible();
      await browserExpect
        .poll(() =>
          page.evaluate(
            (id) =>
              localStorage.getItem(`darcy:user:${id}:@darcy_club_profile_name`),
            memberId,
          ),
        )
        .toBeNull();
      expect(writes).toBe(1);
      expect(await rows(identitySql, [memberId])).toEqual(identity);
      expect(
        await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
      ).toEqual(access);
    } finally {
      release();
      await finished;
      await fixture().removePageRoutes(page);
    }
  }, 30_000);
  it("C3 profile name accepts an equal-value native snapshot after acknowledged save and lost refresh", async () => {
    const { connection, rows, context, frontend, base, memberId } = fixture();
    await connection.query(
      "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'c3-profile-equal-snapshot','paid','0','2030-01-01')",
      [memberId],
    );
    const identitySql =
      "SELECT id,email,phone,passwordHash,role,sessionVersion FROM users WHERE id=?";
    const identity = await rows(identitySql, [memberId]);
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
    await field.fill("C3 Profile acknowledged name");
    let writes = 0,
      lostNativeRefresh = false;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().includes("profile.update")
      )
        writes++;
    });
    await page.route("**/api/auth/me", async (route) => {
      const response = await route.fetch({
        url: base + "/api/auth/me",
        maxRedirects: 0,
      });
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({
        user: { name: "C3 Profile acknowledged name" },
      });
      lostNativeRefresh = true;
      return route.abort("failed");
    });
    const [saved] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().includes("profile.update"),
      ),
      page.waitForEvent(
        "requestfailed",
        (request) => new URL(request.url()).pathname === "/api/auth/me",
      ),
      field.press("Enter"),
    ]);
    expect(saved.status()).toBe(200);
    expect(lostNativeRefresh).toBe(true);
    expect(await rows("SELECT name FROM users WHERE id=?", [memberId])).toEqual(
      [{ name: "C3 Profile acknowledged name" }],
    );
    await browserExpect(
      page.getByRole("button", {
        name: "C3 Profile acknowledged name",
        exact: true,
      }),
    ).toBeVisible();
    const cached = () =>
      page.evaluate(
        (id) =>
          localStorage.getItem(`darcy:user:${id}:@darcy_club_profile_name`),
        memberId,
      );
    expect(await cached()).toBeNull();
    await fixture().removePageRoutes(page);
    const [restored] = await Promise.all([
      page.waitForResponse(
        (response) => new URL(response.url()).pathname === "/api/auth/me",
      ),
      page.evaluate(() => window.dispatchEvent(new Event("online"))),
    ]);
    expect(await restored.json()).toMatchObject({
      user: { name: "C3 Profile acknowledged name", profileRevision: 1 },
    });
    await browserExpect(
      page.getByRole("button", {
        name: "C3 Profile acknowledged name",
        exact: true,
      }),
    ).toBeVisible();
    await browserExpect.poll(cached).toBeNull();
    expect(writes).toBe(1);
    expect(await rows(identitySql, [memberId])).toEqual(identity);
    expect(
      await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
    ).toEqual(access);
  }, 30_000);
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
      // Legacy local values never cause a write or an unnecessary mount refresh.
      const setup = page.getByRole("dialog", {
        name: "Настройка профиля клуба",
      });
      await browserExpect(
        setup.getByPlaceholder("Как тебя зовут?"),
      ).toHaveValue("Browser phone member");
      await browserExpect.poll(() => identityReads).toBeGreaterThanOrEqual(1);
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
      ).toBe("C3 stale local name");
      await connection.query(
        "UPDATE users SET name='C3 Fresh server name',profileRevision=profileRevision+1 WHERE id=? AND openId='binding-browser-member'",
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
      ).toBe("C3 stale local name");
      await page
        .getByRole("button", { name: "C3 Fresh server name", exact: true })
        .click();
      const draft = page.getByRole("textbox", { name: "Имя профиля" });
      await draft.fill("C3 unsaved draft");
      await connection.query(
        "UPDATE users SET name='C3 Updated during editing',profileRevision=profileRevision+1 WHERE id=? AND openId='binding-browser-member'",
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
        .toBe("C3 stale local name");
      expect(writes).toBe(0);
      // The draft's old revision must conflict instead of overwriting the remote edit.
      const conflict = page.waitForResponse((reply) =>
        reply.url().includes("profile.update"),
      );
      await draft.press("Enter");
      expect((await conflict).status()).toBe(409);
      await browserExpect(draft).toHaveValue("C3 unsaved draft");
      await browserExpect(draft).toBeDisabled();
      expect(
        await rows("SELECT name,profileRevision FROM users WHERE id=?", [
          memberId,
        ]),
      ).toEqual([{ name: "C3 Updated during editing", profileRevision: 2 }]);
      await page
        .getByRole("button", {
          name: "Проверить сохранение имени",
          exact: true,
        })
        .click();
      const save = page.getByRole("button", {
        name: "Сохранить имя",
        exact: true,
      });
      await browserExpect(save).toBeDisabled();
      await browserExpect(draft).toHaveValue("C3 unsaved draft");
      expect(writes).toBe(1);
      await page
        .getByRole("button", { name: "Использовать мой черновик", exact: true })
        .click();
      const saved = page.waitForResponse((reply) =>
        reply.url().includes("profile.update"),
      );
      await save.click();
      expect((await saved).status()).toBe(200);
      await browserExpect(
        page.getByRole("button", { name: "C3 unsaved draft", exact: true }),
      ).toBeVisible();
      expect(writes).toBe(2);
      expect(
        await rows("SELECT name,profileRevision FROM users WHERE id=?", [
          memberId,
        ]),
      ).toEqual([{ name: "C3 unsaved draft", profileRevision: 3 }]);
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
          { success: true, profileRevision: 1 },
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
            /:@darcy_(club_profile_name|profile_name_draft|profile_name_pending)$/.test(
              key,
            ),
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
      expect(
        await rows(
          "SELECT openId,profileRevision FROM users WHERE id=? OR openId='binding-browser-admin' ORDER BY id",
          [memberId],
        ),
      ).toEqual([
        { openId: "binding-browser-admin", profileRevision: 0 },
        { openId: "binding-browser-member", profileRevision: 1 },
      ]);
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
        const field = page.getByRole("textbox", {
          name: "Имя профиля",
          exact: true,
        });
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
              ).toEqual({ success: true, profileRevision: 1 });
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
              .filter({ hasText: "Результат сохранения не подтверждён" }),
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
              .filter({ hasText: "Результат сохранения не подтверждён" }),
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
          await browserExpect(field).toBeDisabled();
          const persisted = () =>
            page.evaluate(
              (id) => ({
                draft: JSON.parse(
                  localStorage.getItem(
                    `darcy:user:${id}:@darcy_profile_name_draft`,
                  )!,
                ),
                pending: JSON.parse(
                  localStorage.getItem(
                    `darcy:user:${id}:@darcy_profile_name_pending`,
                  )!,
                ),
              }),
              memberId,
            );
          expect(await persisted()).toMatchObject({
            draft: {
              ownerId: memberId,
              base: { revision: 0 },
              values: { name: "C3 Confirmed profile name" },
            },
            pending: { name: "C3 Confirmed profile name", expectedRevision: 0 },
          });
          await fixture().removePageRoutes(page);
          await page.reload();
          await page
            .getByRole("button", {
              name:
                lost === "committed"
                  ? "C3 Confirmed profile name"
                  : "Browser phone member",
              exact: true,
            })
            .click();
          await browserExpect(field).toHaveValue("C3 Confirmed profile name");
          await browserExpect(field).toBeDisabled();
          expect(writes).toBe(1);
          const checked = page.waitForResponse(
            (reply) => new URL(reply.url()).pathname === "/api/auth/me",
          );
          await page
            .getByRole("button", {
              name: "Проверить сохранение имени",
              exact: true,
            })
            .click();
          expect((await checked).status()).toBe(200);
          if (lost === "uncommitted") {
            const save = page.getByRole("button", {
              name: "Сохранить имя",
              exact: true,
            });
            await browserExpect(field).toHaveValue("C3 Confirmed profile name");
            await browserExpect(save).toBeDisabled();
            expect(writes).toBe(1);
            expect(
              await rows("SELECT name,profileRevision FROM users WHERE id=?", [
                memberId,
              ]),
            ).toEqual([{ name: "Browser phone member", profileRevision: 0 }]);
            await page
              .getByRole("button", {
                name: "Использовать мой черновик",
                exact: true,
              })
              .click();
            await save.click();
          }
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
          ).toEqual({ success: true, profileRevision: 1 });
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
        expect(writes).toBe(lost === "uncommitted" ? 2 : 1);
        expect(
          await rows("SELECT profileRevision FROM users WHERE id=?", [
            memberId,
          ]),
        ).toEqual([{ profileRevision: 1 }]);
        expect(
          await page.evaluate(
            (id) => [
              localStorage.getItem(
                `darcy:user:${id}:@darcy_profile_name_draft`,
              ),
              localStorage.getItem(
                `darcy:user:${id}:@darcy_profile_name_pending`,
              ),
            ],
            memberId,
          ),
        ).toEqual([null, null]);
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
