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
import type { Connection, RowDataPacket } from "mysql2/promise";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { getDb } from "../apps/backend/src/db";
import { sdk } from "../apps/backend/src/_core/sdk";
import type { AppRouter } from "../apps/backend/src/routers";

// Real HTTP, JWT, schema validation, transactions and SQL; no external transports.
describe.skipIf(!testDatabaseUrl)(
  "content write validation on disposable SQL",
  () => {
    let conn: Connection;
    let app: INestApplication;
    let base: string;
    let bearer: string;
    const source = "sec-content-validation";
    const draft = {
      text: "Valid body",
      photos: [],
      tags: [],
      source,
      published: false,
    };
    const client = () =>
      createTRPCProxyClient<AppRouter>({
        links: [
          httpLink({
            url: base + "/api/trpc",
            transformer: superjson,
            headers: { Authorization: bearer },
          }),
        ],
      });
    async function cleanup() {
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM posts WHERE source=?",
        [source],
      );
      if (rows.length) {
        const ids = rows.map((row) => row.id);
        await conn.query("DELETE FROM post_media WHERE postId IN (?)", [ids]);
        await conn.query("DELETE FROM posts WHERE id IN (?)", [ids]);
      }
      await conn.query(
        "DELETE FROM post_creation_requests WHERE actorUserId=99210",
      );
      await conn.query(
        "DELETE FROM content_recovery_markers WHERE kind='post' AND actorUserId=99210",
      );
      await conn.query("DELETE FROM articles WHERE id=99214");
      await conn.query("DELETE FROM posts WHERE source='article:99214'");
    }
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "content-validation-synthetic-secret-32");
      await conn.query(
        "INSERT INTO users (id,openId,role) VALUES (99210,'sec-content-validation-admin','admin')",
      );
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
      bearer = `Bearer ${await sdk.createSessionToken("sec-content-validation-admin", { sessionVersion: 0 })}`;
    });
    beforeEach(async () => {
      await cleanup();
      await conn.query(
        "INSERT INTO posts (id,text,photos,tags,source,status,published) VALUES (99211,'Existing body',JSON_ARRAY(),JSON_ARRAY(),?,'draft',FALSE),(99212,'Neighbor',JSON_ARRAY(),JSON_ARRAY(),?,'draft',FALSE)",
        [source, source],
      );
      await conn.query(
        "INSERT INTO articles (id,title,sections,published) VALUES (99214,'Validation article',JSON_ARRAY(),FALSE)",
      );
    });
    afterAll(async () => {
      await app?.close();
      if (conn) {
        await cleanup();
        await conn.query("DELETE FROM users WHERE id=99210");
        await conn.end();
      }
      await (
        (await getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    async function snapshot() {
      const [posts] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM posts WHERE source=? ORDER BY id",
        [source],
      );
      const [media] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM post_media WHERE postId IN (SELECT id FROM posts WHERE source=?) ORDER BY id",
        [source],
      );
      const [ledger] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM post_creation_requests WHERE actorUserId=99210",
      );
      const [article] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM articles WHERE id=99214",
      );
      return { posts, media, ledger, article };
    }
    const bad = { data: { code: "BAD_REQUEST", httpStatus: 400 } };
    it.each([
      { publishedAt: "invalid" },
      { scheduledAt: "2026-02-30T10:00:00Z" },
      { publishedAt: "2039-01-01T00:00:00Z" },
      { scheduledAt: "1969-01-01T00:00:00Z" },
      { sortOrder: 1.5 },
      { sortOrder: 2_147_483_648 },
    ])("rejects invalid post fields without SQL changes: %j", async (patch) => {
      const before = await snapshot();
      await expect(
        client().admin.createPost.mutate({
          ...draft,
          ...patch,
          idempotencyKey: "validation-invalid-key-0001",
        }),
      ).rejects.toMatchObject(bad);
      await expect(
        client().admin.updatePost.mutate({ id: 99211, ...patch }),
      ).rejects.toMatchObject(bad);
      expect(await snapshot()).toEqual(before);
    });
    it.each([-1.5, -2_147_483_649])(
      "rejects invalid article order %s without SQL changes",
      async (sortOrder) => {
        const before = await snapshot();
        await expect(
          client().admin.createArticle.mutate({
            title: "Invalid order",
            sections: [],
            sortOrder,
          }),
        ).rejects.toMatchObject(bad);
        await expect(
          client().admin.updateArticle.mutate({ id: 99214, sortOrder }),
        ).rejects.toMatchObject(bad);
        expect(await snapshot()).toEqual(before);
      },
    );
    it.each([-2_147_483_648, 2_147_483_647])(
      "persists exact signed INT boundary %s on post and article",
      async (sortOrder) => {
        expect(
          await client().admin.updatePost.mutate({ id: 99211, sortOrder }),
        ).toEqual({ success: true });
        expect(
          await client().admin.updateArticle.mutate({ id: 99214, sortOrder }),
        ).toEqual({ ok: true });
        const state = await snapshot();
        expect(state.posts.find((row) => row.id === 99211)?.sortOrder).toBe(
          sortOrder,
        );
        expect(state.article[0].sortOrder).toBe(sortOrder);
      },
    );
    it.each([
      "1970-01-01T00:00:01.000Z",
      "2038-01-19T03:14:07.000Z",
      "2026-10-21T12:00:00+03:00",
    ])("persists representable timestamp %s", async (publishedAt) => {
      const id = await client().admin.createPost.mutate({
        ...draft,
        publishedAt,
      });
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT publishedAt FROM posts WHERE id=?",
        [id],
      );
      expect(rows[0].publishedAt.toISOString()).toBe(
        new Date(publishedAt).toISOString(),
      );
    });
    it("preserves negative order and unchanged retry intent after text sanitization", async () => {
      const input = {
        ...draft,
        text: "  Valid\r\nbody  ",
        sortOrder: -7,
        idempotencyKey: "validation-retry-key-0001",
      };
      const id = await client().admin.createPost.mutate(input);
      expect(await client().admin.createPost.mutate(input)).toBe(id);
      const state = await snapshot();
      expect(state.posts.find((row) => row.id === id)).toMatchObject({
        text: "Valid\nbody",
        sortOrder: -7,
      });
      expect(state.ledger).toHaveLength(1);
    });
    it.each([" \t\n ", "\u0000\uFFFD\uFEFF"])(
      "rejects a new post empty after sanitizing %j and rolls back its receipt",
      async (text) => {
        const before = await snapshot();
        await expect(
          client().admin.createPost.mutate({
            ...draft,
            text,
            idempotencyKey: "validation-empty-key-0001",
          }),
        ).rejects.toMatchObject(bad);
        expect(await snapshot()).toEqual(before);
      },
    );
    it("rejects clearing the only text without changing the existing post", async () => {
      const before = await snapshot();
      await expect(
        client().admin.updatePost.mutate({ id: 99211, text: " \u0000 " }),
      ).rejects.toMatchObject(bad);
      expect(await snapshot()).toEqual(before);
    });
    it("does not count whitespace-only photo/video references as content", async () => {
      const before = await snapshot();
      await expect(
        client().admin.createPost.mutate({
          ...draft,
          text: " ",
          photos: [" \t "],
          videos: [" \t "],
        }),
      ).rejects.toMatchObject(bad);
      expect(await snapshot()).toEqual(before);
    });
    it("preserves metadata-only maintenance of an already empty legacy post", async () => {
      await conn.query("UPDATE posts SET text='' WHERE id=99211");
      expect(
        await client().admin.updatePost.mutate({ id: 99211, sortOrder: -2 }),
      ).toEqual({ success: true });
      expect(
        (await snapshot()).posts.find((row) => row.id === 99211),
      ).toMatchObject({ text: "", sortOrder: -2 });
    });
    it.each(["photo", "video", "document", "audio"] as const)(
      "keeps a %s-only post valid, including edits with omitted media",
      async (type) => {
        const photo =
          type === "photo" ? ["https://example.invalid/photo.webp"] : [];
        const videos =
          type === "video" ? ["https://example.invalid/video.mp4"] : [];
        const attachments =
          type === "audio" || type === "document"
            ? [
                {
                  type,
                  url: "https://example.invalid/media",
                  filename: "Synthetic",
                  mimeType: type === "audio" ? "audio/mpeg" : "application/pdf",
                  fileSize: 4,
                },
              ]
            : [];
        const id = await client().admin.createPost.mutate({
          ...draft,
          text: " ",
          photos: photo,
          videos,
          attachments,
        });
        expect(
          await client().admin.updatePost.mutate({ id, text: " \t " }),
        ).toEqual({ success: true });
        expect(
          (await snapshot()).posts.find((row) => row.id === id)?.text,
        ).toBe("");
      },
    );
    it("rolls back removal of the last file when the post has no other content", async () => {
      await conn.query("UPDATE posts SET text='' WHERE id=99211");
      await conn.query(
        "INSERT INTO post_media (id,postId,type,url) VALUES (99213,99211,'document','https://example.invalid/file.pdf')",
      );
      const before = await snapshot();
      await expect(
        client().admin.updatePost.mutate({
          id: 99211,
          removedMediaIds: [99213],
        }),
      ).rejects.toMatchObject(bad);
      expect(await snapshot()).toEqual(before);
      expect(
        await client().admin.updatePost.mutate({
          id: 99211,
          text: "Replacement",
          removedMediaIds: [99213],
        }),
      ).toEqual({ success: true });
    });
    it("rolls back clearing the last photo or video with omitted text", async () => {
      await conn.query(
        "UPDATE posts SET text='',photos=JSON_ARRAY('https://example.invalid/p.webp') WHERE id=99211",
      );
      const before = await snapshot();
      await expect(
        client().admin.updatePost.mutate({ id: 99211, photos: [] }),
      ).rejects.toMatchObject(bad);
      expect(await snapshot()).toEqual(before);
      await conn.query("UPDATE posts SET photos=JSON_ARRAY() WHERE id=99211");
      await conn.query(
        "INSERT INTO post_media (id,postId,type,url) VALUES (99213,99211,'video','https://example.invalid/v.mp4')",
      );
      const withVideo = await snapshot();
      await expect(
        client().admin.updatePost.mutate({ id: 99211, videos: [] }),
      ).rejects.toMatchObject(bad);
      expect(await snapshot()).toEqual(withVideo);
    });
  },
);
