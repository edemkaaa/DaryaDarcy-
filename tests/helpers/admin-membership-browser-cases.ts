import { expect, it } from "vitest";
import { expect as browserExpect, type BrowserContext } from "@playwright/test";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { sdk } from "../../apps/backend/src/_core/sdk";

interface AdminMembershipBrowserFixture {
  rows(sql: string, args?: unknown[]): Promise<RowDataPacket[]>;
  connection: Pick<Connection, "query">;
  context: BrowserContext;
  actorId: number;
  memberId: number;
  base: string;
  frontend: string;
  smtp: { messages: string[] };
}

// Register under the caller's native API/SQL/SMTP lifecycle; read its
// per-test context only when the case runs, after beforeEach creates it.
export function registerAdminMembershipBrowserCases(
  fixture: () => AdminMembershipBrowserFixture,
) {
  it.each(["user", "moderator"] as const)(
    "C1 denies owner membership actions to a %s in the browser and native API",
    async (role) => {
      const { rows, connection, context, actorId, memberId, frontend, smtp } =
        fixture();
      await connection.query("UPDATE users SET role=? WHERE id=?", [
        role,
        actorId,
      ]);
      const before = await rows("SELECT * FROM users WHERE id=?", [memberId]);
      const page = await context.newPage();
      await page.goto(frontend + "admin");
      if (role === "user") {
        await browserExpect(
          page.getByText("Недостаточно прав для управления приложением", {
            exact: true,
          }),
        ).toBeVisible();
      } else {
        await browserExpect(
          page.getByText("Модерация", { exact: true }),
        ).toBeVisible();
      }
      await browserExpect(
        page.getByRole("button", { name: "Участницы", exact: true }),
      ).toHaveCount(0);
      const statuses = await page.evaluate(async (target) => {
        const read = await fetch("/api/trpc/admin.members");
        const write = await fetch("/api/trpc/admin.grantClub", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ json: { userId: target } }),
        });
        return [read.status, write.status];
      }, memberId);
      expect(statuses).toEqual([403, 403]);
      expect(await rows("SELECT * FROM users WHERE id=?", [memberId])).toEqual(
        before,
      );
      expect(
        await rows("SELECT id FROM club_payments WHERE userId IN (?,?)", [
          actorId,
          memberId,
        ]),
      ).toEqual([]);
      expect(
        await rows("SELECT id FROM admin_audit_log WHERE actorUserId=?", [
          actorId,
        ]),
      ).toEqual([]);
      expect(smtp.messages).toHaveLength(0);
    },
    30_000,
  );
  it("C1 persists browser blocking and unblocking without restoring revoked sessions or changing paid access", async () => {
    const {
      rows,
      connection,
      context,
      actorId,
      memberId,
      base,
      frontend,
      smtp,
    } = fixture();
    const identity = await rows(
      "SELECT id,openId,email,phone,passwordHash,role FROM users WHERE id=?",
      [memberId],
    );
    await connection.query(
      "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'binding-browser-existing-access','paid','0','2030-01-01')",
      [memberId],
    );
    const access = await rows("SELECT * FROM club_payments WHERE userId=?", [
      memberId,
    ]);
    const memberToken = await sdk.createSessionToken("binding-browser-member", {
      sessionVersion: 0,
    });
    async function memberSessionStatus() {
      return (
        await fetch(base + "/api/trpc/club.list", {
          headers: { Authorization: `Bearer ${memberToken}` },
        })
      ).status;
    }
    expect(await memberSessionStatus()).toBe(200);
    const page = await context.newPage();
    async function members() {
      await page.goto(frontend! + "admin");
      await page
        .getByRole("button", { name: "Участницы", exact: true })
        .click();
    }
    await members();
    page.once("dialog", (dialog) => dialog.accept("Native browser reason"));
    await page
      .getByRole("button", { name: "Заблокировать", exact: true })
      .click();
    await browserExpect(
      page.getByText("Причина: Native browser reason", { exact: true }),
    ).toBeVisible();
    const [blocked] = await rows(
      "SELECT blockedAt,blockedReason,sessionVersion FROM users WHERE id=?",
      [memberId],
    );
    expect(blocked).toEqual({
      blockedAt: expect.any(Date),
      blockedReason: "Native browser reason",
      sessionVersion: 1,
    });
    expect(await memberSessionStatus()).toBe(401);
    await members();
    await browserExpect(
      page.getByText("Причина: Native browser reason", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Разблокировать", exact: true })
      .click();
    await browserExpect(
      page.getByRole("button", { name: "Заблокировать", exact: true }),
    ).toBeVisible();
    const [unblocked] = await rows(
      "SELECT blockedAt,blockedReason,sessionVersion FROM users WHERE id=?",
      [memberId],
    );
    expect(unblocked).toEqual({
      blockedAt: null,
      blockedReason: null,
      sessionVersion: 1,
    });
    expect(await memberSessionStatus()).toBe(401);
    expect(
      await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
    ).toEqual(access);
    expect(
      await rows(
        "SELECT id,openId,email,phone,passwordHash,role FROM users WHERE id=?",
        [memberId],
      ),
    ).toEqual(identity);
    expect(
      await rows(
        "SELECT action,targetId,details FROM admin_audit_log WHERE actorUserId=? ORDER BY id",
        [actorId],
      ),
    ).toEqual([
      {
        action: "block_user",
        targetId: memberId,
        details: "Native browser reason",
      },
      { action: "unblock_user", targetId: memberId, details: null },
    ]);
    expect(smtp.messages).toHaveLength(0);
  }, 30_000);
  it("C1 grants 31 days through the browser from the existing expiry and preserves the account", async () => {
    const { rows, connection, context, actorId, memberId, frontend, smtp } =
      fixture();
    await connection.query(
      "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (?,'binding-browser-existing-access','paid','0','2030-01-01')",
      [memberId],
    );
    const identity = await rows("SELECT * FROM users WHERE id=?", [memberId]);
    const before = await rows("SELECT * FROM club_payments WHERE userId=?", [
      memberId,
    ]);
    const page = await context.newPage();
    const dialogs: string[] = [];
    await page.goto(frontend! + "admin");
    await page.getByRole("button", { name: "Участницы", exact: true }).click();
    const member = page
      .getByText("Browser phone member", { exact: true })
      .locator("..");
    page.once("dialog", (dialog) => dialog.dismiss());
    await member
      .getByRole("button", { name: "Продлить клуб", exact: true })
      .click();
    expect(
      await rows("SELECT * FROM club_payments WHERE userId=?", [memberId]),
    ).toEqual(before);
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.type());
      await dialog.accept();
    });
    await member
      .getByRole("button", { name: "Продлить клуб", exact: true })
      .click();
    await browserExpect.poll(() => dialogs).toEqual(["confirm", "alert"]);
    const payments = await rows(
      "SELECT * FROM club_payments WHERE userId=? ORDER BY expiresAt",
      [memberId],
    );
    expect(payments).toHaveLength(2);
    expect(payments[0]).toEqual(before[0]);
    expect(payments[1]).toMatchObject({
      orderId: expect.stringMatching(/^admin-grant-/),
      status: "paid",
      sum: "0",
      expiresAt: new Date("2030-02-01T00:00:00.000Z"),
    });
    await page.reload();
    await page.getByRole("button", { name: "Участницы", exact: true }).click();
    await browserExpect(member.getByText(/Клуб до/)).toContainText(
      /1\s+февр\..*2030/,
    );
    expect(await rows("SELECT * FROM users WHERE id=?", [memberId])).toEqual(
      identity,
    );
    expect(
      await rows("SELECT id FROM club_payments WHERE userId=?", [actorId]),
    ).toEqual([]);
    expect(smtp.messages).toHaveLength(0);
  }, 30_000);
}
