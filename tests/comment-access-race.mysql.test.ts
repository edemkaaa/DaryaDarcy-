import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { getDb, getUserByOpenId } from "../apps/backend/src/db";
import { appRouter } from "../apps/backend/src/routers";
import type { TrpcContext } from "../apps/backend/src/_core/context";

// Research probe: only owned disposable SQL; no HTTP listener, worker or storage.
describe.skipIf(!testDatabaseUrl)(
  "comment access changes while writes wait",
  () => {
    vi.setConfig({ testTimeout: 20000, hookTimeout: 30000 });
    const owner = 989650,
      neighbor = 989651,
      postId = 989650,
      commentId = 989650;
    let conn: Connection;
    async function cleanup() {
      await conn.query("DELETE FROM club_payments WHERE userId=?", [owner]);
      await conn.query("DELETE FROM admin_audit_log WHERE actorUserId=?", [
        owner,
      ]);
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
        "INSERT INTO users(id,openId,email,role,accountDeletionRequestedAt) VALUES (?,'access-race-owner','owner@example.test','user',DATE_SUB(NOW(),INTERVAL 31 DAY)),(?,'access-race-neighbor',NULL,'user',NULL)",
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
        user: (await getUserByOpenId("access-race-owner"))!,
        req: {} as TrpcContext["req"],
        res: {} as TrpcContext["res"],
      });
    }
    async function state() {
      const [rows] = await conn.query(
        "SELECT id,text FROM post_comments WHERE postId=? ORDER BY id",
        [postId],
      );
      const [likes] = await conn.query(
        "SELECT userId,commentId FROM comment_likes WHERE commentId=?",
        [commentId],
      );
      const [reports] = await conn.query(
        "SELECT reporterUserId,commentId FROM comment_reports WHERE commentId=?",
        [commentId],
      );
      return { rows, likes, reports };
    }
    const operations = ["create", "edit", "delete", "like", "report"] as const;
    const changes = ["private", "draft", "subscription"] as const;
    async function checkRace(
      operation: (typeof operations)[number],
      change: (typeof changes)[number] | "closed",
    ) {
      await conn.query(
        "UPDATE users SET accountDeletionRequestedAt=NULL WHERE id=?",
        [owner],
      );
      if (change === "subscription") {
        await conn.query("UPDATE posts SET target='club' WHERE id=?", [postId]);
        await conn.query(
          "INSERT INTO club_payments(userId,orderId,status,expiresAt) VALUES (?,'comment-access-race-synthetic','paid',DATE_ADD(NOW(),INTERVAL 1 DAY))",
          [owner],
        );
      }
      const current = await caller();
      const before = await state();
      const control = await mysql.createConnection(testDatabaseUrl!);
      let pending: Promise<unknown> | undefined;
      try {
        await control.beginTransaction();
        await control.query("SELECT id FROM users WHERE id=? FOR UPDATE", [
          owner,
        ]);
        switch (operation) {
          case "create":
            pending = current.club.addComment({
              postId,
              text: "Delayed comment",
            });
            break;
          case "edit":
            pending = current.club.updateComment({
              id: commentId,
              text: "Delayed edit",
            });
            break;
          case "delete":
            pending = current.club.deleteComment({ id: commentId });
            break;
          case "like":
            pending = current.club.toggleCommentLike({ commentId });
            break;
          case "report":
            pending = current.club.reportComment({
              id: commentId,
              reason: "Delayed report",
            });
            break;
        }
        void pending.catch(() => {});
        await expect
          .poll(
            async () => {
              const [waiting] = await conn.query<RowDataPacket[]>(
                "SELECT COUNT(*) AS n FROM performance_schema.data_lock_waits w JOIN performance_schema.threads blocker ON blocker.THREAD_ID=w.BLOCKING_THREAD_ID WHERE blocker.PROCESSLIST_ID=?",
                [control.threadId],
              );
              return waiting[0].n;
            },
            { timeout: 5000, interval: 20 },
          )
          .toBeGreaterThan(0);
        if (change === "private")
          await control.query("UPDATE posts SET target='club' WHERE id=?", [
            postId,
          ]);
        if (change === "draft")
          await control.query(
            "UPDATE posts SET published=FALSE,status='draft' WHERE id=?",
            [postId],
          );
        if (change === "subscription")
          await control.query(
            "UPDATE club_payments SET status='failed' WHERE userId=?",
            [owner],
          );
        if (change === "closed")
          await control.query(
            "UPDATE posts SET publishedAt=DATE_SUB(NOW(),INTERVAL 3 DAY) WHERE id=?",
            [postId],
          );
        await control.commit();
        await expect(pending).rejects.toMatchObject({
          code:
            change === "draft"
              ? "NOT_FOUND"
              : change === "closed"
                ? "BAD_REQUEST"
                : "FORBIDDEN",
        });
        expect(await state()).toEqual(before);
      } finally {
        await control.rollback();
        await control.end();
        await pending?.catch(() => {});
      }
    }
    describe.each(operations)("%s", (operation) => {
      it.each(changes)("rechecks %s after the SQL wait", (change) =>
        checkRace(operation, change),
      );
    });
    it("rechecks the comment deadline after the SQL wait", () =>
      checkRace("create", "closed"));
  },
);
