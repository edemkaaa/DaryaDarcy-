import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Pool, PoolConnection, RowDataPacket } from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { closeDb, getDb } from "../apps/backend/src/database/connection";
import { withDatabaseLock } from "../apps/backend/src/database/coordination";

describe.skipIf(!testDatabaseUrl)(
  "bounded admission on the real application pool",
  () => {
    let pool: Pool;
    beforeAll(async () => {
      const fixture = await openTestDatabase();
      await fixture.end();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("API_DB_BURST_QUEUE_ENABLED", "");
      pool = ((await getDb()) as unknown as { $client: Pool }).$client;
    });
    afterAll(async () => {
      await closeDb();
      vi.unstubAllEnvs();
    });

    async function occupy() {
      const held: PoolConnection[] = [];
      try {
        for (let i = 0; i < 10; i++) held.push(await pool.getConnection());
        return held;
      } catch (error) {
        held.forEach((connection) => connection.release());
        throw error;
      }
    }

    it("lets an ordinary queued query resume after a short busy period", async () => {
      const held = await occupy();
      const waiting = pool.query<RowDataPacket[]>("SELECT 42 AS value");
      held.pop()!.release();
      try {
        expect((await waiting)[0]).toEqual([{ value: 42 }]);
      } finally {
        held.forEach((connection) => connection.release());
      }
    });

    it("bounds expired waiters across bursts, returns 503 and never runs their work later", async () => {
      const held = await occupy();
      let runs = 0;
      const results: number[] = [];
      const wave = () =>
        Promise.all(
          Array.from({ length: 30 }, async (_, i) => {
            try {
              await withDatabaseLock(`pool-burst-${i}`, 0, async () => {
                runs++;
              });
              results.push(200);
            } catch (error) {
              results.push((error as { getStatus(): number }).getStatus());
            }
          }),
        );
      const first = wave();
      let second: Promise<unknown> | undefined;
      try {
        // Ten waiters are allowed. Excess requests must fail before the 3s deadline.
        await vi.waitFor(
          () => expect(results.length).toBeGreaterThanOrEqual(20),
          { timeout: 1000 },
        );
        await first;
        expect(results).toEqual(Array(30).fill(503));
        second = wave();
        // Expired driver waiters may still occupy the bounded queue; it must not grow.
        await vi.waitFor(() => expect(results).toEqual(Array(60).fill(503)), {
          timeout: 1000,
        });
      } finally {
        // Let every expired acquisition finish and return its connection.
        await first;
        held.forEach((connection) => connection.release());
        await second;
      }
      expect(runs).toBe(0);
      await vi.waitFor(async () => {
        expect(
          await withDatabaseLock("pool-recovered", 0, async () => 42),
        ).toEqual({ acquired: true, value: 42 });
      });
      expect(
        (await pool.query<RowDataPacket[]>("SELECT 42 AS value"))[0],
      ).toEqual([{ value: 42 }]);
      expect(runs).toBe(0);
    }, 15000);

    it("admits exactly 40 waiters with the burst queue enabled", async () => {
      await closeDb();
      vi.stubEnv("API_DB_BURST_QUEUE_ENABLED", "true");
      pool = ((await getDb()) as unknown as { $client: Pool }).$client;
      const held = await occupy();
      const acquire = () =>
        pool.getConnection().then(
          (connection) => {
            connection.release();
            return true;
          },
          (error: Error) => error.message,
        );
      const waiting = Array.from({ length: 40 }, acquire);
      let overflowResult: boolean | string | undefined;
      const overflow = acquire().then((result) => {
        overflowResult = result;
      });
      try {
        await vi.waitFor(
          () => expect(overflowResult).toBe("Queue limit reached."),
          { timeout: 1000 },
        );
      } finally {
        held.forEach((connection) => connection.release());
        await overflow;
      }
      expect(await Promise.all(waiting)).toEqual(Array(40).fill(true));
    });
  },
);
