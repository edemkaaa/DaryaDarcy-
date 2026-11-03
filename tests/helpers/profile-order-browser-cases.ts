import { expect, it } from "vitest";
import { expect as browserExpect } from "@playwright/test";
import { COOKIE_NAME } from "../../packages/shared/src/const";
import { sdk } from "../../apps/backend/src/_core/sdk";
import type { ProfileFixture } from "./profile-browser-cases";

export function registerProfileOrderBrowserCases(
  fixture: () => ProfileFixture,
) {
  it.each(["lost", "newer"])(
    "C3 profile name reconciles its ACK after a pre-write read arrives during saving (%s refresh)",
    async (refresh) => {
      const { connection, rows, context, frontend, base, memberId } = fixture();
      await connection.query(
        "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'c3-profile-ack-order','paid','0','2030-01-01')",
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
      await connection.query(
        "UPDATE users SET name='C3 Intermediate profile name' WHERE id=? AND openId='binding-browser-member'",
        [memberId],
      );
      const page = await context.newPage();
      await page.goto(frontend + "profile");
      await page
        .getByRole("button", {
          name: "C3 Intermediate profile name",
          exact: true,
        })
        .click();
      const field = page.getByRole("textbox", {
        name: "Имя профиля",
        exact: true,
      });
      await field.fill("C3 Profile ACK name");
      await page.evaluate(
        (id) =>
          localStorage.setItem(
            `darcy:user:${id}:@darcy_club_profile_name`,
            "Browser phone member",
          ),
        memberId,
      );
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
            user: {
              name:
                refresh === "lost"
                  ? "C3 Profile ACK name"
                  : "C3 Newer profile name",
            },
          });
          return refresh === "lost"
            ? route.abort("failed")
            : route.fulfill({ response });
        }
        expect(await response.json()).toMatchObject({
          user: { name: "C3 Intermediate profile name" },
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
          ).toEqual({ success: true, profileRevision: 1 });
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
      const cached = () =>
        page.evaluate(
          (id) =>
            localStorage.getItem(`darcy:user:${id}:@darcy_club_profile_name`),
          memberId,
        );
      try {
        await page.evaluate(() => window.dispatchEvent(new Event("online")));
        await readEntered;
        await field.press("Enter");
        await writeEntered;
        expect(writeError).toBeUndefined();
        await browserExpect(field).toBeDisabled();
        expect(
          await rows("SELECT name FROM users WHERE id=?", [memberId]),
        ).toEqual([{ name: "C3 Profile ACK name" }]);
        const old = page.waitForResponse(
          (response) => new URL(response.url()).pathname === "/api/auth/me",
        );
        releaseRead();
        expect(await (await old).json()).toMatchObject({
          user: { name: "C3 Intermediate profile name" },
        });
        await readFinished;
        // The old native read is delivered while the actual write ACK is held.
        // Its revision must not replace the submitted draft or become a legacy cache.
        expect(await cached()).toBe("Browser phone member");
        expect(
          await page.evaluate(
            (id) =>
              JSON.parse(
                localStorage.getItem(
                  `darcy:user:${id}:@darcy_profile_name_draft`,
                )!,
              ),
            memberId,
          ),
        ).toMatchObject({
          ownerId: memberId,
          base: { revision: 0 },
          values: { name: "C3 Profile ACK name" },
        });
        await browserExpect(field).toHaveValue("C3 Profile ACK name");
        if (refresh === "newer")
          await connection.query(
            "UPDATE users SET name='C3 Newer profile name',profileRevision=profileRevision+1 WHERE id=? AND openId='binding-browser-member'",
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
        const name =
          refresh === "lost" ? "C3 Profile ACK name" : "C3 Newer profile name";
        await browserExpect(
          page.getByRole("button", { name, exact: true }),
        ).toBeVisible();
        expect(await cached()).toBe("Browser phone member");
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
        expect(
          await rows("SELECT name,profileRevision FROM users WHERE id=?", [
            memberId,
          ]),
        ).toEqual([{ name, profileRevision: refresh === "lost" ? 1 : 2 }]);
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
}
