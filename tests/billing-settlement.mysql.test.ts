import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Connection } from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { getDb } from "../apps/backend/src/db";
import { fulfillPaidOrder } from "../apps/backend/src/prodamus";

describe.skipIf(!testDatabaseUrl)("billing settlement on disposable MySQL", () => {
  let conn: Connection;
  beforeAll(async () => {
    conn = await openTestDatabase();
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-02T00:00:00Z"));
    await conn.query("INSERT IGNORE INTO users (id,openId,email) VALUES (777,'billing-test','member@example.test')");
  });
  beforeEach(async () => {
    await conn.query("DELETE FROM club_payments WHERE userId=777");
    await conn.query("INSERT INTO club_payments (userId,orderId,email,sum) VALUES (777,'club-777-a','member@example.test','790'),(777,'club-777-b','member@example.test','790')");
  });
  afterAll(async () => {
    vi.useRealTimers();
    await conn?.end();
    const database = await getDb();
    // The application owns this connection; tests close its actual driver, not a test-only production method.
    await (database as unknown as { $client: { end(): Promise<void> } })?.$client.end();
    vi.unstubAllEnvs();
  });
  async function latestExpiry() {
    const [rows] = await conn.query<mysqlRows>("SELECT MAX(expiresAt) AS expiry FROM club_payments WHERE userId=777 AND status='paid'");
    return rows[0].expiry?.toISOString();
  }
  const pay = (orderId: string) => fulfillPaidOrder(orderId, { email: "member@example.test", sum: "790", userId: 777 });
  it("sequential replay extends access only once", async () => {
    await pay("club-777-a"); await pay("club-777-a");
    expect(await latestExpiry()).toBe("2026-11-01T00:00:00.000Z");
  });
  it("concurrent distinct payments do not lose a paid period", async () => {
    await Promise.all([pay("club-777-a"), pay("club-777-b")]);
    expect(await latestExpiry()).toBe("2026-12-01T00:00:00.000Z");
  });
  it("concurrent replays grant one period", async () => {
    await Promise.all(Array.from({ length: 12 }, () => pay("club-777-a")));
    expect(await latestExpiry()).toBe("2026-11-01T00:00:00.000Z");
  });
});
type mysqlRows = (import("mysql2").RowDataPacket & { expiry: Date | null })[];
