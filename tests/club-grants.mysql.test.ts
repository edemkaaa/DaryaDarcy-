import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Connection, RowDataPacket } from "mysql2/promise";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import type { AppRouter } from "../apps/backend/src/routers";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { getDb, grantClubDays, listAdminMembers, listAdminPayments } from "../apps/backend/src/db";

describe.skipIf(!testDatabaseUrl)("manual club grants on disposable MySQL", () => {
  let conn: Connection;
  let app: INestApplication, base: string, token: string;
  const admin = (bearer = token) => createTRPCProxyClient<AppRouter>({ links: [httpLink({ url: base + "/api/trpc", transformer: superjson, headers: bearer ? { Authorization: `Bearer ${bearer}` } : {} })] }).admin;
  beforeAll(async () => {
    conn = await openTestDatabase();
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    vi.stubEnv("JWT_SECRET", "synthetic-native-grants-jwt-secret-32");
    await conn.query("INSERT INTO users (id,openId,role,sessionVersion) VALUES (92400,'grant-admin-fixture','admin',0)");
    await conn.query("INSERT IGNORE INTO users (id,openId,email) VALUES (92401,'grant-fixture','grant@example.test')");
    app = await createBackendApplication();
    await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    token = await sdk.createSessionToken("grant-admin-fixture", { sessionVersion: 0 });
  });
  beforeEach(async () => {
    await conn.query("UPDATE users SET role='admin',blockedAt=NULL WHERE id=92400");
    await conn.query("DELETE FROM club_payments WHERE userId=92401");
    await conn.query("UPDATE users SET blockedAt=NULL,openId='grant-fixture',email='grant@example.test' WHERE id=92401");
    await conn.query(`INSERT INTO club_payments (userId,orderId,email,status,expiresAt)
      VALUES (92401,'grant-fixture-initial','grant@example.test','paid',DATE_ADD(NOW(),INTERVAL 60 DAY))`);
  });
  afterAll(async () => {
    await app?.close();
    if (conn) {
      await conn.query("DELETE FROM club_payments WHERE userId IN (92400,92401)");
      await conn.query("DELETE FROM users WHERE id IN (92400,92401)");
    }
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
    await expect(grantClubDays(92401)).rejects.toMatchObject({ code: "CONFLICT", message: "Аккаунт недоступен для выдачи доступа" });
    expect(await payments()).toEqual(before);
  });
  it("refuses a missing recipient", async () => {
    await expect(grantClubDays(92409)).rejects.toMatchObject({ code: "NOT_FOUND", message: "Аккаунт не найден" });
    const [rows] = await conn.query<RowDataPacket[]>("SELECT id FROM club_payments WHERE userId=92409");
    expect(rows).toEqual([]);
  });
  it.each(["missing", "blocked", "deleted"] as const)("returns an explicit native refusal for a %s recipient without changing rows", async state => {
    if (state === "blocked") await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=92401");
    if (state === "deleted") await conn.query("UPDATE users SET openId='deleted-92401-fixture',email=NULL,passwordHash=NULL WHERE id=92401");
    const [accounts] = await conn.query("SELECT * FROM users WHERE id=92401");
    const before = await payments();
    await expect(admin().grantClub.mutate({ userId: state === "missing" ? 92409 : 92401 })).rejects.toMatchObject({
      message: state === "missing" ? "Аккаунт не найден" : "Аккаунт недоступен для выдачи доступа",
      data: { code: state === "missing" ? "NOT_FOUND" : "CONFLICT", httpStatus: state === "missing" ? 404 : 409 },
    });
    expect(await payments()).toEqual(before);
    expect((await conn.query("SELECT * FROM users WHERE id=92401"))[0]).toEqual(accounts);
    expect((await conn.query("SELECT id FROM club_payments WHERE userId IN (92400,92409)"))[0]).toEqual([]);
  });
  it("acknowledges a real admin grant only with its committed 31-day expiry", async () => {
    const initial = (await payments())[0].expiresAt as Date;
    const result = await admin().grantClub.mutate({ userId: 92401 });
    expect(result).toEqual({ ok: true, expiresAt: new Date(initial.getTime() + 31 * 86400000).toISOString() });
    expect(await payments()).toHaveLength(2);
    expect((await payments()).at(-1)).toMatchObject({ status: "paid", sum: "0", expiresAt: new Date(result.expiresAt) });
  });
  it.each(["guest", "user", "moderator", "blocked-admin"] as const)("does not grant or change history for %s", async access => {
    if (access !== "guest") await conn.query("UPDATE users SET role=?,blockedAt=? WHERE id=92400", [access === "blocked-admin" ? "admin" : access, access === "blocked-admin" ? new Date() : null]);
    const before = await payments();
    const unauthenticated = access === "guest" || access === "blocked-admin";
    await expect(admin(access === "guest" ? "" : token).grantClub.mutate({ userId: 92401 })).rejects.toMatchObject({ data: { code: unauthenticated ? "UNAUTHORIZED" : "FORBIDDEN", httpStatus: unauthenticated ? 401 : 403 } });
    expect(await payments()).toEqual(before);
  });
});
