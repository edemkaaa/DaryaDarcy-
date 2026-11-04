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
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { getDb, getUserByOpenId } from "../apps/backend/src/db";
import { appRouter } from "../apps/backend/src/routers";
import type { TrpcContext } from "../apps/backend/src/_core/context";
import { processScheduledAccountDeletions } from "../apps/backend/src/identity/account-retention";

// Research probe: only owned disposable SQL; no HTTP listener, worker or storage.
describe.skipIf(!testDatabaseUrl)(
  "late mutation after real account retirement",
  () => {
    const owner = 987650,
      neighbor = 987651,
      postId = 987650,
      commentId = 987650;
    let conn: Connection;
    async function cleanup() {
      for (const table of ["comment_likes", "comment_reports"])
        await conn.query(`DELETE FROM ${table} WHERE commentId IN (?,?)`, [
          commentId,
          commentId + 1,
        ]);
      await conn.query("DELETE FROM post_comments WHERE postId=?", [postId]);
      for (const table of ["likes", "saved_posts"])
        await conn.query(`DELETE FROM ${table} WHERE postId=?`, [postId]);
      await conn.query("DELETE FROM posts WHERE id=?", [postId]);
      await conn.query("DELETE FROM users WHERE id IN (?,?)", [
        owner,
        neighbor,
      ]);
    }
    beforeAll(async () => {
      conn = await openContentTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("CONTENT_RECOVERY_RETIREMENT_ENABLED", "true");
      vi.stubEnv("PRIVATE_CONTENT_FILES_ENABLED", "false");
    });
    beforeEach(async () => {
      await cleanup();
      await conn.query(
        "INSERT INTO users(id,openId,email,role,accountDeletionRequestedAt) VALUES (?,'late-write-owner','owner@example.test','user',DATE_SUB(NOW(),INTERVAL 31 DAY)),(?,'late-write-neighbor',NULL,'user',NULL)",
        [owner, neighbor],
      );
      await conn.query(
        "INSERT INTO posts(id,text,photos,tags,target,published,status,publishedAt) VALUES (?,'Synthetic discussion',JSON_ARRAY(),JSON_ARRAY('community'),'feed',TRUE,'published',NOW())",
        [postId],
      );
      await conn.query(
        "INSERT INTO post_comments(id,postId,userId,text) VALUES (?,?,?,'Original owner text'),(?,?,?,'Neighbor text')",
        [commentId, postId, owner, commentId + 1, postId, neighbor],
      );
    });
    afterAll(async () => {
      if (conn) await cleanup();
      await conn?.end();
      const database = await getDb();
      await (
        database as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    async function caller() {
      return appRouter.createCaller({
        user: (await getUserByOpenId("late-write-owner"))!,
        req: {} as TrpcContext["req"],
        res: {} as TrpcContext["res"],
      });
    }
    it("allows an ordinary current request before final retirement", async () => {
      const current = await caller();
      expect(
        await current.club.addComment({
          postId,
          text: "Allowed before cleanup",
        }),
      ).toHaveProperty("id");
      expect(await current.feed.toggleLike({ postId })).toBe(true);
    });
    it("uses the current role when moderating a different user's comment", async () => {
      await conn.query("UPDATE users SET role='admin' WHERE id=?", [owner]);
      const captured = await caller();
      await conn.query("UPDATE users SET role='user' WHERE id=?", [owner]);
      await expect(captured.club.deleteComment({ id: commentId + 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
      const [rows] = await conn.query<RowDataPacket[]>("SELECT id FROM post_comments WHERE id=?", [commentId + 1]);
      expect(rows).toHaveLength(1);
    });
    it.each([
      "comment-create",
      "comment-edit",
      "comment-like",
      "comment-report",
      "post-like",
      "post-save",
      "staff-delete",
    ] as const)(
      "rejects a captured pre-retirement context: %s",
      async (operation) => {
        if (operation === "staff-delete")
          await conn.query("UPDATE users SET role='admin' WHERE id=?", [owner]);
        const captured = await caller();
        expect(await processScheduledAccountDeletions()).toBe(1);
        let outcome: unknown;
        try {
          switch (operation) {
            case "comment-create":
              outcome = await captured.club.addComment({
                postId,
                text: "Late private input",
              });
              break;
            case "comment-edit":
              outcome = await captured.club.updateComment({
                id: commentId,
                text: "Late private input",
              });
              break;
            case "comment-like":
              outcome = await captured.club.toggleCommentLike({
                commentId: commentId + 1,
              });
              break;
            case "comment-report":
              outcome = await captured.club.reportComment({
                id: commentId + 1,
                reason: "Late private report",
              });
              break;
            case "post-like":
              outcome = await captured.feed.toggleLike({ postId });
              break;
            case "post-save":
              outcome = await captured.feed.toggleSave({ postId });
              break;
            case "staff-delete":
              outcome = await captured.club.deleteComment({
                id: commentId + 1,
              });
              break;
          }
        } catch (error) {
          outcome = { code: (error as { code?: string }).code };
        }
        const [state] = await conn.query<RowDataPacket[]>(
          "SELECT (SELECT COUNT(*) FROM post_comments WHERE postId=? AND text='Late private input') AS lateText,(SELECT COUNT(*) FROM likes WHERE userId=?) AS likes,(SELECT COUNT(*) FROM saved_posts WHERE userId=?) AS saves,(SELECT COUNT(*) FROM comment_likes WHERE userId=?) AS commentLikes,(SELECT COUNT(*) FROM comment_reports WHERE reporterUserId=?) AS reports,(SELECT COUNT(*) FROM post_comments WHERE id=?) AS neighborComment",
          [postId, owner, owner, owner, owner, commentId + 1],
        );
        expect(state[0]).toMatchObject({ lateText: 0, likes: 0, saves: 0, commentLikes: 0, reports: 0, neighborComment: 1 });
        expect(outcome).toEqual({ code: "UNAUTHORIZED" });
      },
    );
  },
);
