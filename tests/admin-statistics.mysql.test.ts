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
import { drizzle } from "drizzle-orm/mysql2";
import { getPostStatistics } from "../apps/backend/src/content/post-admin-repository";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";

/** Проверяем SQL-агрегаты админки и фактический объём возвращаемых строк на изолированных временных таблицах соединения. */
describe.skipIf(!testDatabaseUrl)(
  "bounded admin statistics on disposable MySQL",
  () => {
    let connection: Connection;
    /** Создаём connection-local копии posts/likes/saved_posts, чтобы TRUNCATE не затрагивал фикстуры параллельных файлов. */
    beforeAll(async () => {
      connection = await openContentTestDatabase();
      // Connection-local shadows cannot delete other suites' fixture rows.
      for (const table of ["posts", "likes", "saved_posts"]) {
        const [rows] = await connection.query<RowDataPacket[]>(
          `SHOW CREATE TABLE ${table}`,
        );
        const ddl = String(rows[0]["Create Table"]).replace(
          /^CREATE TABLE /,
          "CREATE TEMPORARY TABLE ",
        );
        await connection.query(ddl);
      }
    });
    /** Очищаем только временные таблицы и фиксируем Date/TZ для предсказуемых месячных границ. */
    beforeEach(async () => {
      for (const table of ["posts", "likes", "saved_posts"])
        await connection.query(`TRUNCATE TABLE ${table}`);
      vi.stubEnv("TZ", "UTC");
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
    });
    /** Возвращаем часы и окружение, закрывая соединение вместе с его временными таблицами. */
    afterAll(async () => {
      vi.useRealTimers();
      vi.unstubAllEnvs();
      await connection?.end();
    });

    /** На 742 тяжёлых постах сверяем статусы, месяцы, реакции и top5, затем повторяем реальные SELECT для ограничения числа строк и байтов. */
    it("counts a 742-post archive without transferring it into Node", async () => {
      const text = "🌿".repeat(50) + "archive ".repeat(240);
      const fixtures = [
        [1, text, "[]", "[]", "published", "feed", "2026-10-01 00:00:00", 1],
        [2, "draft", "[]", "[]", "draft", "club", "2026-09-30 23:59:59", 1],
        [
          3,
          "scheduled",
          "[]",
          "[]",
          "scheduled",
          "both",
          "2026-09-01 00:00:00",
          1,
        ],
        [
          4,
          "legacy flag",
          "[]",
          "[]",
          "published",
          "club",
          "2026-08-31 23:59:59",
          0,
        ],
        [5, "future", "[]", "[]", "draft", "both", "2030-01-01 00:00:00", 1],
        [6, "today", "[]", "[]", "scheduled", "feed", "2026-10-19 00:00:00", 1],
        ...Array.from({ length: 736 }, (_, i) => [
          i + 7,
          text,
          "[]",
          "[]",
          "published",
          "feed",
          "2026-08-01 00:00:00",
          1,
        ]),
      ];
      await connection.query(
        "INSERT INTO posts (id,text,photos,tags,status,target,createdAt,published) VALUES ?",
        [fixtures],
      );
      await connection.query(
        "INSERT INTO likes (userId,postId) VALUES (1,1),(1,1),(2,1),(3,2),(4,9999999)",
      );
      await connection.query(
        "INSERT INTO saved_posts (userId,postId) VALUES (1,1),(1,1),(2,4)",
      );
      const queries: { query: string; params: unknown[] }[] = [];
      const database = drizzle(connection, {
        logger: {
          /** Сохраняем испущенный SQL и параметры, чтобы независимо проверить реальный объём результата, а не mock query builder. */
          logQuery(query, params) {
            queries.push({ query, params });
          },
        },
      });
      const result = await getPostStatistics(database);
      expect(result).toMatchObject({
        totalPosts: 742,
        publishedPosts: 738,
        scheduledPosts: 2,
        draftPosts: 2,
        feedPosts: 738,
        clubPosts: 2,
        bothPosts: 2,
        totalLikes: 5,
        totalSaves: 3,
        postsThisMonth: 3,
        postsLastMonth: 2,
      });
      expect(result.topLikedPosts).toHaveLength(5);
      expect(result.topLikedPosts[0]).toEqual({
        id: 1,
        text: text.slice(0, 80),
        likeCount: 3,
      });
      expect(result.topLikedPosts[1]).toEqual({
        id: 2,
        text: "draft",
        likeCount: 1,
      });
      // Replay the exact emitted SELECTs against unchanged, connection-local data.
      // A return to SELECT-all fails on real MySQL rows, not a mocked query builder.
      const rowCounts: number[] = [];
      let transferredBytes = 0;
      for (const { query, params } of queries) {
        const [rows] = await connection.query<RowDataPacket[]>(query, params);
        rowCounts.push(rows.length);
        transferredBytes += Buffer.byteLength(JSON.stringify(rows));
      }
      expect(Math.max(...rowCounts)).toBeLessThanOrEqual(5);
      expect(transferredBytes).toBeLessThan(64 * 1024);
    });

    /** Пустой архив возвращает нули и пустой top, без отсутствующих агрегатов. */
    it("keeps zero counters and no leaders for an empty archive", async () => {
      expect(await getPostStatistics(drizzle(connection))).toEqual({
        totalPosts: 0,
        publishedPosts: 0,
        scheduledPosts: 0,
        draftPosts: 0,
        feedPosts: 0,
        clubPosts: 0,
        bothPosts: 0,
        totalLikes: 0,
        totalSaves: 0,
        postsThisMonth: 0,
        postsLastMonth: 0,
        topLikedPosts: [],
      });
    });

    /** Московская граница месяца разделяет соседние UTC-метки по часовому поясу процесса, сохраняя прежний контракт. */
    it("keeps the process-local month boundary rather than UTC date truncation", async () => {
      vi.stubEnv("TZ", "Europe/Moscow");
      await connection.query(
        "INSERT INTO posts (id,text,photos,tags,createdAt) VALUES (1,'September in Moscow',JSON_ARRAY(),JSON_ARRAY(),'2026-09-30 20:59:59'),(2,'October in Moscow',JSON_ARRAY(),JSON_ARRAY(),'2026-09-30 21:00:00')",
      );
      expect(await getPostStatistics(drizzle(connection))).toMatchObject({
        totalPosts: 2,
        postsThisMonth: 1,
        postsLastMonth: 1,
      });
    });
  },
);
