import { expect, it } from "vitest";
import {
  expect as browserExpect,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { COOKIE_NAME } from "../../packages/shared/src/const";
import { sdk } from "../../apps/backend/src/_core/sdk";

interface ClubSetupFixture {
  removePageRoutes(page: Page): Promise<void>;
  rows(sql: string, args?: unknown[]): Promise<RowDataPacket[]>;
  connection: Pick<Connection, "query">;
  context: BrowserContext;
  frontend: string;
  base: string;
  memberId: number;
}

async function expectRetiredClubDraft(page: Page, memberId: number) {
  expect(
    await page.evaluate(
      (id) =>
        ["name", "gender", "completed", "draft", "pending"].map((key) =>
          localStorage.getItem(`darcy:user:${id}:@darcy_club_profile_${key}`),
        ),
      memberId,
    ),
  ).toEqual([null, null, null, null, null]);
}

async function openSetup(fixture: ClubSetupFixture) {
  const { connection, rows, context, frontend, memberId } = fixture;
  await connection.query(
    "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'c3-setup-recovery-access','paid','0','2030-01-01')",
    [memberId],
  );
  const identitySql =
    "SELECT id,email,phone,passwordHash,role,sessionVersion FROM users WHERE id=? OR openId='binding-browser-admin' ORDER BY id";
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
  await page.goto(frontend + "club");
  const setup = page.getByRole("dialog", { name: "Настройка профиля клуба" });
  await browserExpect(setup).toBeVisible();
  const field = setup.getByPlaceholder("Как тебя зовут?");
  await field.fill("C3 Recovery club name");
  await setup.getByRole("button", { name: "Женский", exact: true }).click();
  return { page, setup, field, identitySql, identity, access };
}

export function registerClubSetupBrowserCases(fixture: () => ClubSetupFixture) {
  it.each(["lost", "newer"])(
    "C3 club setup reconciles its ACK after a pre-write read arrives during saving (%s refresh)",
    async (refresh) => {
      const current = fixture();
      const { connection, rows, base, memberId } = current;
      await connection.query(
        "UPDATE users SET name='C3 Intermediate club name' WHERE id=? AND openId='binding-browser-member'",
        [memberId],
      );
      const { page, setup, field, identitySql, identity, access } =
        await openSetup(current);
      let releaseRead!: () => void,
        enterRead!: () => void,
        finishRead!: () => void;
      let releaseWrite!: () => void,
        enterWrite!: () => void,
        finishWrite!: () => void;
      const heldRead = new Promise<void>((r) => {
        releaseRead = r;
      });
      const readEntered = new Promise<void>((r) => {
        enterRead = r;
      });
      const readFinished = new Promise<void>((r) => {
        finishRead = r;
      });
      const heldWrite = new Promise<void>((r) => {
        releaseWrite = r;
      });
      const writeEntered = new Promise<void>((r) => {
        enterWrite = r;
      });
      const writeFinished = new Promise<void>((r) => {
        finishWrite = r;
      });
      let reads = 0,
        writes = 0;
      await page.route("**/api/auth/me", async (route) => {
        const first = ++reads === 1;
        const response = await route.fetch({
          url: base + "/api/auth/me",
          maxRedirects: 0,
        });
        expect(response.status()).toBe(200);
        if (!first) {
          expect(await response.json()).toMatchObject({
            user:
              refresh === "lost"
                ? { name: "C3 Recovery club name", gender: "female" }
                : { name: "C3 Newer server name", gender: "male" },
          });
          return refresh === "lost"
            ? route.abort("failed")
            : route.fulfill({ response });
        }
        expect(await response.json()).toMatchObject({
          user: { name: "C3 Intermediate club name", gender: null },
        });
        enterRead();
        try {
          await heldRead;
          await route.fulfill({ response });
        } finally {
          finishRead();
        }
      });
      let writeError: unknown;
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
          expect(
            (Array.isArray(body) ? body[0] : body).result.data.json,
          ).toEqual({
            success: true,
            profileRevision: 1,
          });
          enterWrite();
          await heldWrite;
          await route.fulfill({ response });
        } catch (error) {
          writeError = error;
          enterWrite();
          await route.abort("failed").catch(() => {});
        } finally {
          finishWrite();
        }
      });
      try {
        await page.evaluate(() => window.dispatchEvent(new Event("online")));
        await readEntered;
        await setup
          .getByRole("button", { name: "Продолжить", exact: true })
          .click();
        await writeEntered;
        expect(writeError).toBeUndefined();
        await browserExpect(field).toBeDisabled();
        expect(
          await rows("SELECT name,gender FROM users WHERE id=?", [memberId]),
        ).toEqual([{ name: "C3 Recovery club name", gender: "female" }]);
        const oldResponse = page.waitForResponse(
          (response) => new URL(response.url()).pathname === "/api/auth/me",
        );
        releaseRead();
        expect(await (await oldResponse).json()).toMatchObject({
          user: { name: "C3 Intermediate club name", gender: null },
        });
        await readFinished;
        // Wait for the confirmed old snapshot to render while the actual write ACK
        // is still held. This is a read of the fixture, not a fabricated response.
        await browserExpect(
          page.getByText("Очень рада тебе, C3 Intermediate club name", {
            exact: true,
          }),
        ).toBeVisible();
        if (refresh === "newer")
          await connection.query(
            "UPDATE users SET name='C3 Newer server name',gender='male',profileRevision=profileRevision+1 WHERE id=? AND openId='binding-browser-member'",
            [memberId],
          );
        const refreshed =
          refresh === "lost"
            ? page.waitForEvent(
                "requestfailed",
                (request) => new URL(request.url()).pathname === "/api/auth/me",
              )
            : page.waitForResponse(
                (response) =>
                  new URL(response.url()).pathname === "/api/auth/me",
              );
        releaseWrite();
        await writeFinished;
        await refreshed;
        await browserExpect(setup).toHaveCount(0);
        await browserExpect(
          page.getByText(
            refresh === "lost"
              ? "Очень рада тебе, дорогая C3 Recovery club name"
              : "Очень рада тебе, дорогой C3 Newer server name",
            {
              exact: true,
            },
          ),
        ).toBeVisible();
        expect(
          await rows("SELECT name,gender FROM users WHERE id=?", [memberId]),
        ).toEqual([
          refresh === "lost"
            ? { name: "C3 Recovery club name", gender: "female" }
            : { name: "C3 Newer server name", gender: "male" },
        ]);
        await expectRetiredClubDraft(page, memberId);
        expect(
          await rows("SELECT profileRevision FROM users WHERE id=?", [
            memberId,
          ]),
        ).toEqual([{ profileRevision: refresh === "lost" ? 1 : 2 }]);
        expect(reads).toBe(2);
        expect(writes).toBe(1);
        expect(await rows(identitySql, [memberId])).toEqual(identity);
        expect(
          await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
        ).toEqual(access);
      } finally {
        releaseRead();
        releaseWrite();
        await Promise.all([readFinished, writeFinished]);
        await fixture().removePageRoutes(page);
      }
    },
    30_000,
  );
  it("C3 club setup supersedes a native auth read started before saving its identity", async () => {
    const current = fixture();
    const { rows, base, memberId } = current;
    const { page, setup, identitySql, identity, access } =
      await openSetup(current);
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
      if (!first) {
        expect(await response.json()).toMatchObject({
          user: { name: "C3 Recovery club name", gender: "female" },
        });
        return route.fulfill({ response });
      }
      expect(await response.json()).toMatchObject({
        user: { name: "Browser phone member", gender: null },
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
        setup.getByRole("button", { name: "Продолжить", exact: true }).click(),
      ]);
      expect(saved.status()).toBe(200);
      expect(
        await rows("SELECT name,gender FROM users WHERE id=?", [memberId]),
      ).toEqual([{ name: "C3 Recovery club name", gender: "female" }]);
      release();
      await finished;
      await browserExpect.poll(() => reads).toBe(2);
      await browserExpect(setup).toHaveCount(0);
      await browserExpect(
        page.getByText("Очень рада тебе, дорогая C3 Recovery club name", {
          exact: true,
        }),
      ).toBeVisible();
      await expectRetiredClubDraft(page, memberId);
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
  it("C3 club setup shows native acknowledged identity when refresh reply is lost, then accepts a newer server identity", async () => {
    const current = fixture();
    const { rows, connection, base, memberId } = current;
    const { page, setup, identitySql, identity, access } =
      await openSetup(current);
    let writes = 0,
      refreshedNativeIdentity = false;
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
        user: { name: "C3 Recovery club name", gender: "female" },
      });
      refreshedNativeIdentity = true;
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
      setup.getByRole("button", { name: "Продолжить", exact: true }).click(),
    ]);
    expect(saved.status()).toBe(200);
    expect(refreshedNativeIdentity).toBe(true);
    expect(
      await rows("SELECT name,gender FROM users WHERE id=?", [memberId]),
    ).toEqual([{ name: "C3 Recovery club name", gender: "female" }]);
    await browserExpect(setup).toHaveCount(0);
    await browserExpect(
      page.getByText("Очень рада тебе, дорогая C3 Recovery club name", {
        exact: true,
      }),
    ).toBeVisible();
    if (process.env.CLUB_REFRESH_SCREENSHOT_PREFIX) {
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.screenshot({
          path: `${process.env.CLUB_REFRESH_SCREENSHOT_PREFIX}-${width}.png`,
        });
      }
    }
    await expectRetiredClubDraft(page, memberId);
    expect(writes).toBe(1);
    await fixture().removePageRoutes(page);
    // A new confirmed snapshot can legitimately restore the original values.
    // Compare snapshot identity, not just strings, and honour a cleared gender.
    await connection.query(
      "UPDATE users SET name='Browser phone member',gender=NULL,profileRevision=profileRevision+1 WHERE id=? AND openId='binding-browser-member'",
      [memberId],
    );
    const [restored] = await Promise.all([
      page.waitForResponse(
        (response) => new URL(response.url()).pathname === "/api/auth/me",
      ),
      page.evaluate(() => window.dispatchEvent(new Event("online"))),
    ]);
    expect(await restored.json()).toMatchObject({
      user: { name: "Browser phone member", gender: null },
    });
    await browserExpect(
      page.getByText("Очень рада тебе, Browser phone member", { exact: true }),
    ).toBeVisible();
    await connection.query(
      "UPDATE users SET name=NULL,profileRevision=profileRevision+1 WHERE id=? AND openId='binding-browser-member'",
      [memberId],
    );
    const [cleared] = await Promise.all([
      page.waitForResponse(
        (response) => new URL(response.url()).pathname === "/api/auth/me",
      ),
      page.evaluate(() => window.dispatchEvent(new Event("online"))),
    ]);
    expect(await cleared.json()).toMatchObject({
      user: { name: null, gender: null },
    });
    await browserExpect(page.getByText(/^Очень рада тебе,/)).toHaveCount(0);
    await connection.query(
      "UPDATE users SET name='C3 New remote name',gender='male',profileRevision=profileRevision+1 WHERE id=? AND openId='binding-browser-member'",
      [memberId],
    );
    const [recovered] = await Promise.all([
      page.waitForResponse(
        (response) => new URL(response.url()).pathname === "/api/auth/me",
      ),
      page.evaluate(() => window.dispatchEvent(new Event("online"))),
    ]);
    expect(await recovered.json()).toMatchObject({
      user: { name: "C3 New remote name", gender: "male" },
    });
    await browserExpect(
      page.getByText("Очень рада тебе, дорогой C3 New remote name", {
        exact: true,
      }),
    ).toBeVisible();
    await browserExpect(
      page.getByText("Очень рада тебе, дорогая C3 Recovery club name", {
        exact: true,
      }),
    ).toHaveCount(0);
    expect(writes).toBe(1);
    expect(await rows(identitySql, [memberId])).toEqual(identity);
    expect(
      await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
    ).toEqual(access);
  }, 30_000);
  it("C3 club setup closes without publishing a draft when native session access is revoked", async () => {
    const current = fixture();
    const { rows, connection, memberId } = current;
    const { page, setup, identitySql, access } = await openSetup(current);
    await connection.query(
      "UPDATE users SET sessionVersion=1 WHERE id=? AND openId='binding-browser-member' AND sessionVersion=0",
      [memberId],
    );
    const revokedIdentity = await rows(identitySql, [memberId]);
    expect(
      revokedIdentity.find((user) => user.id === memberId)?.sessionVersion,
    ).toBe(1);
    let writes = 0;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().includes("profile.update")
      )
        writes++;
    });
    const [denied] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().includes("profile.update"),
      ),
      setup.getByRole("button", { name: "Продолжить", exact: true }).click(),
    ]);
    expect(denied.status()).toBe(401);
    await browserExpect(setup).toHaveCount(0);
    await browserExpect(
      page
        .getByRole("textbox", {
          name: "Почта для чека и входа",
          exact: true,
        })
        .first(),
    ).toBeVisible();
    expect(writes).toBe(1);
    expect(
      await rows("SELECT name,gender FROM users WHERE id=?", [memberId]),
    ).toEqual([{ name: "Browser phone member", gender: null }]);
    expect(await rows(identitySql, [memberId])).toEqual(revokedIdentity);
    expect(
      await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
    ).toEqual(access);
    expect(
      await page.evaluate(() =>
        Object.entries(localStorage).filter(([key]) =>
          /:@darcy_club_profile_(name|gender|completed|draft|pending)$/.test(
            key,
          ),
        ),
      ),
    ).toEqual([]);
  }, 30_000);
  it.each(["missing", "present"])(
    "C3 club avatar-cache cannot populate or overwrite a server avatar (%s)",
    async (serverAvatar) => {
      const current = fixture();
      const { connection, rows, context, frontend, memberId } = current;
      const cached = frontend + "assets/images/icon.png";
      const confirmed = frontend + "assets/images/favicon.png";
      if (serverAvatar === "present") {
        await connection.query("UPDATE users SET avatarUrl=? WHERE id=?", [
          confirmed,
          memberId,
        ]);
      }
      await context.addInitScript(
        ({ id, avatar }) => {
          localStorage.setItem(
            `darcy:user:${id}:@darcy_club_profile_avatar`,
            avatar,
          );
        },
        { id: memberId, avatar: cached },
      );
      let writes = 0,
        uploads = 0;
      context.on("request", (request) => {
        if (request.method() !== "POST") return;
        if (request.url().includes("profile.update")) writes++;
        if (request.url().includes("profile.uploadAvatar")) uploads++;
      });
      const { setup, identitySql, identity, access } = await openSetup(current);
      await browserExpect(setup).toBeVisible();
      expect(
        await rows("SELECT avatarUrl FROM users WHERE id=?", [memberId]),
      ).toEqual([
        {
          avatarUrl: serverAvatar === "present" ? confirmed : null,
        },
      ]);
      expect(writes).toBe(0);
      expect(uploads).toBe(0);
      expect(await rows(identitySql, [memberId])).toEqual(identity);
      expect(
        await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
      ).toEqual(access);
      expect(
        await rows("SELECT name,gender FROM users WHERE id=?", [memberId]),
      ).toEqual([{ name: "Browser phone member", gender: null }]);
      // A legacy local URL is untrusted input, never an implicit server write.
      expect(
        await rows("SELECT profileRevision FROM users WHERE id=?", [memberId]),
      ).toEqual([{ profileRevision: 0 }]);
    },
    30_000,
  );
  it.each(["uncommitted", "committed"])(
    "C3 club setup keeps the draft and requires manual retry after a lost native reply (%s)",
    async (lost) => {
      const current = fixture();
      const { rows, base, memberId } = current;
      const { page, setup, field, identitySql, identity, access } =
        await openSetup(current);
      let writes = 0;
      page.on("request", (request) => {
        if (
          request.method() === "POST" &&
          request.url().includes("profile.update")
        )
          writes++;
      });
      await page.route("**/api/trpc/*", async (route) => {
        if (!route.request().url().includes("profile.update"))
          return route.fallback();
        if (lost === "committed") {
          const url = new URL(route.request().url());
          const response = await route.fetch({
            url: base + url.pathname + url.search,
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
      await setup
        .getByRole("button", { name: "Продолжить", exact: true })
        .click();
      await failed;
      expect(
        await rows("SELECT name,gender FROM users WHERE id=?", [memberId]),
      ).toEqual([
        {
          name:
            lost === "committed"
              ? "C3 Recovery club name"
              : "Browser phone member",
          gender: lost === "committed" ? "female" : null,
        },
      ]);
      await browserExpect(setup).toBeVisible();
      await browserExpect(field).toHaveValue("C3 Recovery club name");
      await browserExpect(setup.getByRole("alert")).toContainText(
        "Результат сохранения не подтверждён",
      );
      expect(
        await page.evaluate(
          (id) =>
            ["name", "gender", "completed"].map((key) =>
              localStorage.getItem(
                `darcy:user:${id}:@darcy_club_profile_${key}`,
              ),
            ),
          memberId,
        ),
      ).toEqual([null, null, null]);
      expect(writes).toBe(1);
      await field.blur();
      await browserExpect(setup.getByRole("alert")).toBeVisible();
      expect(writes).toBe(1);
      if (process.env.CLUB_SETUP_SCREENSHOT_PREFIX && lost === "uncommitted") {
        for (const width of [390, 1280]) {
          await page.setViewportSize({ width, height: 900 });
          await page.screenshot({
            path: `${process.env.CLUB_SETUP_SCREENSHOT_PREFIX}-${width}.png`,
          });
        }
      }
      await fixture().removePageRoutes(page);
      expect(
        await page.evaluate(
          (id) => ({
            draft: JSON.parse(
              localStorage.getItem(
                `darcy:user:${id}:@darcy_club_profile_draft`,
              )!,
            ),
            pending: JSON.parse(
              localStorage.getItem(
                `darcy:user:${id}:@darcy_club_profile_pending`,
              )!,
            ),
          }),
          memberId,
        ),
      ).toMatchObject({
        draft: {
          ownerId: memberId,
          base: { revision: 0 },
          values: { name: "C3 Recovery club name", gender: "female" },
        },
        pending: {
          name: "C3 Recovery club name",
          gender: "female",
          expectedRevision: 0,
        },
      });
      if (lost === "uncommitted") {
        await page.reload();
        await browserExpect(setup).toBeVisible();
        await browserExpect(field).toHaveValue("C3 Recovery club name");
        await browserExpect(field).toBeDisabled();
      }
      expect(writes).toBe(1);
      const checked = page.waitForResponse(
        (reply) => new URL(reply.url()).pathname === "/api/auth/me",
      );
      await setup
        .getByRole("button", {
          name: "Проверить сохранение анкеты",
          exact: true,
        })
        .click();
      expect((await checked).status()).toBe(200);
      if (lost === "uncommitted") {
        const submit = setup.getByRole("button", {
          name: "Продолжить",
          exact: true,
        });
        await browserExpect(submit).toBeDisabled();
        await browserExpect(field).toHaveValue("C3 Recovery club name");
        expect(writes).toBe(1);
        expect(
          await rows(
            "SELECT name,gender,profileRevision FROM users WHERE id=?",
            [memberId],
          ),
        ).toEqual([
          { name: "Browser phone member", gender: null, profileRevision: 0 },
        ]);
        await setup
          .getByRole("button", {
            name: "Использовать мой черновик",
            exact: true,
          })
          .click();
        const saved = page.waitForResponse((reply) =>
          reply.url().includes("profile.update"),
        );
        await submit.click();
        expect((await saved).status()).toBe(200);
      }
      await browserExpect(setup).toHaveCount(0);
      await browserExpect(
        page.getByText("Очень рада тебе, дорогая C3 Recovery club name", {
          exact: true,
        }),
      ).toBeVisible();
      expect(writes).toBe(lost === "uncommitted" ? 2 : 1);
      expect(
        await rows("SELECT name,gender FROM users WHERE id=?", [memberId]),
      ).toEqual([{ name: "C3 Recovery club name", gender: "female" }]);
      expect(await rows(identitySql, [memberId])).toEqual(identity);
      expect(
        await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
      ).toEqual(access);
      await expectRetiredClubDraft(page, memberId);
      expect(
        await rows("SELECT profileRevision FROM users WHERE id=?", [memberId]),
      ).toEqual([{ profileRevision: 1 }]);
      await page.reload();
      await browserExpect(
        page.getByText("Очень рада тебе, дорогая C3 Recovery club name", {
          exact: true,
        }),
      ).toBeVisible();
      await browserExpect(setup).toHaveCount(0);
    },
    30_000,
  );

  it("C3 club setup ignores a native committed reply after switching account", async () => {
    const current = fixture();
    const { rows, context, frontend, base, memberId } = current;
    const { page, setup, field, identitySql, identity, access } =
      await openSetup(current);
    let release!: () => void, finish!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const finished = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let captured = false,
      writes = 0;
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
      await setup
        .getByRole("button", { name: "Продолжить", exact: true })
        .click();
      await browserExpect.poll(() => captured).toBe(true);
      await browserExpect(setup).toBeVisible();
      await browserExpect(field).toBeDisabled();
      await browserExpect(
        setup.getByRole("button", {
          name: "Закрыть настройку профиля",
          exact: true,
        }),
      ).toBeEnabled();
      expect(
        await page.evaluate(
          (id) =>
            JSON.parse(
              localStorage.getItem(
                `darcy:user:${id}:@darcy_club_profile_pending`,
              )!,
            ),
          memberId,
        ),
      ).toMatchObject({
        name: "C3 Recovery club name",
        gender: "female",
        expectedRevision: 0,
      });
      expect(
        await rows("SELECT name,gender FROM users WHERE id=?", [memberId]),
      ).toEqual([{ name: "C3 Recovery club name", gender: "female" }]);
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
      const [switched] = await Promise.all([
        page.waitForResponse(
          (response) => new URL(response.url()).pathname === "/api/auth/me",
        ),
        page.evaluate(() => window.dispatchEvent(new Event("online"))),
      ]);
      expect(await switched.json()).toMatchObject({
        user: { name: "Browser administrator" },
      });
      const greeting = page.getByText(
        "Очень рада тебе, Browser administrator",
        { exact: true },
      );
      await browserExpect(greeting).toBeVisible();
      await browserExpect(setup).toHaveCount(0);
      release();
      await finished;
      await browserExpect(greeting).toBeVisible();
      await browserExpect(
        page.getByText(/Очень рада тебе, .*C3 Recovery club name/),
      ).toHaveCount(0);
      expect(
        await page.evaluate(() =>
          Object.entries(localStorage).filter(([key]) =>
            /:@darcy_club_profile_(name|gender|completed|draft|pending)$/.test(
              key,
            ),
          ),
        ),
      ).toEqual([]);
      expect(writes).toBe(1);
      expect(
        await rows("SELECT name,gender FROM users WHERE id=?", [memberId]),
      ).toEqual([{ name: "C3 Recovery club name", gender: "female" }]);
      expect(
        await rows(
          "SELECT name,gender FROM users WHERE openId='binding-browser-admin'",
        ),
      ).toEqual([{ name: "Browser administrator", gender: null }]);
      expect(
        await rows(
          "SELECT openId,profileRevision FROM users WHERE id=? OR openId='binding-browser-admin' ORDER BY id",
          [memberId],
        ),
      ).toEqual([
        { openId: "binding-browser-admin", profileRevision: 0 },
        { openId: "binding-browser-member", profileRevision: 1 },
      ]);
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
}
