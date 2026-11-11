import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mysql from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { billingKey } from "../apps/backend/src/billing/protocol";
import {
  requestClubCancellation,
  processCancellations,
} from "../apps/backend/src/billing/cancellation";
describe.skipIf(!testDatabaseUrl)("durable subscription cancellation", () => {
  let conn: mysql.Connection, pool: mysql.Pool, database: MySql2Database;
  beforeAll(async () => {
    conn = await openTestDatabase();
    pool = mysql.createPool({ uri: testDatabaseUrl!, timezone: "Z" });
    database = drizzle(pool);
    await conn.query(
      "INSERT IGNORE INTO users (id,openId,email) VALUES (779,'cancel-test','cancel@example.test')",
    );
  });
  beforeEach(async () => {
    for (const table of [
      "access_email_outbox",
      "billing_receipts",
      "billing_profiles",
      "club_payments",
    ])
      await conn.query(`DELETE FROM ${table} WHERE userId=779`);
    await conn.query(
      "INSERT INTO billing_profiles (profileKey,userId,domain,subscriptionId,profileId,email,amountMinor) VALUES ('cancel-fixture',779,'daryadarcy-club.payform.ru','123','456','cancel@example.test',79000)",
    );
    await conn.query(
      "INSERT INTO club_payments (userId,orderId,status,expiresAt,sum,email) VALUES (779,'club-779-test','paid','2026-12-01 00:00:00','790','cancel@example.test')",
    );
    const paymentKey = billingKey([
      "daryadarcy-club.payform.ru",
      "779-payment",
    ]);
    await conn.query(
      "INSERT INTO billing_receipts(paymentKey,userId,orderId,payloadHash,amountMinor) VALUES (?,779,'club-779-test',?,79000)",
      [
        paymentKey,
        billingKey([
          "club-779-test",
          "79000",
          "cancel@example.test",
          "rub",
          "123",
          "456",
        ]),
      ],
    );
    await conn.query(
      "INSERT INTO access_email_outbox(eventKey,userId,email,kind,payload) VALUES (?,779,'cancel@example.test','club-access',JSON_OBJECT('orderId','club-779-test'))",
      [`club-access:${paymentKey}`],
    );
  });
  afterAll(async () => {
    await pool?.end();
    for (const table of [
      "access_email_outbox",
      "billing_receipts",
      "billing_profiles",
      "club_payments",
    ])
      await conn?.query(`DELETE FROM ${table} WHERE userId=779`);
    await conn?.query(
      "DELETE FROM users WHERE id=779 AND openId='cancel-test'",
    );
    await conn?.end();
  });
  async function flags() {
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT cancelAtPeriodEnd,expiresAt FROM club_payments WHERE userId=779",
    );
    return rows[0];
  }
  it("provider failure is pending, not a confirmed cancellation", async () => {
    expect(
      (await requestClubCancellation(database, 779, async () => false))
        .confirmed,
    ).toBe(false);
    expect((await flags()).cancelAtPeriodEnd).toBe(0);
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT cancelRequestedAt,cancelledAt FROM billing_profiles WHERE userId=779",
    );
    expect(rows[0].cancelRequestedAt).not.toBeNull();
    expect(rows[0].cancelledAt).toBeNull();
  });
  it("confirmed cancellation preserves the entire paid period", async () => {
    expect(
      (await requestClubCancellation(database, 779, async () => true))
        .confirmed,
    ).toBe(true);
    expect(await flags()).toMatchObject({
      cancelAtPeriodEnd: 1,
      expiresAt: new Date("2026-12-01T00:00:00Z"),
    });
  });
  it("worker retries a failed cancellation after a restart", async () => {
    await requestClubCancellation(database, 779, async () => false);
    await conn.query(
      "UPDATE billing_profiles SET nextAttemptAt=NOW() WHERE userId=779",
    );
    await processCancellations(database, async () => true, 779);
    expect((await flags()).cancelAtPeriodEnd).toBe(1);
  });
  it("parallel workers claim a cancellation once", async () => {
    await requestClubCancellation(database, 779, async () => false);
    await conn.query(
      "UPDATE billing_profiles SET nextAttemptAt=NOW() WHERE userId=779",
    );
    let calls = 0;
    await Promise.all(
      Array.from({ length: 4 }, () =>
        processCancellations(
          database,
          async () => {
            calls++;
            return true;
          },
          779,
        ),
      ),
    );
    expect(calls).toBe(1);
  });
  it("legacy monthly subscriptions without a verified provider profile cannot falsely report success", async () => {
    await conn.query("DELETE FROM billing_profiles WHERE userId=779");
    await expect(
      requestClubCancellation(database, 779, async () => true),
    ).rejects.toThrow("profile");
    expect((await flags()).cancelAtPeriodEnd).toBe(0);
  });
});
