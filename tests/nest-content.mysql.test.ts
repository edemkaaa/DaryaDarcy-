import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import type { Connection } from "mysql2/promise";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import type { AppRouter } from "../apps/backend/src/routers";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb, getPostById, getPostsForTarget } from "../apps/backend/src/db";

describe.skipIf(!testDatabaseUrl)(
  "native content reads over real HTTP/JWT/MySQL",
  () => {
    let application: INestApplication,
      conn: Connection,
      base: string,
      bearer: string;
    beforeAll(async () => {
      conn = await openContentTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "native-content-fixture-secret-32-characters");
      vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
      await conn.query(`CREATE TABLE IF NOT EXISTS articles (
        id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255) NOT NULL, coverUrl TEXT,
        access ENUM('public','club') NOT NULL DEFAULT 'public', published BOOLEAN NOT NULL DEFAULT TRUE,
        sortOrder INT NOT NULL DEFAULT 0, sections JSON NOT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB`);
      await conn.query(`INSERT INTO articles (id,title,access,published,sections) VALUES
        (8970,'public article','public',TRUE,JSON_ARRAY(JSON_OBJECT('type','text','text','public article body'))),
        (8971,'club article','club',TRUE,JSON_ARRAY(JSON_OBJECT('type','text','text','club article body'))),
        (8972,'hidden article','public',FALSE,JSON_ARRAY(JSON_OBJECT('type','text','text','hidden article body')))`);
      await conn.query(
        "INSERT INTO users (id,openId,role) VALUES (8970,'native-content-reader','user')",
      );
      await conn.query(
        "INSERT INTO club_payments (userId,orderId,status,expiresAt) VALUES (8970,'native-content-subscription','paid',DATE_ADD(NOW(),INTERVAL 1 DAY))",
      );
      await conn.query(`INSERT INTO posts (id,text,photos,tags,target,status,published) VALUES
      (8970,'public body',JSON_ARRAY(),JSON_ARRAY(),'feed','published',TRUE),
      (8971,'club body',JSON_ARRAY(),JSON_ARRAY(),'club','published',TRUE),
      (8972,'draft body',JSON_ARRAY(),JSON_ARRAY(),'both','draft',TRUE),
      (8973,'scheduled body',JSON_ARRAY(),JSON_ARRAY(),'both','scheduled',TRUE),
      (8974,'hidden body',JSON_ARRAY(),JSON_ARRAY(),'feed','published',FALSE)`);
      await conn.query(
        "INSERT INTO post_media (id,postId,type,url) VALUES (8970,8971,'document','https://assets.example.test/club-fixture.pdf')",
      );
      await conn.query(`CREATE TABLE IF NOT EXISTS tags (
        id INT AUTO_INCREMENT PRIMARY KEY,slug VARCHAR(64) NOT NULL UNIQUE,
        label VARCHAR(128) NOT NULL,category ENUM('season','topic') NOT NULL DEFAULT 'topic',
        sortOrder INT NOT NULL DEFAULT 0
      ) ENGINE=InnoDB`);
      await conn.query(`INSERT INTO tags (id,slug,label,category,sortOrder) VALUES
        (8975,'native-catalog','Catalog','topic',2),
        (8976,'native-season','Season','season',1)`);
      await conn.query(
        "UPDATE posts SET tags=JSON_ARRAY('native-catalog') WHERE id BETWEEN 8971 AND 8974",
      );
      const catalog = Array.from({ length: 13 }, (_, index) => [
        8975 + index,
        index === 12 ? "Last tea needle" : `Coffee item ${index}`,
        "[]",
        '["native-catalog"]',
        index === 0 ? "both" : "feed",
        -100 + index,
      ]);
      await conn.query(
        "INSERT INTO posts (id,text,photos,tags,target,sortOrder) VALUES ?",
        [catalog],
      );
      await conn.query(`INSERT INTO post_media (id,postId,type,url,sortOrder) VALUES
        (8975,8975,'document','https://assets.example.test/catalog.pdf',1),
        (8976,8975,'audio','https://assets.example.test/catalog.mp3',0)`);
      application = await createBackendApplication();
      await application.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
      bearer = await sdk.createSessionToken("native-content-reader", {
        sessionVersion: 0,
      });
    });
    beforeEach(async () => {
      await conn.query(
        "UPDATE users SET role='user',blockedAt=NULL,sessionVersion=0 WHERE id=8970",
      );
      await conn.query(
        "UPDATE club_payments SET status='paid',expiresAt=DATE_ADD(NOW(),INTERVAL 1 DAY) WHERE orderId='native-content-subscription'",
      );
      await conn.query("DELETE FROM saved_posts WHERE userId=8970");
      await conn.query("DELETE FROM likes WHERE userId=8970");
    });
    afterAll(async () => {
      await application?.close();
      await conn?.query("DELETE FROM saved_posts WHERE userId=8970");
      await conn?.query("DELETE FROM likes WHERE userId=8970");
      await conn?.query("DELETE FROM post_comments WHERE id=8975");
      await conn?.query("DELETE FROM post_media WHERE id IN (8970,8975,8976)");
      await conn?.query("DELETE FROM posts WHERE id BETWEEN 8970 AND 8987");
      await conn?.query("DELETE FROM tags WHERE id IN (8975,8976)");
      await conn?.query(
        "DELETE FROM club_payments WHERE orderId='native-content-subscription'",
      );
      await conn?.query("DELETE FROM users WHERE id=8970");
      await conn?.query("DELETE FROM articles WHERE id BETWEEN 8970 AND 8972");
      await conn?.end();
      await (
        (await getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    const client = (token?: string) =>
      createTRPCProxyClient<AppRouter>({
        links: [
          httpLink({
            url: base + "/api/trpc",
            transformer: superjson,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }),
        ],
      });
    it("keeps public detail visible while hiding club body from anonymous readers", async () => {
      expect(await client().feed.getById.query({ id: 8970 })).toMatchObject({
        id: 8970,
        text: "public body",
      });
      expect(await client().feed.getById.query({ id: 8971 })).toBeUndefined();
    });
    it("keeps private row lookup separate from public visibility", async () => {
      for (const fixture of [
        { id: 8972, text: "draft body", status: "draft", published: true },
        {
          id: 8974,
          text: "hidden body",
          status: "published",
          published: false,
        },
      ]) {
        expect(await getPostById(fixture.id)).toMatchObject(fixture);
        expect(
          await client(bearer).feed.getById.query({ id: fixture.id }),
        ).toBeUndefined();
      }
    });
    it("does not return a neighboring post for a missing ID", async () => {
      expect(await getPostById(999999)).toBeUndefined();
      expect(
        await client(bearer).feed.getById.query({ id: 999999 }),
      ).toBeUndefined();
    });
    it("returns ordered audio, document and video metadata on public post detail", async () => {
      await conn.query(
        "INSERT INTO post_media (id,postId,type,url,filename,mimeType,fileSize,duration,sortOrder) VALUES (8977,8975,'video','https://assets.example.test/detail.mp4','detail.mp4','video/mp4',1234,17,2)",
      );
      try {
        expect(await client().feed.getById.query({ id: 8975 })).toMatchObject({
          id: 8975,
          media: [
            {
              id: 8976,
              postId: 8975,
              type: "audio",
              url: "https://assets.example.test/catalog.mp3",
            },
            {
              id: 8975,
              postId: 8975,
              type: "document",
              url: "https://assets.example.test/catalog.pdf",
            },
            {
              id: 8977,
              postId: 8975,
              type: "video",
              url: "https://assets.example.test/detail.mp4",
              filename: "detail.mp4",
              mimeType: "video/mp4",
              fileSize: 1234,
              duration: 17,
              sortOrder: 2,
            },
          ],
        });
      } finally {
        await conn.query(
          "DELETE FROM post_media WHERE id=8977 AND postId=8975",
        );
      }
    });
    it("does not attach another post's files to an empty post in detail or batch reads", async () => {
      expect(await client().feed.getById.query({ id: 8976 })).toMatchObject({
        id: 8976,
        media: [],
      });
      const page = await client().feed.list.query({ tag: "native-catalog" });
      expect(page.find((row) => row.id === 8976)).toMatchObject({
        id: 8976,
        media: [],
      });
    });
    it.each([
      { limit: 1.5 },
      { limit: 12, cursor: -1 },
      { limit: 12, cursor: 0.5 },
      { limit: 12, cursor: Number.MAX_SAFE_INTEGER + 1 },
    ])("rejects invalid pagination before SQL (%#)", async (input) => {
      await expect(
        client().feed.listPaginated.query(input),
      ).rejects.toMatchObject({
        data: { code: "BAD_REQUEST", httpStatus: 400 },
      });
    });
    it("lists only public feed/both posts, retaining order and media without paid or hidden bodies", async () => {
      const expected = [
        8975, 8976, 8977, 8978, 8979, 8980, 8981, 8982, 8983, 8984, 8985, 8986,
        8987,
      ];
      const rows = await client().feed.list.query({ tag: "native-catalog" });
      expect(rows.map((post) => post.id)).toEqual(expected);
      expect(rows[0].media.map((media) => media.url)).toEqual([
        "https://assets.example.test/catalog.mp3",
        "https://assets.example.test/catalog.pdf",
      ]);
      for (const input of [undefined, { tag: "all" }]) {
        const all = await client().feed.list.query(input);
        expect(
          all
            .filter((post) => post.id >= 8970 && post.id <= 8987)
            .map((post) => post.id),
        ).toEqual([...expected, 8970]);
      }
      expect(await client().feed.list.query({ tag: "native-missing" })).toEqual(
        [],
      );
    });
    it("counts each post's own likes in the legacy feed without adding comment counts", async () => {
      await conn.query(
        "INSERT INTO likes (userId,postId) VALUES (8970,8970),(8970,8975)",
      );
      const rows = await client().feed.list.query();
      for (const id of [8970, 8975]) {
        const post = rows.find((row) => row.id === id);
        expect(post).toMatchObject({ id, likeCount: 1 });
        expect(post).not.toHaveProperty("commentCount");
      }
      expect(rows.find((row) => row.id === 8976)).toMatchObject({
        id: 8976,
        likeCount: 0,
        media: [],
      });
    });
    it("matches whole tags in the legacy feed and retains only the matching post's media", async () => {
      await conn.query(
        "UPDATE posts SET tags=JSON_ARRAY('native-catalog','native-season') WHERE id=8975",
      );
      await conn.query(
        "UPDATE posts SET tags=JSON_ARRAY('native-seasonal') WHERE id=8976",
      );
      try {
        const rows = await client().feed.list.query({ tag: "native-season" });
        expect(rows.map((row) => row.id)).toEqual([8975]);
        expect(rows[0].media.map((media) => media.url)).toEqual([
          "https://assets.example.test/catalog.mp3",
          "https://assets.example.test/catalog.pdf",
        ]);
        for (const tag of [
          "native-sea",
          "NATIVE-SEASON",
          " native-season ",
          "' OR 1=1 --",
        ]) {
          expect(await client().feed.list.query({ tag })).toEqual([]);
        }
      } finally {
        await conn.query(
          "UPDATE posts SET tags=JSON_ARRAY('native-catalog') WHERE id IN (8975,8976)",
        );
      }
    });
    it.each([
      { limit: 1.5 },
      { limit: 20, cursor: -1 },
      { limit: 20, cursor: 0.5 },
      { limit: 20, cursor: Number.MAX_SAFE_INTEGER + 1 },
    ])("rejects invalid club pagination before SQL (%#)", async (input) => {
      await expect(client(bearer).club.list.query(input)).rejects.toMatchObject(
        {
          data: { code: "BAD_REQUEST", httpStatus: 400 },
        },
      );
    });
    it("preserves club pagination defaults, null cursor, upper limit and visibility", async () => {
      const first = await client(bearer).club.list.query({
        tag: "native-catalog",
      });
      expect(first.posts.map((post) => post.id)).toEqual([8975, 8971]);
      expect(first.nextCursor).toBeNull();
      for (const input of [
        { tag: "native-catalog", cursor: null },
        { tag: "native-catalog", limit: 200 },
      ]) {
        expect(await client(bearer).club.list.query(input)).toEqual(first);
      }
      const page = await client(bearer).club.list.query({
        tag: "native-catalog",
        limit: 1,
      });
      expect(page.posts.map((post) => post.id)).toEqual([8975]);
      expect(page.nextCursor).toBe(1);
      const last = await client(bearer).club.list.query({
        tag: "native-catalog",
        limit: 1,
        cursor: 1,
      });
      expect(last.posts.map((post) => post.id)).toEqual([8971]);
      expect(last.nextCursor).toBeNull();
      expect(
        (await client(bearer).club.list.query()).posts.length,
      ).toBeLessThanOrEqual(20);
      await expect(client().club.list.query()).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED", httpStatus: 401 },
      });
    });
    it("intersects club visibility with tags and trimmed search before pagination", async () => {
      // Search is an existing repository option, not a club.list HTTP field.
      const body = await getPostsForTarget("club", {
        tagFilter: "native-catalog",
        search: "  CLUB BODY  ",
        limit: 1,
      });
      expect(body.posts.map((post) => post.id)).toEqual([8971]);
      expect(body.nextCursor).toBeNull();
      for (const input of [
        { tagFilter: "native-missing", search: "club body" },
        { tagFilter: "native-catalog", search: "' OR 1=1 --" },
      ]) {
        expect(await getPostsForTarget("club", input)).toEqual({
          posts: [],
          nextCursor: null,
        });
      }
    });
    it("paginates filtered rows with default 12 and treats null cursor as the first page", async () => {
      const first = await client().feed.listPaginated.query({
        tag: "native-catalog",
      });
      expect(first.posts.map((post) => post.id)).toEqual([
        8975, 8976, 8977, 8978, 8979, 8980, 8981, 8982, 8983, 8984, 8985, 8986,
      ]);
      expect(first.nextCursor).toBe(12);
      expect(
        await client().feed.listPaginated.query({
          tag: "native-catalog",
          cursor: null,
        }),
      ).toEqual(first);
      const last = await client().feed.listPaginated.query({
        tag: "native-catalog",
        cursor: 12,
      });
      expect(last.posts.map((post) => post.id)).toEqual([8987]);
      expect(last.nextCursor).toBeNull();
      expect(
        await client().feed.listPaginated.query({
          tag: "native-catalog",
          cursor: 13,
        }),
      ).toEqual({ posts: [], nextCursor: null });
    });
    it("combines tags and trimmed case-insensitive search using bound SQL values", async () => {
      const coffee = await client().feed.listPaginated.query({
        tag: "native-catalog",
        search: "  COFFEE  ",
        limit: 50,
      });
      expect(coffee.posts.map((post) => post.id)).toEqual([
        8975, 8976, 8977, 8978, 8979, 8980, 8981, 8982, 8983, 8984, 8985, 8986,
      ]);
      expect(coffee.nextCursor).toBeNull();
      const needle = await client().feed.listPaginated.query({
        tag: "native-catalog",
        search: "needle",
        limit: 1,
      });
      expect(needle.posts.map((post) => post.id)).toEqual([8987]);
      expect(needle.nextCursor).toBeNull();
      for (const filter of [
        { search: "' OR 1=1 --" },
        { tag: "' OR 1=1 --" },
      ]) {
        expect(
          await client().feed.listPaginated.query({ ...filter, limit: 50 }),
        ).toEqual({ posts: [], nextCursor: null });
      }
    });
    it("preserves feed like/comment counts and ordered attachments in paginated replies", async () => {
      await conn.query("INSERT INTO likes (userId,postId) VALUES (8970,8975)");
      await conn.query(
        "INSERT INTO post_comments (id,postId,userId,text) VALUES (8975,8975,8970,'catalog comment')",
      );
      const page = await client().feed.listPaginated.query({
        tag: "native-catalog",
        limit: 1,
      });
      expect(page.nextCursor).toBe(1);
      expect(page.posts[0]).toMatchObject({
        id: 8975,
        likeCount: 1,
        commentCount: 1,
      });
      expect(page.posts[0].media.map((media) => media.url)).toEqual([
        "https://assets.example.test/catalog.mp3",
        "https://assets.example.test/catalog.pdf",
      ]);
    });
    it("returns reference tags in display order without changing the public fields", async () => {
      const tags = (await client().feed.tags.query()).filter(
        (tag) => tag.id === 8975 || tag.id === 8976,
      );
      expect(tags).toEqual([
        {
          id: 8976,
          slug: "native-season",
          label: "Season",
          category: "season",
          sortOrder: 1,
        },
        {
          id: 8975,
          slug: "native-catalog",
          label: "Catalog",
          category: "topic",
          sortOrder: 2,
        },
      ]);
    });
    it.each([8972, 8973, 8974])(
      "hides non-published detail %s even from a subscribed administrator",
      async (id) => {
        await conn.query("UPDATE users SET role='admin' WHERE id=8970");
        expect(await client(bearer).feed.getById.query({ id })).toBeUndefined();
      },
    );
    it("rechecks subscription expiry and live staff roles with the same JWT", async () => {
      expect(
        await client(bearer).feed.getById.query({ id: 8971 }),
      ).toMatchObject({ text: "club body" });
      await conn.query(
        "UPDATE club_payments SET expiresAt='2020-01-01' WHERE orderId='native-content-subscription'",
      );
      expect(
        await client(bearer).feed.getById.query({ id: 8971 }),
      ).toBeUndefined();
      for (const role of ["moderator", "admin"]) {
        await conn.query("UPDATE users SET role=? WHERE id=8970", [role]);
        expect(
          await client(bearer).feed.getById.query({ id: 8971 }),
        ).toMatchObject({ text: "club body" });
      }
      await conn.query("UPDATE users SET role='user' WHERE id=8970");
      expect(
        await client(bearer).feed.getById.query({ id: 8971 }),
      ).toBeUndefined();
    });
    it("preserves bookmark order but removes unpaid club body and attachments", async () => {
      await conn.query(
        "INSERT INTO saved_posts (userId,postId,createdAt) VALUES (8970,8970,'2036-01-01'),(8970,8971,'2036-01-02'),(8970,8972,'2036-01-03')",
      );
      const saved = await client(bearer).feed.savedPosts.query();
      expect(saved.map((post) => post.id)).toEqual([8971, 8970]);
      expect(saved[0].media).toMatchObject([
        { url: "https://assets.example.test/club-fixture.pdf" },
      ]);
      await conn.query(
        "UPDATE club_payments SET expiresAt='2020-01-01' WHERE orderId='native-content-subscription'",
      );
      expect(
        (await client(bearer).feed.savedPosts.query()).map((post) => post.id),
      ).toEqual([8970]);
    });
    it("preserves duplicate bookmark positions while omitting missing and unpublished rows", async () => {
      await conn.query(
        "INSERT INTO saved_posts (userId,postId,createdAt) VALUES (8970,8970,'2036-01-01'),(8970,8975,'2036-01-02'),(8970,8971,'2036-01-03'),(8970,8975,'2036-01-04'),(8970,8972,'2036-01-05'),(8970,8974,'2036-01-06'),(8970,999999,'2036-01-07')",
      );
      const saved = await client(bearer).feed.savedPosts.query();
      expect(saved.map((post) => post.id)).toEqual([8975, 8971, 8975, 8970]);
      for (const index of [0, 2]) {
        expect(saved[index].media.map((media) => media.url)).toEqual([
          "https://assets.example.test/catalog.mp3",
          "https://assets.example.test/catalog.pdf",
        ]);
      }
      expect(saved[1].media).toMatchObject([
        { url: "https://assets.example.test/club-fixture.pdf" },
      ]);
      expect(saved[3].media).toEqual([]);
    });
    it.each(["blockedAt=NOW()", "sessionVersion=1"])(
      "denies club and protected reads after %s",
      async (patch) => {
        await conn.query(`UPDATE users SET ${patch} WHERE id=8970`);
        expect(
          await client(bearer).feed.getById.query({ id: 8971 }),
        ).toBeUndefined();
        await expect(
          client(bearer).feed.savedPosts.query(),
        ).rejects.toMatchObject({
          data: { code: "UNAUTHORIZED", httpStatus: 401 },
        });
      },
    );
    it("aggregates only the authenticated reader's saved and liked IDs", async () => {
      await conn.query(
        "INSERT INTO saved_posts (userId,postId) VALUES (8970,8971)",
      );
      await conn.query("INSERT INTO likes (userId,postId) VALUES (8970,8970)");
      expect(await client(bearer).feed.userInteractions.query()).toEqual({
        likedIds: [8970],
        savedIds: [8971],
      });
      await expect(
        client().feed.userInteractions.query(),
      ).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED", httpStatus: 401 },
      });
    });
    it("lists only public article summaries, never paid sections", async () => {
      const rows = (await client().articles.list.query()).filter(
        (article) => article.id >= 8970 && article.id <= 8972,
      );
      expect(rows).toEqual([
        { id: 8970, title: "public article", coverUrl: null, access: "public" },
      ]);
    });
    it("serves public article sections but only an allowlisted locked club preview to anonymous readers", async () => {
      expect(await client().articles.getById.query({ id: 8970 })).toEqual({
        id: 8970,
        title: "public article",
        coverUrl: null,
        access: "public",
        locked: false,
        sections: [{ type: "text", text: "public article body" }],
      });
      expect(await client().articles.getById.query({ id: 8971 })).toEqual({
        id: 8971,
        title: "club article",
        coverUrl: null,
        access: "club",
        locked: true,
        sections: [],
      });
    });
    it("relocks article sections immediately after subscription expiry with the same JWT", async () => {
      expect(
        await client(bearer).articles.getById.query({ id: 8971 }),
      ).toMatchObject({
        locked: false,
        sections: [{ type: "text", text: "club article body" }],
      });
      await conn.query(
        "UPDATE club_payments SET expiresAt='2020-01-01' WHERE orderId='native-content-subscription'",
      );
      expect(
        await client(bearer).articles.getById.query({ id: 8971 }),
      ).toMatchObject({ locked: true, sections: [] });
      await conn.query("UPDATE users SET role='moderator' WHERE id=8970");
      expect(
        await client(bearer).articles.getById.query({ id: 8971 }),
      ).toMatchObject({
        locked: false,
        sections: [{ type: "text", text: "club article body" }],
      });
    });
    it.each(["blockedAt=NOW()", "sessionVersion=1"])(
      "does not leak article sections after %s",
      async (patch) => {
        await conn.query(
          `UPDATE users SET role='admin',${patch} WHERE id=8970`,
        );
        expect(
          await client(bearer).articles.getById.query({ id: 8971 }),
        ).toMatchObject({ locked: true, sections: [] });
      },
    );
    it("hides unpublished and missing articles even from an administrator", async () => {
      await conn.query("UPDATE users SET role='admin' WHERE id=8970");
      expect(
        await client(bearer).articles.getById.query({ id: 8972 }),
      ).toBeUndefined();
      expect(
        await client(bearer).articles.getById.query({ id: -1 }),
      ).toBeUndefined();
    });
  },
);
