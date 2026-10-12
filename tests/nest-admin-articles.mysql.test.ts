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
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import {
  collectArticleReferences,
  collectPostReferences,
  collectMediaSnapshot,
} from "../tooling/lib/media-reference-map";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import type { AppRouter } from "../apps/backend/src/routers";
import { sdk } from "../apps/backend/src/_core/sdk";
import {
  getArticleById,
  getDb,
  listPublishedArticles,
} from "../apps/backend/src/db";

// No mocks: native composition, schemas, sessions, article/teaser SQL are real.
describe.skipIf(!testDatabaseUrl)(
  "native admin article CRUD over HTTP/JWT/MySQL",
  () => {
    let application: INestApplication,
      conn: Connection,
      base: string,
      bearer: string;
    const created = new Set<number>();
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
    const ownIds = (rows: { id: number }[]) =>
      rows
        .filter((row) => row.id >= 9060 && row.id <= 9062)
        .map((row) => row.id);
    async function clearOwnedRows() {
      await conn.query(
        "DELETE FROM club_payments WHERE orderId='native-article-reader-access' AND userId=9060",
      );
      await conn.query("DELETE FROM comment_likes WHERE commentId=9060");
      await conn.query("DELETE FROM comment_reports WHERE commentId=9060");
      await conn.query("DELETE FROM post_comments WHERE id=9060");
      await conn.query("DELETE FROM likes WHERE userId=9060");
      await conn.query("DELETE FROM saved_posts WHERE userId=9060");
      await conn.query("DELETE FROM post_media WHERE id=9060");
      const ids = [9060, 9061, 9062, ...created];
      await conn.query("DELETE FROM posts WHERE source IN (?)", [
        ids.map((id) => `article:${id}`),
      ]);
      await conn.query("DELETE FROM articles WHERE id IN (?)", [ids]);
      created.clear();
    }
    beforeAll(async () => {
      conn = await openContentTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv(
        "JWT_SECRET",
        "native-admin-article-fixture-secret-32-characters",
      );
      vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
      await conn.query(`CREATE TABLE IF NOT EXISTS articles (
      id INT AUTO_INCREMENT PRIMARY KEY,title VARCHAR(255) NOT NULL,coverUrl TEXT,
      access ENUM('public','club') NOT NULL DEFAULT 'public',published BOOLEAN NOT NULL DEFAULT TRUE,
      sortOrder INT NOT NULL DEFAULT 0,sections JSON NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
      await conn.query(
        "INSERT INTO users (id,openId,role) VALUES (9060,'native-admin-article-editor','admin')",
      );
      application = await createBackendApplication();
      await application.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
      bearer = await sdk.createSessionToken("native-admin-article-editor", {
        sessionVersion: 0,
      });
    });
    beforeEach(async () => {
      await conn.query(
        "UPDATE users SET role='admin',blockedAt=NULL,sessionVersion=0 WHERE id=9060",
      );
      await clearOwnedRows();
      await conn.query(`INSERT INTO articles (id,title,access,published,sortOrder,sections,createdAt) VALUES
      (9060,'native public article','public',TRUE,1,JSON_ARRAY(JSON_OBJECT('type','text','text','public body')),'2025-01-03'),
      (9061,'native hidden article','club',FALSE,0,JSON_ARRAY(JSON_OBJECT('heading','Legacy heading','body','Draft body','photos',JSON_ARRAY('https://assets.example.test/a.png'))),'2025-01-04'),
      (9062,'native private article','club',TRUE,1,JSON_ARRAY(JSON_OBJECT('type','text','text','private body')),'2025-01-02')`);
    });
    afterAll(async () => {
      await application?.close();
      if (conn) {
        await clearOwnedRows();
        await conn.query("DELETE FROM users WHERE id=9060");
        await conn.end();
      }
      await (
        (await getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    async function create(
      input: Parameters<
        ReturnType<typeof client>["admin"]["createArticle"]["mutate"]
      >[0],
    ) {
      const id = await client(bearer).admin.createArticle.mutate(input);
      created.add(id);
      return id;
    }
    async function article(id: number) {
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM articles WHERE id=?",
        [id],
      );
      return rows[0];
    }
    async function teaser(id: number) {
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM posts WHERE source=?",
        [`article:${id}`],
      );
      return rows;
    }

    it("keeps hidden/private bodies, legacy block normalization and admin ordering", async () => {
      const rows = await client(bearer).admin.articles.query();
      expect(ownIds(rows)).toEqual([9061, 9060, 9062]);
      expect(rows.find((row) => row.id === 9061)).toMatchObject({
        published: false,
        access: "club",
        sections: [
          { type: "heading", text: "Legacy heading" },
          { type: "photo", url: "https://assets.example.test/a.png" },
          { type: "text", text: "Draft body" },
        ],
      });
      expect(rows.find((row) => row.id === 9062)?.sections).toEqual([
        { type: "text", text: "private body" },
      ]);
    });
    it("keeps the published repository order but exposes only public article summaries", async () => {
      expect(ownIds(await listPublishedArticles())).toEqual([9060, 9062]);
      const rows = await client().articles.list.query();
      expect(ownIds(rows)).toEqual([9060]);
      expect(rows.find((row) => row.id === 9060)).toEqual({
        id: 9060,
        title: "native public article",
        coverUrl: null,
        access: "public",
      });
    });
    it("keeps unpublished internal lookup available without publishing it to guests or admins", async () => {
      expect(await getArticleById(9061)).toMatchObject({
        id: 9061,
        published: false,
        sections: [
          { type: "heading", text: "Legacy heading" },
          { type: "photo", url: "https://assets.example.test/a.png" },
          { type: "text", text: "Draft body" },
        ],
      });
      for (const token of [undefined, bearer]) {
        expect(
          await client(token).articles.getById.query({ id: 9061 }),
        ).toBeUndefined();
        expect(
          await client(token).articles.getById.query({ id: -1 }),
        ).toBeUndefined();
      }
    });
    it("locks club article bodies for guests while authorized admins receive the body", async () => {
      expect(await client().articles.getById.query({ id: 9062 })).toEqual({
        id: 9062,
        title: "native private article",
        coverUrl: null,
        access: "club",
        locked: true,
        sections: [],
      });
      expect(await client(bearer).articles.getById.query({ id: 9062 })).toEqual(
        {
          id: 9062,
          title: "native private article",
          coverUrl: null,
          access: "club",
          locked: false,
          sections: [{ type: "text", text: "private body" }],
        },
      );
    });
    it("M1 identifies an object shared by a public cover, a restricted section and an auto-created club teaser", async () => {
      // Migration must classify every reference, not the URL prefix or the
      // club target of the generated teaser. No object GET or ACL claim here.
      const shared =
        "https://storage.example.test/synthetic/feed/photos/shared.webp";
      const restricted =
        "https://storage.example.test/synthetic/feed/photos/body-only.webp";
      const sections = [
        { type: "photo" as const, url: shared },
        { type: "photo" as const, url: restricted },
      ];
      const id = await create({
        title: "M1 shared-reference article fixture",
        access: "club",
        published: true,
        coverUrl: shared,
        sections,
      });
      const stored = await article(id);
      expect(stored.coverUrl).toBe(shared);
      expect(stored.sections).toEqual(sections);
      const generated = await teaser(id);
      expect(generated).toHaveLength(1);
      expect(generated[0]).toMatchObject({
        source: `article:${id}`,
        target: "club",
        published: 1,
        status: "published",
        photos: [shared],
      });
      expect(await client().articles.getById.query({ id })).toEqual({
        id,
        title: "M1 shared-reference article fixture",
        access: "club",
        locked: true,
        coverUrl: shared,
        sections: [],
      });
      expect(await client(bearer).articles.getById.query({ id })).toEqual({
        id,
        title: "M1 shared-reference article fixture",
        access: "club",
        locked: false,
        coverUrl: shared,
        sections,
      });
      await conn.query(
        "INSERT INTO post_comments (id,postId,userId,text,photos) VALUES (9060,?,9060,'Synthetic media reference',?)",
        [generated[0].id, JSON.stringify([shared])],
      );
      const [articleSnapshot] = await conn.query<RowDataPacket[]>(
        "SELECT id,access,published,coverUrl,sections FROM articles WHERE id=?",
        [id],
      );
      const [postSnapshot] = await conn.query<RowDataPacket[]>(
        "SELECT id,published,status,target,photos,text,richText FROM posts WHERE id=?",
        [generated[0].id],
      );
      const [comments] = await conn.query<RowDataPacket[]>(
        "SELECT id,postId,photos FROM post_comments WHERE id=9060",
      );
      const report = collectPostReferences({
        articles: articleSnapshot,
        posts: postSnapshot,
        comments,
        media: [],
      });
      expect(
        report.groups.find(
          (group) =>
            group.urlHash === createHash("sha256").update(shared).digest("hex"),
        ),
      ).toEqual({
        urlHash: createHash("sha256").update(shared).digest("hex"),
        visibility: "shared",
        references: [
          `articles:${id}.coverUrl`,
          `articles:${id}.sections:0.url`,
          `posts:${generated[0].id}.photos:0`,
          "post_comments:9060.photos:0",
        ],
      });
      const [commentsAfter] = await conn.query<RowDataPacket[]>(
        "SELECT id,postId,photos FROM post_comments WHERE id=9060",
      );
      expect(commentsAfter).toEqual(comments);
      // Reading through either boundary must not rewrite associations or rights.
      expect(await article(id)).toEqual(stored);
      expect(await teaser(id)).toEqual(generated);
      const [identity] = await conn.query<RowDataPacket[]>(
        "SELECT role,sessionVersion,blockedAt FROM users WHERE id=9060",
      );
      expect(identity).toEqual([
        { role: "admin", sessionVersion: 0, blockedAt: null },
      ]);
    });
    it("M1 collects selected raw SQL article rows without dropping unknown blocks or rewriting data", async () => {
      const url = "https://storage.example.test/synthetic/shared.webp";
      await conn.query("UPDATE articles SET coverUrl=? WHERE id=9060", [url]);
      await conn.query("UPDATE articles SET sections=? WHERE id=9061", [
        JSON.stringify([{ photos: [url], body: "Hidden legacy draft" }]),
      ]);
      await conn.query("UPDATE articles SET sections=? WHERE id=9062", [
        JSON.stringify([
          { type: "photo", url },
          { type: "future-block", url: url + "?signature=SYNTHETIC_ONLY" },
        ]),
      ]);
      const select = () =>
        conn.query<RowDataPacket[]>(
          "SELECT id,access,published,coverUrl,sections FROM articles WHERE id IN (9060,9061,9062) ORDER BY id",
        );
      const [before] = await select();
      // Real mysql2 JSON/BOOLEAN values, not normalized repository DTOs.
      expect(before.map((row) => row.published)).toEqual([1, 0, 1]);
      expect(before[2].sections[1].type).toBe("future-block");
      const report = collectArticleReferences(before);
      expect(report).toEqual({
        scope: "articles-only-no-object-inventory",
        groups: [
          {
            urlHash: createHash("sha256").update(url).digest("hex"),
            visibility: "shared",
            references: [
              "articles:9060.coverUrl",
              "articles:9061.sections:0.photos:0",
              "articles:9062.sections:0.url",
            ],
          },
          {
            urlHash: createHash("sha256")
              .update(url + "?signature=SYNTHETIC_ONLY")
              .digest("hex"),
            visibility: "unknown",
            references: ["articles:9062.sections:1.url"],
          },
        ],
        issues: [
          "articles:9062.sections:1.unknown-shape",
          "articles:9062.sections:1.url.query-or-fragment-needs-object-resolution",
        ],
      });
      expect(JSON.stringify(report)).not.toContain("SYNTHETIC_ONLY");
      expect((await select())[0]).toEqual(before);
      expect(await client().articles.getById.query({ id: 9060 })).toMatchObject(
        {
          coverUrl: url,
          locked: false,
        },
      );
      expect(await client().articles.getById.query({ id: 9062 })).toMatchObject(
        {
          locked: true,
          sections: [],
        },
      );
    });
    it("M1 retains raw SQL associations when a real parent is omitted from the selected snapshot", async () => {
      const url = "https://storage.example.test/synthetic/partial-parent.webp";
      const id = await create({
        title: "M1 partial parent fixture",
        access: "club",
        published: true,
        coverUrl: url,
        sections: [{ type: "text", text: "Restricted body" }],
      });
      const parent = await teaser(id);
      expect(parent).toHaveLength(1);
      await conn.query(
        "INSERT INTO post_media (id,postId,type,url) VALUES (9060,?,'document',?)",
        [parent[0].id, url],
      );
      await conn.query(
        "INSERT INTO post_comments (id,postId,userId,text,photos) VALUES (9060,?,9060,'Synthetic snapshot association',?)",
        [parent[0].id, JSON.stringify([url])],
      );
      const select = async () => {
        const [articles] = await conn.query<RowDataPacket[]>(
          "SELECT id,access,published,coverUrl,sections FROM articles WHERE id=?",
          [id],
        );
        const [media] = await conn.query<RowDataPacket[]>(
          "SELECT id,postId,url FROM post_media WHERE id=9060",
        );
        const [comments] = await conn.query<RowDataPacket[]>(
          "SELECT id,postId,photos FROM post_comments WHERE id=9060",
        );
        return {
          articles,
          posts: [],
          media,
          comments,
          decoration: { avatars: [], videos: [], seasons: [] },
        };
      };
      const before = await select();
      const urlHash = createHash("sha256").update(url).digest("hex");
      const report = collectMediaSnapshot(before, {
        objects: [{ objectId: "partial-parent", urlHashes: [urlHash] }],
        externalUrlHashes: [],
      });
      expect(report.objectMap?.objects).toEqual([
        {
          objectId: "partial-parent",
          visibility: "unknown",
          references: [
            `articles:${id}.coverUrl`,
            "post_media:9060.url",
            "post_comments:9060.photos:0",
          ],
        },
      ]);
      expect(report.issues).toEqual([
        "post_media:9060.parent-not-in-snapshot",
        "post_comments:9060.parent-not-in-snapshot",
      ]);
      expect(report.snapshotCoverage).toEqual({
        selectedFieldsComplete: true,
        missingFields: [],
      });
      expect(JSON.stringify(report)).not.toContain(url);
      expect(await select()).toEqual(before);
      expect(await teaser(id)).toEqual(parent);
      expect(await client().articles.getById.query({ id })).toMatchObject({
        coverUrl: url,
        locked: true,
        sections: [],
      });
    });
    it("normalizes legacy published sections in both repository lists and public detail", async () => {
      await conn.query("UPDATE articles SET sections=? WHERE id=9060", [
        JSON.stringify([
          { heading: "Public heading", body: "Public legacy body" },
        ]),
      ]);
      const expected = [
        { type: "heading", text: "Public heading" },
        { type: "text", text: "Public legacy body" },
      ];
      expect(
        (await listPublishedArticles()).find((row) => row.id === 9060)
          ?.sections,
      ).toEqual(expected);
      expect(await client().articles.getById.query({ id: 9060 })).toEqual({
        id: 9060,
        title: "native public article",
        coverUrl: null,
        access: "public",
        locked: false,
        sections: expected,
      });
    });
    async function ordinaryReader(status: "paid" | "pending" | "failed") {
      await conn.query("UPDATE users SET role='user' WHERE id=9060");
      await conn.query(
        "INSERT INTO club_payments (userId,orderId,status,sum,expiresAt) VALUES (9060,'native-article-reader-access',?,'990.00','2037-01-01')",
        [status],
      );
      return client(bearer).articles;
    }
    const lockedClubArticle = {
      id: 9062,
      title: "native private article",
      coverUrl: null,
      access: "club",
      locked: true,
      sections: [],
    };
    it("rechecks a paid ordinary reader's expiry on the next request with the same session", async () => {
      const reader = await ordinaryReader("paid");
      expect(await reader.getById.query({ id: 9062 })).toEqual({
        ...lockedClubArticle,
        locked: false,
        sections: [{ type: "text", text: "private body" }],
      });
      await conn.query(
        "UPDATE club_payments SET expiresAt='2020-01-01' WHERE orderId='native-article-reader-access'",
      );
      expect(await reader.getById.query({ id: 9062 })).toEqual(
        lockedClubArticle,
      );
      expect(await reader.getById.query({ id: 9060 })).toMatchObject({
        locked: false,
        sections: [{ type: "text", text: "public body" }],
      });
    });
    it.each(["pending", "failed"] as const)(
      "does not unlock an ordinary reader's article from a future %s payment",
      async (status) => {
        const reader = await ordinaryReader(status);
        expect(await reader.getById.query({ id: 9062 })).toEqual(
          lockedClubArticle,
        );
      },
    );
    it("locks a paid reader's article immediately after blocking the account with an existing session", async () => {
      const reader = await ordinaryReader("paid");
      expect(await reader.getById.query({ id: 9062 })).toMatchObject({
        locked: false,
        sections: [{ type: "text", text: "private body" }],
      });
      await conn.query("UPDATE users SET blockedAt='2026-01-01' WHERE id=9060");
      expect(await reader.getById.query({ id: 9062 })).toEqual(
        lockedClubArticle,
      );
      expect(await reader.getById.query({ id: 9061 })).toBeUndefined();
    });
    it("creates a trimmed club article with existing defaults and one teaser", async () => {
      const id = await create({
        title: "  native created article  ",
        sections: [{ type: "text", text: "body" }],
      });
      expect(Number.isSafeInteger(id)).toBe(true);
      expect(await article(id)).toMatchObject({
        title: "native created article",
        coverUrl: null,
        access: "club",
        published: 1,
        sortOrder: 0,
        sections: [{ type: "text", text: "body" }],
      });
      expect(await teaser(id)).toMatchObject([
        {
          text: "native created article",
          photos: [],
          tags: ["exclusive"],
          target: "club",
          published: 1,
          status: "published",
        },
      ]);
      expect(await teaser(id)).toHaveLength(1);
    });
    it("normalizes all supported blocks without storing empty media or duplicate carousel URLs", async () => {
      const id = await create({
        title: "native blocks",
        published: false,
        sections: [
          { type: "heading", text: "Heading" },
          { type: "text", text: "Body" },
          {
            type: "photo",
            url: "https://assets.example.test/a.jpg",
            caption: "Photo",
          },
          { type: "png", url: "https://assets.example.test/b.png" },
          { type: "link", url: "https://example.test/page", text: "Link" },
          {
            type: "carousel",
            urls: [
              "https://assets.example.test/a.jpg",
              "https://assets.example.test/a.jpg",
              "",
            ],
          },
          { type: "photo" },
          { type: "text" },
        ],
      });
      expect((await article(id)).sections).toEqual([
        { type: "heading", text: "Heading" },
        { type: "text", text: "Body" },
        {
          type: "photo",
          url: "https://assets.example.test/a.jpg",
          caption: "Photo",
        },
        { type: "png", url: "https://assets.example.test/b.png" },
        { type: "link", url: "https://example.test/page", label: "Link" },
        { type: "carousel", urls: ["https://assets.example.test/a.jpg"] },
      ]);
      expect(await teaser(id)).toEqual([]);
    });
    it("retains partial edits, explicit null cover, teaser refresh and unpublication cleanup", async () => {
      const id = await create({
        title: "native lifecycle",
        published: false,
        access: "public",
        sortOrder: 7,
        sections: [{ type: "text", text: "Retain body" }],
      });
      expect(await teaser(id)).toEqual([]);
      const admin = client(bearer).admin;
      expect(
        await admin.updateArticle.mutate({
          id,
          title: "  Renamed  ",
          published: true,
          coverUrl: "https://assets.example.test/cover.jpg",
        }),
      ).toEqual({ ok: true });
      expect(await article(id)).toMatchObject({
        title: "Renamed",
        access: "public",
        sortOrder: 7,
        sections: [{ type: "text", text: "Retain body" }],
      });
      expect(await teaser(id)).toMatchObject([
        {
          text: "Renamed",
          photos: ["https://assets.example.test/cover.jpg"],
          target: "club",
        },
      ]);
      const savedArticle = await article(id);
      const savedTeaser = await teaser(id);
      expect(
        await admin.updateArticle.mutate({
          id,
          title: "Renamed",
          published: true,
          coverUrl: "https://assets.example.test/cover.jpg",
        }),
      ).toEqual({ ok: true });
      expect(await article(id)).toEqual(savedArticle);
      expect(await teaser(id)).toEqual(savedTeaser);
      expect(await admin.updateArticle.mutate({ id, coverUrl: null })).toEqual({
        ok: true,
      });
      expect(await teaser(id)).toMatchObject([{ text: "Renamed", photos: [] }]);
      expect(await teaser(id)).toHaveLength(1);
      expect(
        await admin.updateArticle.mutate({ id, published: false }),
      ).toEqual({ ok: true });
      expect((await article(id)).published).toBe(0);
      expect(await teaser(id)).toEqual([]);
    });
    it("replaces sections with an empty list without retaining old content", async () => {
      expect(
        await client(bearer).admin.updateArticle.mutate({
          id: 9062,
          sections: [],
        }),
      ).toEqual({ ok: true });
      expect((await article(9062)).sections).toEqual([]);
      expect(
        (await client(bearer).admin.articles.query()).find(
          (row) => row.id === 9062,
        )?.sections,
      ).toEqual([{ type: "text", text: "" }]);
    });
    it("deletes the article and its teaser discussion/reaction/attachment rows", async () => {
      const id = await create({ title: "native delete article", sections: [] });
      const postId = (await teaser(id))[0].id;
      await conn.query("INSERT INTO likes (userId,postId) VALUES (9060,?)", [
        postId,
      ]);
      await conn.query(
        "INSERT INTO saved_posts (userId,postId) VALUES (9060,?)",
        [postId],
      );
      await conn.query(
        "INSERT INTO post_media (id,postId,type,url) VALUES (9060,?,'document','https://assets.example.test/fixture.pdf')",
        [postId],
      );
      await conn.query(
        "INSERT INTO post_comments (id,postId,userId,text) VALUES (9060,?,9060,'fixture comment')",
        [postId],
      );
      await conn.query(
        "INSERT INTO comment_likes (commentId,userId) VALUES (9060,9060)",
      );
      await conn.query(
        "INSERT INTO comment_reports (commentId,reporterUserId,reason) VALUES (9060,9060,'fixture')",
      );
      expect(await client(bearer).admin.deleteArticle.mutate({ id })).toEqual({
        ok: true,
      });
      expect(await article(id)).toBeUndefined();
      expect(await teaser(id)).toEqual([]);
      for (const table of [
        "likes",
        "saved_posts",
        "post_media",
        "post_comments",
      ]) {
        const [rows] = await conn.query(
          `SELECT id FROM ${table} WHERE postId=?`,
          [postId],
        );
        expect(rows).toEqual([]);
      }
      for (const table of ["comment_likes", "comment_reports"]) {
        const [rows] = await conn.query(
          `SELECT id FROM ${table} WHERE commentId=9060`,
        );
        expect(rows).toEqual([]);
      }
    });
    it("refuses update of a missing article without creating a teaser", async () => {
      const admin = client(bearer).admin;
      await expect(
        admin.updateArticle.mutate({ id: -1, title: "Missing" }),
      ).rejects.toMatchObject({
        message: "Статья не найдена",
        data: { code: "NOT_FOUND", httpStatus: 404 },
      });
      expect(await teaser(-1)).toEqual([]);
    });
    it("keeps deletion of a missing article idempotent", async () => {
      const admin = client(bearer).admin;
      expect(await admin.deleteArticle.mutate({ id: -1 })).toEqual({
        ok: true,
      });
      expect(await teaser(-1)).toEqual([]);
    });
    it("refuses a stale editor save after the article was deleted", async () => {
      const id = await create({ title: "native stale editor", sections: [] });
      const admin = client(bearer).admin;
      expect(await admin.deleteArticle.mutate({ id })).toEqual({ ok: true });
      await expect(
        admin.updateArticle.mutate({
          id,
          title: "Unsaved stale edit",
          published: true,
          sections: [{ type: "text", text: "Retain this editor draft" }],
        }),
      ).rejects.toMatchObject({
        message: "Статья не найдена",
        data: { code: "NOT_FOUND", httpStatus: 404 },
      });
      expect(await article(id)).toBeUndefined();
      expect(await teaser(id)).toEqual([]);
    });
    it("leaves an orphan teaser unchanged on a refused edit until explicit deletion", async () => {
      const id = await create({ title: "native orphan article", sections: [] });
      const before = await teaser(id);
      expect(before).toHaveLength(1);
      await conn.query("DELETE FROM articles WHERE id=?", [id]);
      const admin = client(bearer).admin;
      await expect(
        admin.updateArticle.mutate({ id, title: "Unsaved orphan edit" }),
      ).rejects.toMatchObject({
        data: { code: "NOT_FOUND", httpStatus: 404 },
      });
      expect(await article(id)).toBeUndefined();
      expect(await teaser(id)).toEqual(before);
      expect(await admin.deleteArticle.mutate({ id })).toEqual({ ok: true });
      expect(await teaser(id)).toEqual([]);
    });
    it("preserves refusal of an empty patch for an existing article", async () => {
      const before = await article(9061);
      await expect(
        client(bearer).admin.updateArticle.mutate({ id: 9061 }),
      ).rejects.toMatchObject({
        data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
      });
      expect(await article(9061)).toEqual(before);
      expect(await teaser(9061)).toEqual([]);
    });
    it.each([
      { title: " ", sections: [] },
      { title: "x".repeat(256), sections: [] },
      { title: "native invalid article", access: "unknown", sections: [] },
      {
        title: "native invalid article",
        sections: [{ type: "html", text: "Bad" }],
      },
    ])(
      "rejects malformed create input before any SQL write (%#)",
      async (input) => {
        await expect(
          client(bearer).admin.createArticle.mutate(input as never),
        ).rejects.toMatchObject({
          data: { code: "BAD_REQUEST", httpStatus: 400 },
        });
        // Other suites share the disposable DB; inspect only these rejected titles.
        const [rows] = await conn.query(
          "SELECT id FROM articles WHERE title IN (?)",
          [["", "x".repeat(256), "native invalid article"]],
        );
        expect(rows).toEqual([]);
      },
    );
    it.each([
      { id: 9061, title: " " },
      { id: 9061, published: "true" },
      { id: 9061, sections: [{ type: "invalid" }] },
    ])(
      "rejects malformed update input while retaining the draft (%#)",
      async (input) => {
        await expect(
          client(bearer).admin.updateArticle.mutate(input as never),
        ).rejects.toMatchObject({
          data: { code: "BAD_REQUEST", httpStatus: 400 },
        });
        expect(await article(9061)).toMatchObject({
          title: "native hidden article",
          published: 0,
        });
        expect(await teaser(9061)).toEqual([]);
      },
    );
    it.each([
      [null, "UNAUTHORIZED", 401],
      ["role='user'", "FORBIDDEN", 403],
      ["role='moderator'", "FORBIDDEN", 403],
      ["blockedAt=NOW()", "UNAUTHORIZED", 401],
      ["sessionVersion=1", "UNAUTHORIZED", 401],
    ] as const)(
      "denies every article operation after live identity change (%s)",
      async (patch, code, httpStatus) => {
        if (patch) await conn.query(`UPDATE users SET ${patch} WHERE id=9060`);
        const admin = client(patch ? bearer : undefined).admin;
        for (const operation of [
          () => admin.articles.query(),
          () =>
            admin.createArticle.mutate({ title: "Forbidden", sections: [] }),
          () =>
            admin.updateArticle.mutate({
              id: 9061,
              title: "Forbidden",
              published: true,
            }),
          () => admin.deleteArticle.mutate({ id: 9062 }),
        ])
          await expect(operation()).rejects.toMatchObject({
            data: { code, httpStatus },
          });
        expect(await article(9061)).toMatchObject({
          title: "native hidden article",
          published: 0,
        });
        expect(await article(9062)).toMatchObject({
          title: "native private article",
        });
        const [forbidden] = await conn.query(
          "SELECT id FROM articles WHERE title='Forbidden'",
        );
        expect(forbidden).toEqual([]);
      },
    );
    it("retains native article CRUD and private catalog in compiled ESM", async () => {
      const directory = mkdtempSync(resolve(".tmp-nest-admin-articles-"));
      const entry = join(directory, "application.mjs");
      try {
        await build({
          stdin: {
            resolveDir: process.cwd(),
            loader: "ts",
            contents: `
        import { createBackendApplication } from "./apps/backend/src/_core/application";
        import { sdk } from "./apps/backend/src/_core/sdk";
        import { getDb } from "./apps/backend/src/db";
        import { createTRPCProxyClient, httpLink } from "@trpc/client";
        import superjson from "superjson";
        const application = await createBackendApplication();
        let id;
        try {
          await application.listen(0, "127.0.0.1");
          const token = await sdk.createSessionToken("native-admin-article-editor", {sessionVersion: 0});
          const admin = createTRPCProxyClient({links:[httpLink({
            url:"http://127.0.0.1:"+application.getHttpServer().address().port+"/api/trpc",
            transformer:superjson,headers:{Authorization:"Bearer "+token},
          })]}).admin;
          id = await admin.createArticle.mutate({title:"native compiled article",published:false,sections:[{type:"text",text:"Compiled body"}]});
          const updated = await admin.updateArticle.mutate({id,title:"Compiled update",published:true});
          const rows = await admin.articles.query();
          const own = rows.find(row=>row.id===id);
          const deleted = await admin.deleteArticle.mutate({id});
          console.log("ADMIN_ARTICLE_RESULTS:"+JSON.stringify({
            ids:rows.filter(row=>row.id>=9060&&row.id<=9062).map(row=>row.id),
            own:{title:own.title,access:own.access,published:own.published,sections:own.sections},updated,deleted,
          }));
        } finally {
          const database=await getDb();
          if(id) {
            await database?.$client.query("DELETE FROM posts WHERE source=?",["article:"+id]);
            await database?.$client.query("DELETE FROM articles WHERE id=?",[id]);
          }
          await application.close();
          await database?.$client.end();
        }
      `,
          },
          platform: "node",
          packages: "external",
          bundle: true,
          format: "esm",
          outfile: entry,
        });
        const output = execFileSync(process.execPath, [entry], {
          cwd: tmpdir(),
          encoding: "utf8",
          timeout: 10_000,
          env: {
            NODE_ENV: "production",
            DATABASE_URL: testDatabaseUrl!,
            JWT_SECRET: "isolated-built-admin-article-fixture-secret",
            PUBLIC_APP_URL: "https://club.example.test",
          },
        });
        const result = output
          .split("\n")
          .find((line) => line.startsWith("ADMIN_ARTICLE_RESULTS:"));
        expect(result).toBeDefined();
        expect(
          JSON.parse(result!.slice("ADMIN_ARTICLE_RESULTS:".length)),
        ).toEqual({
          ids: [9061, 9060, 9062],
          own: {
            title: "Compiled update",
            access: "club",
            published: true,
            sections: [{ type: "text", text: "Compiled body" }],
          },
          updated: { ok: true },
          deleted: { ok: true },
        });
      } finally {
        rmSync(entry, { force: true });
        rmdirSync(directory);
      }
    }, 15_000);
  },
);
