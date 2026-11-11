import { beforeAll, afterAll, describe, expect, it } from "vitest";
import mysql, { type Connection } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import {
  inspectLoad,
  seedLoad,
  rows,
} from "../tooling/scripts/api-load-fixture";
import { getPostsForTarget } from "../apps/backend/src/content/post-catalog-repository";

const uri = process.env.COUNT_INDEX_DATABASE_URL;
const id = process.env.COUNT_INDEX_CONTAINER_ID;
// Removing either count index must turn this real optimizer-access test RED.
/** Проверяет реальный план MySQL для covering count-индексов и сохранение прежних подсчётов реакций. */
describe.skipIf(!uri || !id)(
  "content count indexes on owned native SQL",
  () => {
    let conn: Connection;
    /** Проверяет владение нагрузочной БД и контейнером; при пустой схеме создаёт синтетические посты и дубли лайков. */
    beforeAll(async () => {
      await inspectLoad(uri!, id!);
      conn = await mysql.createConnection({ uri: uri!, timezone: "Z" });
      if (!(await rows(conn, "SELECT id FROM users")).length) {
        await seedLoad(conn);
        await conn.query("INSERT INTO likes(userId,postId) VALUES ?", [
          Array.from({ length: 1000 }, (_, i) => [
            1 + (i % 50),
            2 + 2 * (i % 50),
          ]),
        ]);
      }
    });
    /** Закрывает контрольное соединение, не удаляя нагрузочный датасет. */
    afterAll(async () => {
      await conn?.end();
    });
    /** EXPLAIN должен выбирать ref и Using index с postId первым столбцом, а не сканировать всю таблицу. */
    it.each(["likes", "post_comments"])(
      "uses a covering lookup for %s instead of scanning the table",
      async (table) => {
        const plan = await rows(
          conn,
          `EXPLAIN SELECT COUNT(*) FROM ${table} WHERE postId=2`,
        );
        expect(plan[0]?.type).toBe("ref");
        expect(plan[0]?.Extra).toContain("Using index");
        const indexes = await rows(conn, `SHOW INDEX FROM ${table}`);
        expect(
          indexes.some(
            (row) =>
              row.Column_name === "postId" &&
              row.Seq_in_index === 1 &&
              row.Non_unique === 1,
          ),
        ).toBe(true);
        expect(
          indexes
            .filter((row) => row.Key_name === plan[0]?.key)
            .map((row) => row.Column_name),
        ).toEqual(table === "likes" ? ["postId"] : ["postId", "createdAt"]);
      },
    );
    /** Проекции feed и club сохраняют точные counts, включая исторические дубли лайков без очистки исходных строк. */
    it("preserves exact public/club counts and historical duplicate-like semantics", async () => {
      const db = drizzle(conn);
      const page = await getPostsForTarget(db, "club", { limit: 1 });
      expect(page.posts[0]?.id).toBe(2);
      expect(Number(page.posts[0]?.likeCount)).toBe(20);
      expect(
        Number((page.posts[0] as { commentCount?: number })?.commentCount),
      ).toBe(500);
      const publicPage = await getPostsForTarget(db, "feed", { limit: 1 });
      expect(publicPage.posts[0]?.id).toBe(1);
      expect(Number(publicPage.posts[0]?.likeCount)).toBe(0);
      expect(
        Number(
          (publicPage.posts[0] as { commentCount?: number })?.commentCount,
        ),
      ).toBe(0);
      expect((await rows(conn, "SELECT COUNT(*) AS n FROM likes"))[0]?.n).toBe(
        1000,
      );
    });
  },
);
