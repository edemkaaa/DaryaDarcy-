import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { getDb, publishDueScheduledPosts } from "../apps/backend/src/db";

type Publications = Awaited<ReturnType<typeof publishDueScheduledPosts>>;
describe.skipIf(!testDatabaseUrl)(
  "scheduled publication ownership on disposable MySQL",
  () => {
    let conn: Connection;
    beforeAll(async () => {
      conn = await openContentTestDatabase();
      // Share fixture ownership with manual publication tests, not worker locks.
      const [locks] = await conn.query<RowDataPacket[]>(
        "SELECT GET_LOCK('backend_test_post_publication',30) AS acquired",
      );
      expect(locks[0].acquired).toBe(1);
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    }, 35_000);
    async function cleanup() {
      await conn.query("DELETE FROM posts WHERE id BETWEEN 11201 AND 11206");
    }
    beforeEach(async () => {
      await cleanup();
      await conn.query(`INSERT INTO posts
      (id,text,photos,tags,status,published,target,scheduledAt,publishedAt) VALUES
      (11201,'Due feed',JSON_ARRAY(),JSON_ARRAY(),'scheduled',FALSE,'feed','2026-01-01 00:00:00',NULL),
      (11202,'Due club',JSON_ARRAY(),JSON_ARRAY(),'scheduled',FALSE,'club','2026-01-02 00:00:00','2025-01-01 00:00:00'),
      (11203,'Future',JSON_ARRAY(),JSON_ARRAY(),'scheduled',FALSE,'both',DATE_ADD(NOW(),INTERVAL 1 DAY),NULL),
      (11204,'Draft',JSON_ARRAY(),JSON_ARRAY(),'draft',FALSE,'feed','2026-01-01 00:00:00',NULL),
      (11205,'Unscheduled',JSON_ARRAY(),JSON_ARRAY(),'scheduled',FALSE,'feed',NULL,NULL),
      (11206,'Already public',JSON_ARRAY(),JSON_ARRAY(),'published',TRUE,'feed','2026-01-01 00:00:00',NULL)`);
    });
    afterAll(async () => {
      await cleanup();
      await conn?.end();
      const database = await getDb();
      await (
        database as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    async function snapshot() {
      const [rows] = await conn.query<
        RowDataPacket[]
      >(`SELECT id,status,published,
      DATE_FORMAT(publishedAt,'%Y-%m-%d %H:%i:%s') publishedAt
      FROM posts WHERE id BETWEEN 11201 AND 11206 ORDER BY id`);
      return rows;
    }
    async function waitingWorkers() {
      const [rows] = await conn.query<RowDataPacket[]>(`SELECT COUNT(*) n
      FROM performance_schema.data_lock_waits w
      JOIN performance_schema.data_locks b ON b.ENGINE_LOCK_ID=w.BLOCKING_ENGINE_LOCK_ID
      WHERE b.OBJECT_SCHEMA=DATABASE() AND b.OBJECT_NAME='posts'`);
      return Number(rows[0].n);
    }
    it("returns only due transitions and preserves publication dates and target", async () => {
      expect(
        (await publishDueScheduledPosts()).sort((a, b) => a.id - b.id),
      ).toEqual([
        { id: 11201, text: "Due feed", target: "feed" },
        { id: 11202, text: "Due club", target: "club" },
      ]);
      expect(await snapshot()).toEqual([
        {
          id: 11201,
          status: "published",
          published: 1,
          publishedAt: "2026-01-01 00:00:00",
        },
        {
          id: 11202,
          status: "published",
          published: 1,
          publishedAt: "2025-01-01 00:00:00",
        },
        { id: 11203, status: "scheduled", published: 0, publishedAt: null },
        { id: 11204, status: "draft", published: 0, publishedAt: null },
        { id: 11205, status: "scheduled", published: 0, publishedAt: null },
        { id: 11206, status: "published", published: 1, publishedAt: null },
      ]);
      expect(await publishDueScheduledPosts()).toEqual([]);
    });
    it("two workers and the next tick return each publication only once", async () => {
      const guard = await openTestDatabase();
      const finished = [false, false];
      let workers: Promise<Publications>[] = [];
      try {
        await guard.beginTransaction();
        await guard.query("SELECT id FROM posts WHERE id=11201 FOR UPDATE");
        workers = finished.map((_, i) =>
          publishDueScheduledPosts().then((rows) => {
            finished[i] = true;
            return rows;
          }),
        );
        // Old workers block after both read the same stale batch; fixed workers
        // can finish by skipping the locked row. Observe either, without a sleep.
        await vi.waitFor(
          async () => {
            expect(
              finished.every(Boolean) || (await waitingWorkers()) >= 2,
            ).toBe(true);
          },
          { timeout: 3000, interval: 20 },
        );
        await guard.commit();
        const batches = await Promise.all(workers);
        batches.push(await publishDueScheduledPosts());
        expect(
          batches
            .flat()
            .map((row) => row.id)
            .sort(),
        ).toEqual([11201, 11202]);
        expect(
          (await snapshot())
            .slice(0, 2)
            .every((row) => row.status === "published"),
        ).toBe(true);
      } finally {
        await guard.rollback();
        await Promise.allSettled(workers);
        await guard.end();
      }
    });
    it("does not announce a draft withdrawn while its row is locked", async () => {
      await conn.query("UPDATE posts SET status='draft' WHERE id=11202");
      const guard = await openTestDatabase();
      let finished = false;
      let worker: Promise<Publications> | undefined;
      try {
        await guard.beginTransaction();
        await guard.query("SELECT id FROM posts WHERE id=11201 FOR UPDATE");
        worker = publishDueScheduledPosts().then((rows) => {
          finished = true;
          return rows;
        });
        await vi.waitFor(
          async () => {
            expect(finished || (await waitingWorkers()) > 0).toBe(true);
          },
          { timeout: 3000, interval: 20 },
        );
        await guard.query(
          "UPDATE posts SET status='draft',text='Withdrawn secret' WHERE id=11201",
        );
        await guard.commit();
        expect(await worker).toEqual([]);
        expect((await snapshot())[0]).toMatchObject({
          status: "draft",
          published: 0,
          publishedAt: null,
        });
        expect(await publishDueScheduledPosts()).toEqual([]);
      } finally {
        await guard.rollback();
        await worker;
        await guard.end();
      }
    });
    it("rolls back the entire claimed batch when publication fails, then retries", async () => {
      const before = await snapshot();
      await conn.query(`CREATE TRIGGER backend_test_scheduled_failure BEFORE UPDATE ON posts FOR EACH ROW
      BEGIN IF OLD.id=11202 AND NEW.status='published' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Fixture publication failure'; END IF; END`);
      try {
        await expect(publishDueScheduledPosts()).rejects.toThrow();
        expect(await snapshot()).toEqual(before);
      } finally {
        await conn.query("DROP TRIGGER backend_test_scheduled_failure");
      }
      expect(
        (await publishDueScheduledPosts()).map((row) => row.id).sort(),
      ).toEqual([11201, 11202]);
    });
  },
);
