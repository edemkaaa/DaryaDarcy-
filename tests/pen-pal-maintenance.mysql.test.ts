import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Connection, Pool, RowDataPacket } from "mysql2/promise";
import { eq } from "drizzle-orm";
import { users } from "../packages/database/src/schema";
import { closeDb, getDb, getUserByOpenId } from "../apps/backend/src/db";
import { appRouter } from "../apps/backend/src/routers";
import type { TrpcContext } from "../apps/backend/src/_core/context";
import { purgeStalePenPalData } from "../apps/backend/src/identity/account-retention";
import { grantClubAccessInTransaction } from "../apps/backend/src/billing/grants";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";

describe.skipIf(!testDatabaseUrl)(
  "Pen Pals maintenance on disposable MySQL",
  () => {
    const owner = 992301,
      peer = 992302;
    let conn: Connection;
    const gate = () => {
      let release!: () => void;
      const wait = new Promise<void>((resolve) => {
        release = resolve;
      });
      return { wait, release };
    };
    async function cleanup() {
      await conn.query(
        "DELETE FROM pen_pal_matches WHERE userLowId IN (?,?) OR userHighId IN (?,?)",
        [owner, peer, owner, peer],
      );
      for (const table of [
        "club_payments",
        "pen_pal_profiles",
        "pen_pal_shown",
        "user_consent_events",
      ])
        await conn.query(`DELETE FROM ${table} WHERE userId IN (?,?)`, [
          owner,
          peer,
        ]);
      await conn.query("DELETE FROM users WHERE id IN (?,?)", [owner, peer]);
    }
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("ENABLE_PEN_PALS", "true");
    });
    beforeEach(async () => {
      await cleanup();
      await conn.query(
        "INSERT INTO users(id,openId,name,email) VALUES (?,'pen-maint-owner','Synthetic owner','pen-maint-owner@example.test'),(?,'pen-maint-peer','Synthetic peer','pen-maint-peer@example.test')",
        [owner, peer],
      );
      for (const id of [owner, peer])
        await conn.query(
          "INSERT INTO pen_pal_profiles(userId,fullName,city,interests,address,active) VALUES (?,'Old synthetic name','Synthetic city',JSON_ARRAY('Сад','Книги'),'Old synthetic address',TRUE)",
          [id],
        );
    });
    afterEach(() => vi.restoreAllMocks());
    afterAll(async () => {
      if (conn) await cleanup();
      await conn?.end();
      await closeDb();
      vi.unstubAllEnvs();
    });
    async function caller() {
      return appRouter.createCaller({
        user: (await getUserByOpenId("pen-maint-owner"))!,
        req: {},
        res: {},
      } as TrpcContext);
    }
    async function profile() {
      return (
        await conn.query<RowDataPacket[]>(
          "SELECT fullName,address,active,updatedAt FROM pen_pal_profiles WHERE userId=?",
          [owner],
        )
      )[0][0];
    }
    async function inactive() {
      await conn.query(
        "UPDATE pen_pal_profiles SET active=FALSE,updatedAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE userId=?",
        [owner],
      );
    }
    // Pause after a real candidate SELECT; no returned SQL rows are fabricated.
    async function pauseInactiveCandidates() {
      const pool = (
        (await getDb()) as NonNullable<Awaited<ReturnType<typeof getDb>>> & {
          $client: Pool;
        }
      ).$client;
      const original = pool.query.bind(pool),
        entered = gate(),
        resume = gate();
      let paused = false;
      vi.spyOn(pool, "query").mockImplementation((async (
        statement: unknown,
        values?: unknown,
      ) => {
        const result = await (
          original as (sql: unknown, values?: unknown) => Promise<unknown>
        )(statement, values);
        const query =
          typeof statement === "string"
            ? statement
            : ((statement as { sql?: string }).sql ?? "");
        if (
          !paused &&
          /^select/i.test(query) &&
          query.includes("from `pen_pal_profiles`") &&
          query.includes("`updatedAt` <")
        ) {
          paused = true;
          entered.release();
          await resume.wait;
        }
        return result;
      }) as typeof pool.query);
      return { entered, resume };
    }
    it.each(["reactivate", "reactivate-then-withdraw"] as const)(
      "preserves a freshly renewed profile: %s",
      async (action) => {
        await inactive();
        const actor = await caller(),
          pause = await pauseInactiveCandidates();
        const pending = purgeStalePenPalData();
        try {
          await Promise.race([
            pause.entered.wait,
            pending.then(() => {
              throw Error("Expected paused candidate SQL");
            }),
          ]);
          await actor.penPals.upsert({
            fullName: "New synthetic name",
            interests: ["Сад", "Книги"],
            address: "New synthetic address",
            adultConsent: true,
          });
          if (action === "reactivate-then-withdraw")
            await actor.penPals.remove();
          const before = await profile();
          pause.resume.release();
          expect(await pending).toEqual({ profiles: 0, matches: 0 });
          expect(await profile()).toEqual(before);
          expect(before).toMatchObject({
            fullName: "New synthetic name",
            address: "New synthetic address",
            active: action === "reactivate" ? 1 : 0,
          });
        } finally {
          pause.resume.release();
          await pending.catch(() => {});
        }
      },
    );
    it("counts only actual removals when two maintenance runs share a candidate", async () => {
      await inactive();
      const pause = await pauseInactiveCandidates(),
        first = purgeStalePenPalData();
      try {
        await Promise.race([
          pause.entered.wait,
          first.then(() => {
            throw Error("Expected paused candidate SQL");
          }),
        ]);
        const second = await purgeStalePenPalData();
        pause.resume.release();
        expect(second).toEqual({ profiles: 1, matches: 0 });
        expect(await first).toEqual({ profiles: 0, matches: 0 });
        expect(await profile()).toBeUndefined();
      } finally {
        pause.resume.release();
        await first.catch(() => {});
      }
    });
    it("removes an untouched inactive profile past the existing 30-day cutoff", async () => {
      await inactive();
      expect(await purgeStalePenPalData()).toEqual({ profiles: 1, matches: 0 });
      expect(await profile()).toBeUndefined();
    });
    it("keeps a recently withdrawn profile for the existing retention period", async () => {
      await (await caller()).penPals.remove();
      const before = await profile();
      expect(await purgeStalePenPalData()).toEqual({ profiles: 0, matches: 0 });
      expect(await profile()).toEqual(before);
    });
    async function oldExpiry() {
      await conn.query(
        "INSERT INTO club_payments(userId,orderId,email,status,sum,paidAt,expiresAt) VALUES (?,'pen-maint-old','pen-maint-owner@example.test','paid','0',DATE_SUB(NOW(),INTERVAL 140 DAY),DATE_SUB(NOW(),INTERVAL 100 DAY))",
        [owner],
      );
      await conn.query(
        "INSERT INTO pen_pal_matches(userLowId,userHighId,initiatedBy,userLowConfirmed,userHighConfirmed,mutualConfirmedAt,confirmDeadline) VALUES (?,?,?,TRUE,TRUE,NOW(),DATE_ADD(NOW(),INTERVAL 1 DAY))",
        [owner, peer, owner],
      );
    }
    it("rechecks expiry after a real concurrent grant commits under the owner lock", async () => {
      await oldExpiry();
      const database = (await getDb())!,
        locked = gate(),
        releaseGrant = gate();
      const granting = database.transaction(async (tx) => {
        await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, owner))
          .for("update");
        locked.release();
        await releaseGrant.wait;
        return grantClubAccessInTransaction(tx, owner, 31);
      });
      await locked.wait;
      const maintenance = purgeStalePenPalData();
      try {
        await expect
          .poll(
            async () => {
              const [rows] = await conn.query<RowDataPacket[]>(
                "SELECT COUNT(*) AS n FROM performance_schema.data_lock_waits w JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID=w.REQUESTING_ENGINE_LOCK_ID WHERE l.OBJECT_SCHEMA=DATABASE() AND l.OBJECT_NAME='users'",
              );
              return Number(rows[0].n);
            },
            { timeout: 3000, interval: 30 },
          )
          .toBeGreaterThan(0);
        releaseGrant.release();
        expect((await granting).getTime()).toBeGreaterThan(Date.now());
        expect(await maintenance).toEqual({ profiles: 0, matches: 0 });
        expect(await profile()).toMatchObject({
          active: 1,
          address: "Old synthetic address",
        });
        expect(
          (
            await conn.query<RowDataPacket[]>(
              "SELECT id FROM pen_pal_matches WHERE userLowId=?",
              [owner],
            )
          )[0],
        ).toHaveLength(1);
      } finally {
        releaseGrant.release();
        await Promise.allSettled([granting, maintenance]);
      }
    });
    it("deactivates an actually expired profile and removes its matches atomically", async () => {
      await oldExpiry();
      expect(await purgeStalePenPalData()).toEqual({ profiles: 1, matches: 0 });
      expect(await profile()).toMatchObject({ active: 0 });
      expect(
        (
          await conn.query<RowDataPacket[]>(
            "SELECT id FROM pen_pal_matches WHERE userLowId=?",
            [owner],
          )
        )[0],
      ).toHaveLength(0);
    });
    it("rolls back deactivation when deleting its links fails", async () => {
      await oldExpiry();
      await conn.query(
        `CREATE TRIGGER pen_maintenance_match_refusal BEFORE DELETE ON pen_pal_matches FOR EACH ROW BEGIN IF OLD.userLowId=${owner} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic match deletion refusal'; END IF; END`,
      );
      try {
        await expect(purgeStalePenPalData()).rejects.toThrow();
        expect(await profile()).toMatchObject({ active: 1 });
        expect(
          (
            await conn.query<RowDataPacket[]>(
              "SELECT id FROM pen_pal_matches WHERE userLowId=?",
              [owner],
            )
          )[0],
        ).toHaveLength(1);
      } finally {
        await conn.query("DROP TRIGGER pen_maintenance_match_refusal");
      }
    });
    it("retains a profile with no paid history under the existing policy", async () => {
      const before = await profile();
      expect(await purgeStalePenPalData()).toEqual({ profiles: 0, matches: 0 });
      expect(await profile()).toEqual(before);
    });
    it("expires only unconfirmed matches and preserves mutual ones", async () => {
      await oldExpiry();
      await conn.query("DELETE FROM club_payments WHERE userId=?", [owner]);
      await conn.query(
        "UPDATE pen_pal_matches SET confirmDeadline=DATE_SUB(NOW(),INTERVAL 1 DAY) WHERE userLowId=?",
        [owner],
      );
      await conn.query(
        "INSERT INTO pen_pal_matches(userLowId,userHighId,initiatedBy,confirmDeadline) VALUES (?,992303,?,DATE_SUB(NOW(),INTERVAL 1 DAY))",
        [owner, owner],
      );
      expect(await purgeStalePenPalData()).toEqual({ profiles: 0, matches: 1 });
      expect(
        (
          await conn.query<RowDataPacket[]>(
            "SELECT mutualConfirmedAt FROM pen_pal_matches WHERE userLowId=?",
            [owner],
          )
        )[0],
      ).toHaveLength(1);
    });
  },
);
