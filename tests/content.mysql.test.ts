import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { getDb, getPosts, getPostsPaginated, getPostsForTarget, getPostsByIds, getLatestPublishedPost } from "../apps/backend/src/db";
import { purgeOldPostComments } from "../apps/backend/src/content/comments";

describe.skipIf(!testDatabaseUrl)("content visibility and retention on disposable MySQL", () => {
  let conn: Connection;
  beforeAll(async () => {
    conn = await openContentTestDatabase();
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
  });
  beforeEach(async () => {
    await conn.query("DELETE FROM post_media WHERE postId BETWEEN 8800 AND 8899");
    await conn.query("DELETE FROM posts WHERE id BETWEEN 8800 AND 8899");
    await conn.query("DELETE FROM comment_likes WHERE commentId BETWEEN 8800 AND 8899");
    await conn.query("DELETE FROM comment_reports WHERE commentId BETWEEN 8800 AND 8899");
    await conn.query("DELETE FROM post_comments WHERE id BETWEEN 8800 AND 8899");
  });
  afterAll(async () => {
    await conn?.end();
    const database = await getDb();
    await (database as unknown as { $client: { end(): Promise<void> } })?.$client.end();
    vi.unstubAllEnvs();
  });
  it("public and club queries exclude scheduled/draft rows even when the legacy published flag is true", async () => {
    await conn.query(`INSERT INTO posts (id,text,photos,tags,status,target) VALUES
      (8801,'public visible',JSON_ARRAY(),JSON_ARRAY(),'published','feed'),
      (8802,'draft secret',JSON_ARRAY(),JSON_ARRAY(),'draft','both'),
      (8803,'scheduled secret',JSON_ARRAY(),JSON_ARRAY(),'scheduled','both'),
      (8804,'club visible',JSON_ARRAY(),JSON_ARRAY(),'published','club')`);
    const ownedIds = (rows: { id: number }[]) => rows.filter(p => p.id >= 8800 && p.id <= 8899).map(p => p.id);
    expect(ownedIds(await getPosts())).toEqual([8801]);
    expect(ownedIds((await getPostsPaginated({ limit: 20 })).posts)).toEqual([8801]);
    expect(ownedIds((await getPostsForTarget("club")).posts)).toEqual([8804]);
    expect((await getPostsByIds([8801, 8802, 8803, 8804])).map(p => p.id)).toEqual([8801, 8804]);
    expect((await getLatestPublishedPost("club"))?.id).toBe(8804);
  });
  it("keeps 100-day-old comments but purges comments older than one year with related records", async () => {
    await conn.query(`INSERT INTO post_comments (id,postId,userId,text,parentId,createdAt) VALUES
      (8830,8801,782,'old parent',NULL,DATE_SUB(NOW(),INTERVAL 366 DAY)),
      (8831,8801,782,'retained',NULL,DATE_SUB(NOW(),INTERVAL 100 DAY)),
      (8832,8801,782,'new reply',8830,DATE_SUB(NOW(),INTERVAL 5 DAY))`);
    await conn.query("INSERT INTO comment_likes (id,userId,commentId) VALUES (8830,782,8830)");
    await conn.query("INSERT INTO comment_reports (id,commentId,reporterUserId,reason) VALUES (8830,8830,782,'report')");
    expect(await purgeOldPostComments()).toBe(1);
    const [rows] = await conn.query<RowDataPacket[]>("SELECT id,parentId FROM post_comments WHERE id BETWEEN 8830 AND 8832 ORDER BY id");
    expect(rows).toEqual([{ id: 8831, parentId: null }, { id: 8832, parentId: null }]);
    const [likes] = await conn.query<RowDataPacket[]>("SELECT id FROM comment_likes WHERE commentId=8830");
    const [reports] = await conn.query<RowDataPacket[]>("SELECT id FROM comment_reports WHERE commentId=8830");
    expect(likes).toEqual([]);
    expect(reports).toEqual([]);
  });
});
