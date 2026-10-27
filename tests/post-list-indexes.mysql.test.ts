import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { assertTestDatabase } from "../tooling/scripts/test-database-policy";

const uri = process.env.POST_LIST_INDEX_DATABASE_URL;
describe.skipIf(!uri)("post listing indexes on a dedicated canonical database", () => {
  let conn: Connection;
  beforeAll(async () => {
    assertTestDatabase(uri!); conn = await mysql.createConnection({ uri: uri!, timezone: "Z" });
    for (let offset = 0; offset < 12000; offset += 500) {
      await conn.query("INSERT INTO posts(text,photos,tags,source,target,sortOrder,publishedAt) VALUES ?", [Array.from({ length: 500 }, (_, i) => [
        "Index fixture", "[]", "[]", "audit-list-index", (offset + i) % 3 === 0 ? "club" : (offset + i) % 3 === 1 ? "feed" : "both",
        (offset + i) % 100, (offset + i) % 7 === 0 ? null : new Date(Date.UTC(2020, 0, 1) + (offset + i) * 60000),
      ])]);
    }
    await conn.query("ANALYZE TABLE posts");
  });
  afterAll(async () => { await conn?.query("DELETE FROM posts WHERE source='audit-list-index'"); await conn?.end(); });
  it.each(["feed", "club"])("provides a usable %s ordering index without changing page contents", async target => {
    const order = `${target === "feed" ? "sortOrder ASC," : ""}CAST(COALESCE(publishedAt,createdAt) AS DATETIME) DESC,id ASC`;
    const query = `SELECT * FROM posts WHERE published=1 AND status='published' AND target IN ('${target}','both') ORDER BY ${order} LIMIT 12`;
    const [plan] = await conn.query<RowDataPacket[]>(`EXPLAIN ${query}`);
    expect(plan[0].key).toBe(`posts_${target}_listing_idx`);
    // Cost-based selection may prefer a filesort. Prove ordered index access is
    // available, but do not force this access path in product queries.
    const forced = query.replace("FROM posts", `FROM posts FORCE INDEX (posts_${target}_listing_idx)`);
    const [orderedPlan] = await conn.query<RowDataPacket[]>(`EXPLAIN ${forced}`);
    expect(orderedPlan[0].Extra).not.toContain("filesort");
    const [indexed] = await conn.query<RowDataPacket[]>(query);
    const [reference] = await conn.query<RowDataPacket[]>(query.replace("CAST(COALESCE(publishedAt,createdAt) AS DATETIME)", "COALESCE(publishedAt,createdAt)"));
    expect(indexed.map(row => row.id)).toEqual(reference.map(row => row.id));
    const baseline = query.replace("FROM posts", "FROM posts IGNORE INDEX (posts_feed_listing_idx,posts_club_listing_idx)");
    const measure = async (statement: string) => {
      await conn.query(statement);
      const start = performance.now(); for (let i = 0; i < 10; i++) await conn.query(statement);
      return (performance.now() - start) / 10;
    };
    console.info("listing measurement", JSON.stringify({ target, plan: plan[0].Extra, baselineMs: await measure(baseline), indexedMs: await measure(query), orderedMs: await measure(forced) }));
  });
  it("retains implicit current timestamps, nullable/backdated dates and updates in both session timezones", async () => {
    for (const tz of ["SYSTEM", "+00:00"]) {
      await conn.query("SET SESSION time_zone=?", [tz]);
      await conn.query("INSERT INTO posts(text,photos,tags,source) VALUES('Implicit current date',JSON_ARRAY(),JSON_ARRAY(),'audit-list-index')");
      await conn.query("UPDATE posts SET publishedAt='2026-10-01',status='draft' WHERE source='audit-list-index' AND text='Implicit current date'");
      await conn.query("UPDATE posts SET publishedAt=NULL,status='published' WHERE source='audit-list-index' AND text='Implicit current date'");
    }
    const [rows] = await conn.query<RowDataPacket[]>("SELECT createdAt,publishedAt FROM posts WHERE source='audit-list-index' AND text='Implicit current date'");
    expect(rows).toHaveLength(2); expect(rows.every(row => row.createdAt instanceof Date && row.publishedAt === null)).toBe(true);
  });
});
