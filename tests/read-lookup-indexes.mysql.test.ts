import { afterAll, beforeAll, describe, expect, it } from "vitest";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { readFile } from "node:fs/promises";
import { assertTestDatabase } from "../tooling/scripts/test-database-policy";

const uri = process.env.READ_INDEX_TEST_DATABASE_URL;
describe.skipIf(!uri)(
  "read indexes on an explicitly empty disposable schema",
  () => {
    let conn: Connection;
    let claimed = false;
    beforeAll(async () => {
      assertTestDatabase(uri!);
      conn = await mysql.createConnection(uri!);
      for (const table of ["likes", "saved_posts", "post_media"]) {
        const [rows] = await conn.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS n FROM ${table}`,
        );
        expect(rows[0].n).toBe(0);
        const [indexes] = await conn.query<RowDataPacket[]>(
          `SHOW INDEX FROM ${table}`,
        );
        expect(
          indexes.filter((row) =>
            /^(likes_user_|saved_posts_user_|post_media_post_order)/.test(
              row.Key_name,
            ),
          ),
        ).toEqual([]);
      }
      claimed = true;
      await conn.query("SET SESSION cte_max_recursion_depth=12000");
      for (const table of ["likes", "saved_posts"])
        await conn.query(
          `INSERT INTO ${table}(userId,postId,createdAt) WITH RECURSIVE seq(i) AS (SELECT 0 UNION ALL SELECT i+1 FROM seq WHERE i<9999) SELECT 945000+MOD(i,1000),MOD(i,50),'2026-01-01' FROM seq`,
        );
      await conn.query(
        "INSERT INTO post_media(postId,type,url,filename,sortOrder) WITH RECURSIVE seq(i) AS (SELECT 0 UNION ALL SELECT i+1 FROM seq WHERE i<9999) SELECT MOD(i,1000),'audio','https://example.test/synthetic','INDEX_AUDIT_00uydl',MOD(i,10) FROM seq",
      );
      for (const table of ["likes", "saved_posts", "post_media"])
        await conn.query(`ANALYZE TABLE ${table}`);
    });
    afterAll(async () => {
      if (!conn) return;
      if (!claimed) {
        await conn.end();
        return;
      }
      for (const table of ["likes", "saved_posts"])
        await conn.query(
          `DELETE FROM ${table} WHERE userId BETWEEN 945000 AND 945999`,
        );
      await conn.query(
        "DELETE FROM post_media WHERE filename='INDEX_AUDIT_00uydl'",
      );
      // Restore the pre-migration fixture: the real migrator must record its own DDL.
      for (const [table, names] of [
        ["likes", ["likes_user_post_lookup"]],
        [
          "saved_posts",
          ["saved_posts_user_created", "saved_posts_user_post_created"],
        ],
        ["post_media", ["post_media_post_order"]],
      ] as const) {
        const [indexes] = await conn.query<RowDataPacket[]>(
          `SHOW INDEX FROM ${table}`,
        );
        for (const name of names)
          if (indexes.some((row) => row.Key_name === name))
            await conn.query(`ALTER TABLE ${table} DROP INDEX ${name}`);
      }
      await conn.end();
    });
    it("reduces examined candidates without changing rows or introducing UNIQUE", async () => {
      const queries = [
        "SELECT postId FROM likes WHERE userId=945777 AND postId IN(27,28)",
        "SELECT postId FROM saved_posts WHERE userId=945777 ORDER BY createdAt DESC",
        "SELECT id,postId FROM post_media WHERE postId=777 ORDER BY sortOrder",
      ];
      const before = [],
        data = [];
      for (const q of queries) {
        before.push((await conn.query<RowDataPacket[]>("EXPLAIN " + q))[0][0]);
        data.push((await conn.query(q))[0]);
      }
      const ddl = await readFile(
        new URL(
          "../packages/database/drizzle/0042_read_lookup_indexes.sql",
          import.meta.url,
        ),
        "utf8",
      ).catch(() => null);
      expect(ddl, "reviewed index migration must exist").not.toBe(null);
      const started = performance.now();
      for (const statement of ddl!.split("--> statement-breakpoint"))
        if (statement.trim()) await conn.query(statement);
      const ddlMs = performance.now() - started,
        after = [];
      for (let i = 0; i < queries.length; i++) {
        after.push(
          (await conn.query<RowDataPacket[]>("EXPLAIN " + queries[i]))[0][0],
        );
        expect((await conn.query(queries[i]))[0]).toEqual(data[i]);
        expect(Number(after[i].rows)).toBeLessThan(Number(before[i].rows));
        expect(Number(after[i].rows)).toBeLessThanOrEqual(20);
      }
      expect(after[0].key).toBe("likes_user_post_lookup");
      expect(after[1].key).toMatch(/^saved_posts_user_/);
      expect(after[2].key).toBe("post_media_post_order");
      for (const table of ["likes", "saved_posts", "post_media"]) {
        const [indexes] = await conn.query<RowDataPacket[]>(
          `SHOW INDEX FROM ${table}`,
        );
        for (const index of indexes.filter((x) =>
          /^(likes_user_|saved_posts_user_|post_media_post_order)/.test(
            x.Key_name,
          ),
        ))
          expect(index.Non_unique).toBe(1);
      }
      process.stdout.write(
        JSON.stringify({
          syntheticRowsPerTable: 10000,
          ddlMs,
          before: before.map((p) => ({ key: p.key, rows: p.rows })),
          after: after.map((p) => ({ key: p.key, rows: p.rows })),
        }) + "\n",
      );
    });
  },
);
