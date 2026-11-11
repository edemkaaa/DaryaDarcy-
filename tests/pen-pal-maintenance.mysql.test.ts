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

/** Проверяет retention анкет и пар Pen Pals при повторных worker, реактивации и конкурентном продлении. */
describe.skipIf(!testDatabaseUrl)(
  "Pen Pals maintenance on disposable MySQL",
  () => {
    const owner = 992301,
      peer = 992302;
    let conn: Connection;
    /** Создаёт управляемый Promise-барьер с явным release для детерминированной конкуренции. */
    const gate = () => {
      let release!: () => void;
      const wait = new Promise<void>((resolve) => {
        release = resolve;
      });
      return { wait, release };
    };
    /** Удаляет только связи, подписки, анкеты, показы, согласия и двух пользователей suite. */
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
    /** Открывает одноразовую БД и включает Pen Pals только в тестовом процессе. */
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("ENABLE_PEN_PALS", "true");
    });
    /** Восстанавливает двух участников и активные анкеты с synthetic адресами. */
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
    /** Возвращает перехваченный SQL-метод пула. */
    afterEach(() => vi.restoreAllMocks());
    /** Очищает fixture, закрывает соединение и прикладной пул и возвращает окружение. */
    afterAll(async () => {
      if (conn) await cleanup();
      await conn?.end();
      await closeDb();
      vi.unstubAllEnvs();
    });
    /** Захватывает текущую строку владельца в настоящем router caller. */
    async function caller() {
      return appRouter.createCaller({
        user: (await getUserByOpenId("pen-maint-owner"))!,
        req: {},
        res: {},
      } as TrpcContext);
    }
    /** Читает поля, активность и updatedAt собственного профиля для проверки сохранности после maintenance. */
    async function profile() {
      return (
        await conn.query<RowDataPacket[]>(
          "SELECT fullName,address,active,updatedAt FROM pen_pal_profiles WHERE userId=?",
          [owner],
        )
      )[0][0];
    }
    /** Делает анкету неактивной и старше существующего 30-дневного retention. */
    async function inactive() {
      await conn.query(
        "UPDATE pen_pal_profiles SET active=FALSE,updatedAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE userId=?",
        [owner],
      );
    }
    // Pause after a real candidate SELECT; no returned SQL rows are fabricated.
    /** После реального SELECT кандидатов ставит единственную паузу, сохраняя полученные SQL-строки без подмены. */
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
    /** Реактивированная либо заново отозванная свежая анкета не удаляется по устаревшему списку кандидатов. */
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
    /** Два worker одного кандидата учитывают только фактически удалённую одной транзакцией анкету. */
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
    /** Нетронутая неактивная анкета старше 30 дней удаляется. */
    it("removes an untouched inactive profile past the existing 30-day cutoff", async () => {
      await inactive();
      expect(await purgeStalePenPalData()).toEqual({ profiles: 1, matches: 0 });
      expect(await profile()).toBeUndefined();
    });
    /** Недавно отозванная анкета сохраняется до окончания retention. */
    it("keeps a recently withdrawn profile for the existing retention period", async () => {
      await (await caller()).penPals.remove();
      const before = await profile();
      expect(await purgeStalePenPalData()).toEqual({ profiles: 0, matches: 0 });
      expect(await profile()).toEqual(before);
    });
    /** Создаёт давнюю истёкшую подписку и взаимно подтверждённую пару владельца. */
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
    /** Maintenance ждёт owner-lock и после реального продления сохраняет анкету и её пару. */
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
    /** Действительно истёкшая анкета деактивируется вместе с удалением её пар одной транзакцией. */
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
    /** Проход достигает 105 кандидатов за первой страницей, сохраняя единственного действительно продлённого. */
    it("reaches expired profiles beyond the first page and preserves a renewed profile", async () => {
      const ids = Array.from({ length: 105 }, (_, index) => 992400 + index);
      const renewed = ids[100];
      const range = [ids[0], ids[ids.length - 1]];
      try {
        await conn.query("INSERT INTO users(id,openId) VALUES ?", [
          ids.map((id) => [id, `pen-maint-page-${id}`]),
        ]);
        await conn.query(
          "INSERT INTO pen_pal_profiles(userId,city,interests,address,active) VALUES ?",
          [
            ids.map((id) => [
              id,
              "Synthetic city",
              "[]",
              "Synthetic address",
              1,
            ]),
          ],
        );
        const expired = new Date(Date.now() - 100 * 86_400_000);
        await conn.query(
          "INSERT INTO club_payments(userId,orderId,status,expiresAt) VALUES ?",
          [ids.map((id) => [id, `pen-maint-page-${id}`, "paid", expired])],
        );
        await conn.query(
          "INSERT INTO club_payments(userId,orderId,status,expiresAt) VALUES (?,'pen-maint-page-renewal','paid',DATE_ADD(NOW(),INTERVAL 1 DAY))",
          [renewed],
        );
        expect(await purgeStalePenPalData()).toEqual({
          profiles: 104,
          matches: 0,
        });
        const [active] = await conn.query<RowDataPacket[]>(
          "SELECT userId FROM pen_pal_profiles WHERE userId BETWEEN ? AND ? AND active=TRUE",
          range,
        );
        expect(active).toEqual([{ userId: renewed }]);
      } finally {
        await conn.query(
          "DELETE FROM club_payments WHERE userId BETWEEN ? AND ?",
          range,
        );
        await conn.query(
          "DELETE FROM pen_pal_profiles WHERE userId BETWEEN ? AND ?",
          range,
        );
        await conn.query("DELETE FROM users WHERE id BETWEEN ? AND ?", range);
      }
    });
    /** Fault-триггер удаления пар откатывает деактивацию анкеты. */
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
    /** Отсутствие оплаченной истории сохраняет анкету по текущей retention-политике. */
    it("retains a profile with no paid history under the existing policy", async () => {
      const before = await profile();
      expect(await purgeStalePenPalData()).toEqual({ profiles: 0, matches: 0 });
      expect(await profile()).toEqual(before);
    });
    /** Просроченный deadline удаляет только неподтверждённую пару, сохраняя взаимно подтверждённую. */
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
