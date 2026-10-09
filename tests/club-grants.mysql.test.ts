import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { getDb, grantClubDays, listAdminMembers, listAdminPayments } from "../apps/backend/src/db";

describe.skipIf(!testDatabaseUrl)("manual club grants on disposable MySQL", () => {
  let conn: Connection;
  beforeAll(async () => {
    conn = await openTestDatabase();
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    await conn.query("INSERT IGNORE INTO users (id,openId,email) VALUES (92401,'grant-fixture','grant@example.test')");
  });
  beforeEach(async () => {
    await conn.query("DELETE FROM club_payments WHERE userId=92401");
    await conn.query("UPDATE users SET blockedAt=NULL,openId='grant-fixture',email='grant@example.test' WHERE id=92401");
    await conn.query(`INSERT INTO club_payments (userId,orderId,email,status,expiresAt)
      VALUES (92401,'grant-fixture-initial','grant@example.test','paid',DATE_ADD(NOW(),INTERVAL 60 DAY))`);
  });
  afterAll(async () => {
    await conn?.end();
    const database = await getDb();
    await (database as unknown as { $client: { end(): Promise<void> } })?.$client.end();
    vi.unstubAllEnvs();
  });
  async function payments() {
    const [rows] = await conn.query<RowDataPacket[]>("SELECT orderId,status,expiresAt,email,sum FROM club_payments WHERE userId=92401 ORDER BY expiresAt");
    return rows;
  }
  it("accumulates every simultaneous grant instead of overwriting the same expiry", async () => {
    const initial = (await payments())[0].expiresAt as Date;
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => grantClubDays(92401, 3)));
    expect(results.map(result => result.status)).toEqual(Array(10).fill("fulfilled"));
    const rows = await payments();
    expect(rows).toHaveLength(11);
    expect(new Set(rows.map(row => row.orderId)).size).toBe(11);
    expect(rows.at(-1)!.expiresAt.getTime()).toBe(initial.getTime() + 30 * 86400000);
  });
  it("preserves the default 31-day grant and stored recipient", async () => {
    const initial = (await payments())[0].expiresAt as Date;
    const expiresAt = await grantClubDays(92401);
    expect(expiresAt.getTime()).toBe(initial.getTime() + 31 * 86400000);
    expect((await payments()).at(-1)).toMatchObject({ status: "paid", email: "grant@example.test", sum: "0" });
  });
  it("keeps the admin member projection and refreshed expiry after a grant", async () => {
    const expiresAt = await grantClubDays(92401);
    const member = (await listAdminMembers()).find(row => row.id === 92401);
    expect(member).toMatchObject({ id: 92401, email: "grant@example.test", clubExpiresAt: expiresAt, blockedAt: null, blockedReason: null });
    expect(Object.keys(member!).sort()).toEqual(["blockedAt", "blockedReason", "clubExpiresAt", "createdAt", "email", "id", "name", "role"]);
  });
  it("keeps the admin payment limit and confirmed grant fields", async () => {
    const expiresAt = await grantClubDays(92401);
    const rows = await listAdminPayments();
    const grants = rows.filter(row => row.userId === 92401 && row.orderId.startsWith("admin-grant-"));
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ email: "grant@example.test", status: "paid", sum: "0", expiresAt, cancelAtPeriodEnd: false });
    expect(grants[0].paidAt).toBeInstanceOf(Date);
    expect(await listAdminPayments(1)).toHaveLength(1);
  });
  it("keeps a successful known-empty payment read distinct from unavailable storage", async () => {
    expect(await listAdminPayments(0)).toEqual([]);
  });
  it("starts an expired membership from now rather than its old expiry", async () => {
    await conn.query("UPDATE club_payments SET expiresAt=DATE_SUB(NOW(),INTERVAL 10 DAY) WHERE userId=92401");
    const before = Date.now();
    const expiry = await grantClubDays(92401, 2);
    expect(expiry.getTime()).toBeGreaterThanOrEqual(before + 2 * 86400000);
    expect(expiry.getTime()).toBeLessThanOrEqual(Date.now() + 2 * 86400000);
  });
  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])("rejects invalid duration %s without changing payments", async days => {
    const before = await payments();
    await expect(grantClubDays(92401, days)).rejects.toBeInstanceOf(RangeError);
    expect(await payments()).toEqual(before);
  });
  it.each(["blocked", "deleted"])("refuses a %s recipient without recording a grant", async state => {
    if (state === "blocked") await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=92401");
    else await conn.query("UPDATE users SET openId='deleted-92401-fixture',email=NULL,passwordHash=NULL WHERE id=92401");
    const before = await payments();
    await expect(grantClubDays(92401)).rejects.toThrow();
    expect(await payments()).toEqual(before);
  });
  it("refuses a missing recipient", async () => {
    await expect(grantClubDays(92409)).rejects.toThrow();
    const [rows] = await conn.query<RowDataPacket[]>("SELECT id FROM club_payments WHERE userId=92409");
    expect(rows).toEqual([]);
  });
});
