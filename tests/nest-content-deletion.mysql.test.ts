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
import type { Connection, RowDataPacket } from "mysql2/promise";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { getDb } from "../apps/backend/src/db";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import type { AppRouter } from "../apps/backend/src/routers";

// Real native composition, HTTP, JWT and SQL; no storage/network delivery.
describe.skipIf(!testDatabaseUrl)(
  "admin content deletion over HTTP/JWT/MySQL",
  () => {
    let conn: Connection, app: INestApplication, base: string;
    beforeAll(async () => {
      conn = await openContentTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "delete-content-synthetic-secret-32");
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    });
    async function cleanup() {
      await conn.query("DROP TRIGGER IF EXISTS content_delete_refusal");
      await conn.query("DELETE FROM comment_reports WHERE reporterUserId=8470");
      await conn.query("DELETE FROM comment_likes WHERE userId=8470");
      await conn.query(
        "DELETE FROM post_comments WHERE id BETWEEN 8470 AND 8472",
      );
      await conn.query("DELETE FROM likes WHERE userId=8470");
      await conn.query("DELETE FROM saved_posts WHERE userId=8470");
      await conn.query("DELETE FROM post_media WHERE id BETWEEN 8470 AND 8472");
      await conn.query("DELETE FROM posts WHERE id IN (8470,8471)");
      await conn.query("DELETE FROM users WHERE id IN (8470,8471)");
    }
    beforeEach(async () => {
      await cleanup();
      await conn.query(
        "INSERT INTO users (id,openId,role,sessionVersion) VALUES (8470,'delete-content-admin','admin',0),(8471,'delete-content-member','user',0)",
      );
      await conn.query(
        "INSERT INTO posts (id,text,photos,tags) VALUES (8470,'Delete target',JSON_ARRAY(),JSON_ARRAY()),(8471,'Keep neighbor',JSON_ARRAY(),JSON_ARRAY())",
      );
      await conn.query(
        "INSERT INTO post_media (id,postId,type,url,filename,mimeType,fileSize) VALUES (8470,8470,'document','https://example.invalid/target.pdf','Target.pdf','application/pdf',42),(8471,8470,'audio','https://example.invalid/target.mp3','Target.mp3','audio/mpeg',12),(8472,8471,'document','https://example.invalid/keep.pdf','Keep.pdf','application/pdf',84)",
      );
      await conn.query(
        "INSERT INTO post_comments (id,postId,parentId,userId,text) VALUES (8470,8470,NULL,8470,'Root'),(8471,8470,8470,8470,'Reply'),(8472,8471,8470,8470,'Cross-post legacy reply')",
      );
      await conn.query(
        "INSERT INTO comment_likes (userId,commentId) VALUES (8470,8470),(8470,8472)",
      );
      await conn.query(
        "INSERT INTO comment_reports (commentId,reporterUserId,reason) VALUES (8471,8470,'Target report'),(8472,8470,'Keep report')",
      );
      await conn.query(
        "INSERT INTO likes (userId,postId) VALUES (8470,8470),(8470,8471)",
      );
      await conn.query(
        "INSERT INTO saved_posts (userId,postId) VALUES (8470,8470),(8470,8471)",
      );
    });
    afterEach(async () => {
      await conn.query("DROP TRIGGER IF EXISTS content_delete_refusal");
    });
    afterAll(async () => {
      await app?.close();
      if (conn) {
        await cleanup();
        await conn.end();
      }
      await (
        (await getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    function client(actor: "admin" | "member" | null = "admin") {
      return createTRPCProxyClient<AppRouter>({
        links: [
          httpLink({
            url: `${base}/api/trpc`,
            transformer: superjson,
            headers: async () =>
              actor
                ? {
                    Authorization: `Bearer ${await sdk.createSessionToken(`delete-content-${actor}`, { sessionVersion: 0 })}`,
                  }
                : {},
          }),
        ],
      });
    }
    async function snapshot() {
      const queries = {
        posts: "SELECT id,text FROM posts WHERE id IN (8470,8471) ORDER BY id",
        media:
          "SELECT id,postId,url,filename,mimeType,fileSize FROM post_media WHERE id BETWEEN 8470 AND 8472 ORDER BY id",
        comments:
          "SELECT id,postId,parentId,text FROM post_comments WHERE id BETWEEN 8470 AND 8472 ORDER BY id",
        commentLikes:
          "SELECT userId,commentId FROM comment_likes WHERE userId=8470 ORDER BY commentId",
        reports:
          "SELECT commentId,reason FROM comment_reports WHERE reporterUserId=8470 ORDER BY commentId",
        likes: "SELECT postId FROM likes WHERE userId=8470 ORDER BY postId",
        saves:
          "SELECT postId FROM saved_posts WHERE userId=8470 ORDER BY postId",
      };
      const result: Record<string, RowDataPacket[]> = {};
      for (const [key, sql] of Object.entries(queries))
        [result[key]] = await conn.query<RowDataPacket[]>(sql);
      return result;
    }
    it("deletes the requested post's dependents and detaches a surviving legacy reply", async () => {
      const before = await snapshot();
      expect(
        await client().admin.deletePost.mutate({ id: 8470 }),
      ).toBeUndefined();
      expect(await snapshot()).toEqual({
        posts: [before.posts[1]],
        media: [before.media[2]],
        comments: [
          {
            id: 8472,
            postId: 8471,
            parentId: null,
            text: "Cross-post legacy reply",
          },
        ],
        commentLikes: [{ userId: 8470, commentId: 8472 }],
        reports: [{ commentId: 8472, reason: "Keep report" }],
        likes: [{ postId: 8471 }],
        saves: [{ postId: 8471 }],
      });
    });
    it("rolls back every dependent and parent detachment when final post deletion fails", async () => {
      const before = await snapshot();
      await conn.query(`CREATE TRIGGER content_delete_refusal BEFORE DELETE ON posts FOR EACH ROW
      BEGIN IF OLD.id=8470 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic private deletion failure'; END IF; END`);
      await expect(
        client().admin.deletePost.mutate({ id: 8470 }),
      ).rejects.toMatchObject({
        message: "Внутренняя ошибка сервера",
        data: { httpStatus: 500 },
      });
      expect(await snapshot()).toEqual(before);
    });
    it("deletes only one attachment while retaining posts, other media and reactions", async () => {
      const before = await snapshot();
      expect(
        await client().admin.deleteMedia.mutate({ id: 8470 }),
      ).toBeUndefined();
      expect(await snapshot()).toEqual({
        ...before,
        media: before.media.slice(1),
      });
    });
    it.each(["deletePost", "deleteMedia"] as const)(
      "%s retains the missing-ID no-op",
      async (operation) => {
        const before = await snapshot();
        expect(
          await client().admin[operation].mutate({ id: 8479 }),
        ).toBeUndefined();
        expect(await snapshot()).toEqual(before);
      },
    );
    it.each([
      [null, "deletePost"],
      [null, "deleteMedia"],
      ["member", "deletePost"],
      ["member", "deleteMedia"],
    ] as const)(
      "refuses %s/%s without content mutation",
      async (actor, operation) => {
        const before = await snapshot();
        await expect(
          client(actor).admin[operation].mutate({ id: 8470 }),
        ).rejects.toMatchObject({ data: { httpStatus: actor ? 403 : 401 } });
        expect(await snapshot()).toEqual(before);
      },
    );
  },
);
