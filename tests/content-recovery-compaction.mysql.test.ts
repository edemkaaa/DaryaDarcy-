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
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";

describe.skipIf(!testDatabaseUrl)(
  "bounded content compaction on owned SQL",
  () => {
    let conn: Connection;
    const key = "d".repeat(64),
      freshKey = "e".repeat(64);
    async function compact(limit = 10) {
      const module =
        await import("../apps/backend/src/content/recovery-compaction");
      expect(module.compactContentRecovery).toBeTypeOf("function");
      return module.compactContentRecovery(drizzle(conn), limit);
    }
    async function rows(query: string, args: unknown[] = []) {
      const [result] = await conn.query<RowDataPacket[]>(query, args);
      return result;
    }
    beforeAll(async () => {
      conn = await openContentTestDatabase();
    });
    beforeEach(async () => {
      vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "true");
      vi.stubEnv("CONTENT_RECOVERY_MAINTENANCE_ENABLED", "true");
      await conn.query(
        "DELETE FROM content_recovery_markers WHERE actorUserId=97540",
      );
      await conn.query(
        "DELETE FROM post_creation_requests WHERE actorUserId=97540",
      );
      await conn.query(
        "DELETE FROM article_creation_requests WHERE actorUserId=97540",
      );
      await conn.query(
        "INSERT INTO post_creation_requests (requestKey,actorUserId,payloadHash,postId,createdAt) VALUES (?,97540,?,97540,DATE_SUB(NOW(),INTERVAL 31 DAY)),(?,97540,?,97541,NOW())",
        [key, "f".repeat(64), freshKey, "f".repeat(64)],
      );
      await conn.query(
        "INSERT INTO article_creation_requests (requestKey,actorUserId,payloadHash,claimToken,articleId,createdAt) VALUES (?,97540,?,'fixture',97540,DATE_SUB(NOW(),INTERVAL 31 DAY))",
        [key, "f".repeat(64)],
      );
    });
    afterAll(async () => {
      if (conn) {
        await conn.query(
          "DELETE FROM content_recovery_markers WHERE actorUserId=97540",
        );
        await conn.query(
          "DELETE FROM post_creation_requests WHERE actorUserId=97540",
        );
        await conn.query(
          "DELETE FROM article_creation_requests WHERE actorUserId=97540",
        );
        await conn.end();
      }
      vi.unstubAllEnvs();
    });
    it("removes old recovery details only after a same-owner minimal marker is committed", async () => {
      expect(await compact()).toEqual({ post: 1, article: 1 });
      expect(
        await rows(
          "SELECT kind,actorUserId FROM content_recovery_markers WHERE actorUserId=97540 ORDER BY kind",
        ),
      ).toEqual([
        { kind: "post", actorUserId: 97540 },
        { kind: "article", actorUserId: 97540 },
      ]);
      expect(
        await rows(
          "SELECT requestKey,postId FROM post_creation_requests WHERE actorUserId=97540",
        ),
      ).toEqual([{ requestKey: freshKey, postId: 97541 }]);
      expect(
        await rows(
          "SELECT articleId FROM article_creation_requests WHERE actorUserId=97540",
        ),
      ).toEqual([]);
      expect(await compact()).toEqual({ post: 0, article: 0 });
    });
    it("does no writes when maintenance is disabled", async () => {
      vi.stubEnv("CONTENT_RECOVERY_MAINTENANCE_ENABLED", "false");
      expect(await compact()).toEqual({ post: 0, article: 0 });
      expect(
        await rows(
          "SELECT kind FROM content_recovery_markers WHERE actorUserId=97540",
        ),
      ).toEqual([]);
      expect(
        await rows(
          "SELECT requestKey FROM post_creation_requests WHERE actorUserId=97540",
        ),
      ).toHaveLength(2);
    });
    it("rolls back detail deletion if marker ownership conflicts", async () => {
      await conn.query(
        "INSERT INTO content_recovery_markers VALUES ('post',?,97541,NOW())",
        [key],
      );
      try {
        await expect(compact()).rejects.toThrow();
        expect(
          await rows(
            "SELECT postId FROM post_creation_requests WHERE requestKey=?",
            [key],
          ),
        ).toEqual([{ postId: 97540 }]);
      } finally {
        await conn.query(
          "DELETE FROM content_recovery_markers WHERE kind='post' AND requestKey=? AND actorUserId=97541",
          [key],
        );
      }
    });
    it("rejects an unbounded batch rather than sweeping journals", async () => {
      await expect(compact(101)).rejects.toThrow();
      expect(
        await rows(
          "SELECT requestKey FROM post_creation_requests WHERE actorUserId=97540",
        ),
      ).toHaveLength(2);
    });
  },
);
