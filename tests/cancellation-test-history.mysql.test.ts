import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { settleClubOrder } from "../apps/backend/src/billing/settlement";
import {
  CancellationUnavailableError,
  readClubCancellationStatus,
  requestClubCancellation,
} from "../apps/backend/src/billing/cancellation";
import { clubPayments } from "../packages/database/src/schema";
import { eq } from "drizzle-orm";

describe.skipIf(!testDatabaseUrl)(
  "cancellation after one-off TEST checkout",
  () => {
    const userId = 97861;
    const email = "test-history-97861@example.test";
    const testOrder = "club-test-97861-83be933e-a277-41f3-801d-45771c12b051";
    const liveOrder = "club-97861-live-history";
    let conn: mysql.Connection;
    let pool: mysql.Pool;
    let database: MySql2Database;

    async function cleanup() {
      for (const table of [
        "access_email_outbox",
        "billing_receipts",
        "billing_profiles",
        "club_payments",
      ])
        await conn.query(`DELETE FROM ${table} WHERE userId=?`, [userId]);
      await conn.query("DELETE FROM users WHERE id=?", [userId]);
    }
    beforeAll(async () => {
      conn = await openTestDatabase();
      pool = mysql.createPool({ uri: testDatabaseUrl!, timezone: "Z" });
      database = drizzle(pool);
    });
    beforeEach(async () => {
      await cleanup();
      await conn.query(
        "INSERT INTO users(id,openId,email,passwordHash) VALUES(?,?,?,?)",
        [userId, "test-history-97861", email, "existing-fixture-password-hash"],
      );
    });
    afterAll(async () => {
      await pool?.end();
      if (conn) await cleanup();
      await conn?.end();
    });

    async function settleTest(foreign: boolean) {
      await conn.query(
        "INSERT INTO club_payments(userId,orderId,email,sum) VALUES(?,?,?,'790')",
        [userId, testOrder, email],
      );
      expect(
        await settleClubOrder(database, {
          orderId: testOrder,
          sum: "790",
          periodMs: 30 * 86400000,
          proof: {
            domain: "testpage1.payform.ru",
            paymentId: "9786101",
            email,
            currency: "rub",
            ...(foreign
              ? {
                  testForeignPayment: {
                    currency: "eur" as const,
                    amountMinor: 950,
                  },
                }
              : {}),
          },
        }),
      ).toBe(true);
    }
    async function settleLive() {
      await conn.query(
        "INSERT INTO club_payments(userId,orderId,email,sum) VALUES(?,?,?,'790')",
        [userId, liveOrder, email],
      );
      expect(
        await settleClubOrder(database, {
          orderId: liveOrder,
          sum: "790",
          periodMs: 30 * 86400000,
          proof: {
            domain: "cancellation-history.example.test",
            paymentId: "9786102",
            email,
            currency: "rub",
            subscriptionId: "123",
            profileId: "456",
          },
        }),
      ).toBe(true);
    }
    async function paidRows() {
      return (
        await conn.query<RowDataPacket[]>(
          "SELECT orderId,status,expiresAt FROM club_payments WHERE userId=? ORDER BY id",
          [userId],
        )
      )[0];
    }
    it.each([false, true])(
      "cancels LIVE after a verified one-off TEST (foreign=%s)",
      async (foreign) => {
        await settleTest(foreign);
        await settleLive();
        const before = await paidRows();
        const sent: string[] = [];
        const result = await requestClubCancellation(
          database,
          userId,
          async (profile) => {
            sent.push(profile.profileId);
            return true;
          },
        );
        expect(result.confirmed).toBe(true);
        expect(sent).toEqual(["456"]);
        expect(await paidRows()).toEqual(before);
        const [live] = await database
          .select()
          .from(clubPayments)
          .where(eq(clubPayments.orderId, liveOrder));
        expect(await readClubCancellationStatus(database, userId, live)).toBe(
          "confirmed",
        );
        expect(
          (
            await requestClubCancellation(database, userId, async () => {
              throw new Error(
                "Already cancelled profile must not be sent again",
              );
            })
          ).confirmed,
        ).toBe(true);
      },
    );
    it("still refuses an unverified TEST-shaped paid row", async () => {
      await conn.query(
        "INSERT INTO club_payments(userId,orderId,email,sum,status) VALUES(?,?,?,'790','paid')",
        [userId, testOrder, email],
      );
      await settleLive();
      await expect(
        requestClubCancellation(database, userId, async () => {
          throw new Error(
            "Unverified history must be checked before the provider",
          );
        }),
      ).rejects.toBeInstanceOf(CancellationUnavailableError);
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT cancelRequestedAt FROM billing_profiles WHERE userId=?",
        [userId],
      );
      expect(rows[0].cancelRequestedAt).toBeNull();
    });
    it("confirms that a verified one-off TEST alone has no recurring charges", async () => {
      await settleTest(false);
      const result = await requestClubCancellation(
        database,
        userId,
        async () => {
          throw new Error("A one-off TEST has no profile to cancel");
        },
      );
      expect(result.confirmed).toBe(true);
      const [paid] = await database
        .select()
        .from(clubPayments)
        .where(eq(clubPayments.orderId, testOrder));
      expect(await readClubCancellationStatus(database, userId, paid)).toBe(
        "confirmed",
      );
    });
    it("a verified TEST never masks an unbound monthly payment", async () => {
      await settleTest(false);
      await conn.query(
        "INSERT INTO club_payments(userId,orderId,email,sum,status) VALUES(?,? ,?,'790','paid')",
        [userId, "club-97861-unbound", email],
      );
      await settleLive();
      await expect(
        requestClubCancellation(database, userId, async () => {
          throw new Error("Unbound monthly subscription must remain a refusal");
        }),
      ).rejects.toBeInstanceOf(CancellationUnavailableError);
    });
  },
);
