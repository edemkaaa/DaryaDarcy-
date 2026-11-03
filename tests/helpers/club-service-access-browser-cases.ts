import { expect, it } from "vitest";
import { expect as browserExpect, type BrowserContext } from "@playwright/test";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { sdk } from "../../apps/backend/src/_core/sdk";
import { COOKIE_NAME } from "../../packages/shared/src/const";

export function registerClubServiceAccessBrowserCases(
  fixture: () => {
    connection: Pick<Connection, "query">;
    rows(sql: string, args?: unknown[]): Promise<RowDataPacket[]>;
    context: BrowserContext;
    frontend: string;
    memberId: number;
  },
) {
  it.each([390, 1440])(
    "moderator opens the native club without portraying service access as payment (%s)",
    async (width) => {
      const { connection, rows, context, frontend, memberId } = fixture();
      await connection.query("UPDATE users SET role='moderator' WHERE id=?", [
        memberId,
      ]);
      await context.clearCookies();
      await context.addInitScript((id) => {
        localStorage.setItem(
          `darcy:user:${id}:@darcy_club_profile_completed`,
          "true",
        );
      }, memberId);
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
      await page.setViewportSize({ width, height: 900 });
      const response = page.waitForResponse((reply) =>
        reply.url().includes("club.subscription"),
      );
      await page.goto(frontend + "club");
      const body = await (await response).json();
      expect(
        (Array.isArray(body) ? body[0] : body).result.data.json,
      ).toMatchObject({
        hasClubAccess: true,
        subscribed: false,
        expiresAt: null,
        isOwner: false,
        cancelAtPeriodEnd: false,
        cancellationStatus: "none",
      });
      await browserExpect(
        page.getByRole("button", { name: "Комьюнити", exact: true }),
      ).toBeVisible();
      await page.goto(frontend + "profile");
      await browserExpect(
        page.getByText("Служебный доступ", { exact: true }),
      ).toBeVisible();
      await browserExpect(
        page.getByText("Клуб открыт для модерации. Оплаченной подписки нет.", {
          exact: true,
        }),
      ).toBeVisible();
      await browserExpect(
        page.getByText("Активна", { exact: true }),
      ).toHaveCount(0);
      await browserExpect(
        page.getByText(/Следующее списание|Ежемесячная подписка/),
      ).toHaveCount(0);
      await browserExpect(
        page.getByRole("button", { name: "Отменить подписку", exact: true }),
      ).toHaveCount(0);
      await browserExpect(
        page.getByRole("button", { name: "Продлить клуб →", exact: true }),
      ).toHaveCount(0);
      expect(
        await rows("SELECT role FROM users WHERE id=?", [memberId]),
      ).toEqual([{ role: "moderator" }]);
      expect(
        await rows("SELECT id FROM club_payments WHERE userId=?", [memberId]),
      ).toEqual([]);
      if (process.env.CLUB_SERVICE_SCREENSHOT_DIR) {
        await page
          .getByText("Служебный доступ", { exact: true })
          .locator("..")
          .screenshot({
            path: `${process.env.CLUB_SERVICE_SCREENSHOT_DIR}/service-${width}.png`,
          });
      }
      await connection.query(
        "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'service-access-paid-fixture','paid','0',DATE_ADD(NOW(),INTERVAL 1 DAY))",
        [memberId],
      );
      await page.reload();
      await browserExpect(
        page.getByText("Активна", { exact: true }),
      ).toBeVisible();
      await browserExpect(page.getByText(/Следующее списание:/)).toBeVisible();
      await browserExpect(
        page.getByText("Служебный доступ", { exact: true }),
      ).toHaveCount(0);
      await browserExpect(
        page.getByRole("button", { name: "Отменить подписку", exact: true }),
      ).toBeVisible();
      await connection.query(
        "DELETE FROM club_payments WHERE userId=? AND orderId='service-access-paid-fixture'",
        [memberId],
      );
      await connection.query("UPDATE users SET role='user' WHERE id=?", [
        memberId,
      ]);
      await page.reload();
      await browserExpect(
        page.getByText("Служебный доступ", { exact: true }),
      ).toHaveCount(0);
      await browserExpect(
        page.getByText("У тебя нет активной подписки", { exact: true }),
      ).toBeVisible();
      // An unpaid account retains its personal bookmarks, but not club access.
      await browserExpect(
        page.getByText("Сохранённое", { exact: true }),
      ).toBeVisible();
      await browserExpect(
        page.getByRole("button", {
          name: "Вступить в Клуб Darcy →",
          exact: true,
        }),
      ).toBeVisible();
      const access = await page.evaluate(async () => {
        const subscription = await fetch("/api/trpc/club.subscription");
        const posts = await fetch("/api/trpc/club.list");
        return {
          subscriptionStatus: subscription.status,
          subscription: await subscription.json(),
          postsStatus: posts.status,
          posts: await posts.json(),
        };
      });
      expect(access.subscriptionStatus).toBe(200);
      expect(access.subscription.result.data.json).toMatchObject({
        hasClubAccess: false,
        subscribed: false,
        isOwner: false,
      });
      expect(access.postsStatus).toBe(403);
      expect(access.posts).toMatchObject({
        error: { json: { data: { code: "FORBIDDEN" } } },
      });
      expect(access.posts).not.toHaveProperty("result");
      expect(
        await rows("SELECT role FROM users WHERE id=?", [memberId]),
      ).toEqual([{ role: "user" }]);
      expect(
        await rows("SELECT id FROM club_payments WHERE userId=?", [memberId]),
      ).toEqual([]);
    },
    30_000,
  );
}
