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
import { getDb } from "../apps/backend/src/db";
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, rmdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// No mocks: admin schemas, native composition, sessions and SQL are real.
describe.skipIf(!testDatabaseUrl)(
  "native admin content reads over HTTP/JWT/MySQL",
  () => {
    let application: INestApplication,
      conn: Connection,
      base: string,
      bearer: string;
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
    beforeAll(async () => {
      conn = await openContentTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv(
        "JWT_SECRET",
        "native-admin-read-fixture-secret-32-characters",
      );
      vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
      await conn.query(
        "INSERT INTO users (id,openId,role) VALUES (9040,'native-admin-content-reader','admin')",
      );
      await conn.query(`INSERT INTO posts (id,text,photos,tags,target,status,published,sortOrder,createdAt,publishedAt,scheduledAt) VALUES
      (9040,'admin public',JSON_ARRAY(),JSON_ARRAY(),'feed','published',TRUE,3,'2025-01-01','2025-01-06',NULL),
      (9041,'admin private draft',JSON_ARRAY(),JSON_ARRAY(),'club','draft',FALSE,1,'2025-01-04',NULL,NULL),
      (9042,'admin scheduled both',JSON_ARRAY(),JSON_ARRAY(),'both','scheduled',TRUE,2,'2025-01-03',NULL,'2030-01-02'),
      (9043,'admin scheduled feed',JSON_ARRAY(),JSON_ARRAY(),'feed','scheduled',TRUE,0,'2025-01-02',NULL,'2030-01-01'),
      (9044,'admin hidden club',JSON_ARRAY(),JSON_ARRAY(),'club','published',FALSE,4,'2025-01-05',NULL,NULL)`);
      await conn.query(`INSERT INTO post_media (id,postId,type,url,mimeType,fileSize,sortOrder) VALUES
      (9040,9041,'audio','https://assets.example.test/admin-draft.mp3','audio/mpeg',23,1),
      (9041,9041,'document','https://assets.example.test/admin-draft.pdf','application/pdf',42,0),
      (9042,9040,'video','https://assets.example.test/admin-public.mp4','video/mp4',48,0)`);
      // Legacy duplicate reactions are counted as rows by the existing dashboard.
      await conn.query("INSERT INTO likes (userId,postId) VALUES ?", [
        Array.from({ length: 20 }, () => [9040, 9041]),
      ]);
      await conn.query(
        "INSERT INTO saved_posts (userId,postId) VALUES (9040,9041)",
      );
      application = await createBackendApplication();
      await application.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
      bearer = await sdk.createSessionToken("native-admin-content-reader", {
        sessionVersion: 0,
      });
    });
    beforeEach(async () => {
      await conn.query(
        "UPDATE users SET role='admin',blockedAt=NULL,sessionVersion=0 WHERE id=9040",
      );
    });
    afterAll(async () => {
      await application?.close();
      if (conn) {
        await conn.query("DELETE FROM likes WHERE userId=9040");
        await conn.query("DELETE FROM saved_posts WHERE userId=9040");
        await conn.query(
          "DELETE FROM post_media WHERE id BETWEEN 9040 AND 9042",
        );
        await conn.query("DELETE FROM posts WHERE id BETWEEN 9040 AND 9044");
        await conn.query("DELETE FROM users WHERE id=9040");
        await conn.end();
      }
      await (
        (await getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    const ownIds = (rows: { id: number }[]) =>
      rows
        .filter((row) => row.id >= 9040 && row.id <= 9044)
        .map((row) => row.id);

    it("retains private admin reads in compiled ESM with real HTTP/JWT/SQL", async () => {
      const directory = mkdtempSync(resolve(".tmp-nest-admin-content-"));
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
              try {
                await application.listen(0, "127.0.0.1");
                const token = await sdk.createSessionToken("native-admin-content-reader", {sessionVersion: 0});
                const admin = createTRPCProxyClient({links: [httpLink({
                  url: "http://127.0.0.1:" + application.getHttpServer().address().port + "/api/trpc",
                  transformer: superjson, headers: {Authorization: "Bearer " + token},
                })]}).admin;
                const ids = rows => rows.filter(row => row.id >= 9040 && row.id <= 9044).map(row => row.id);
                const stats = await admin.stats.query();
                const result = {
                  posts: ids(await admin.posts.query()),
                  filtered: ids(await admin.postsFiltered.query({status: "draft", target: "club"})),
                  scheduled: ids(await admin.scheduledPosts.query()),
                  media: (await admin.getPostMedia.query({postId: 9041})).map(row => row.id),
                  top: stats.topLikedPosts.find(row => row.id === 9041),
                };
                console.log("ADMIN_CONTENT_RESULTS:" + JSON.stringify(result));
              } finally {
                await application.close();
                const database = await getDb();
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
          // No inherited deployment settings, env loader, workers or providers.
          env: {
            NODE_ENV: "production",
            DATABASE_URL: testDatabaseUrl!,
            JWT_SECRET: "isolated-built-admin-content-fixture-secret",
            PUBLIC_APP_URL: "https://club.example.test",
          },
        });
        const result = output
          .split("\n")
          .find((line) => line.startsWith("ADMIN_CONTENT_RESULTS:"));
        expect(result).toBeDefined();
        expect(
          JSON.parse(result!.slice("ADMIN_CONTENT_RESULTS:".length)),
        ).toEqual({
          posts: [9043, 9041, 9042, 9040, 9044],
          filtered: [9041],
          scheduled: [9043, 9042],
          media: [9041, 9040],
          top: { id: 9041, text: "admin private draft", likeCount: 20 },
        });
      } finally {
        rmSync(entry, { force: true });
        rmdirSync(directory);
      }
    }, 15_000);

    it("keeps unpublished bodies and sorted attachments in the full admin catalog", async () => {
      const rows = await client(bearer).admin.posts.query();
      expect(ownIds(rows)).toEqual([9043, 9041, 9042, 9040, 9044]);
      expect(rows.find((row) => row.id === 9041)).toMatchObject({
        text: "admin private draft",
        status: "draft",
        published: false,
        target: "club",
        media: [
          {
            id: 9041,
            type: "document",
            mimeType: "application/pdf",
            fileSize: 42,
          },
          { id: 9040, type: "audio", mimeType: "audio/mpeg", fileSize: 23 },
        ],
      });
      expect(rows.find((row) => row.id === 9044)?.text).toBe(
        "admin hidden club",
      );
    });
    it("pages lightweight admin cards without losing draft editing data", async () => {
      const admin = client(bearer).admin;
      const first = await admin.postsPage.query({ limit: 2 });
      expect(first.posts.map((row: { id: number }) => row.id)).toEqual([
        9043, 9041,
      ]);
      expect(first.nextCursor).toBe(2);
      expect(first.posts[1]).not.toHaveProperty("richText");
      expect(first.posts[1]).not.toHaveProperty("media");
      const second = await admin.postsPage.query({
        limit: 2,
        cursor: first.nextCursor,
      });
      expect(second.posts.map((row: { id: number }) => row.id)).toEqual([
        9042, 9040,
      ]);
      const last = await admin.postsPage.query({
        limit: 2,
        cursor: second.nextCursor,
      });
      expect(last.posts.map((row: { id: number }) => row.id)).toEqual([9044]);
      expect(last.nextCursor).toBeNull();
      const draft = await admin.postDetail.query({ id: 9041 });
      expect(draft).toMatchObject({
        id: 9041,
        text: "admin private draft",
        published: false,
      });
      expect(draft?.media.map((row: { id: number }) => row.id)).toEqual([
        9041, 9040,
      ]);
      expect(await admin.postDetail.query({ id: 999999 })).toBeNull();
      const filtered = await admin.postsPage.query({
        status: "draft",
        target: "club",
      });
      expect(filtered.posts.map((row: { id: number }) => row.id)).toEqual([
        9041,
      ]);
      expect(filtered.nextCursor).toBeNull();
    });
    it("accepts forward infinite-query requests across admin pages", async () => {
      const admin = client(bearer).admin;
      const first = await admin.postsPage.query({
        limit: 2,
        direction: "forward",
      });
      const next = await admin.postsPage.query({
        limit: 2,
        direction: "forward",
        cursor: first.nextCursor,
      });
      expect(first.posts.map((post) => post.id)).toEqual([9043, 9041]);
      expect(next.posts.map((post) => post.id)).toEqual([9042, 9040]);
      await expect(
        admin.postsPage.query({ direction: "backward" } as never),
      ).rejects.toMatchObject({ data: { httpStatus: 400 } });
    });
    it("bounds card bodies and keeps complete data only in protected detail", async () => {
      const admin = client(bearer).admin;
      const text = "🌿".repeat(800);
      try {
        await conn.query(
          "UPDATE posts SET text=?,photos=JSON_ARRAY('https://assets.example.test/first.webp','https://assets.example.test/second.webp'),tags=JSON_ARRAY('a','b','c','d'),richText=JSON_OBJECT('text','private body') WHERE id=9041",
          [text],
        );
        const page = await admin.postsPage.query({ status: "draft" });
        expect(Array.from(page.posts[0].text)).toHaveLength(512);
        expect(page.posts[0]).toMatchObject({
          photos: ["https://assets.example.test/first.webp"],
          tags: ["a", "b", "c"],
          tagCount: 4,
          hasVideo: false,
        });
        expect(await admin.postDetail.query({ id: 9041 })).toMatchObject({
          text,
          richText: { text: "private body" },
          photos: [
            "https://assets.example.test/first.webp",
            "https://assets.example.test/second.webp",
          ],
        });
      } finally {
        await conn.query(
          "UPDATE posts SET text='admin private draft',photos=JSON_ARRAY(),tags=JSON_ARRAY(),richText=NULL WHERE id=9041",
        );
      }
    });
    it("rejects unbounded pagination and preserves admin authorization", async () => {
      for (const input of [
        { limit: 0 },
        { limit: 51 },
        { cursor: -1 },
        { cursor: 1.5 },
        { status: "all" },
      ]) {
        await expect(
          client(bearer).admin.postsPage.query(input as never),
        ).rejects.toMatchObject({ data: { httpStatus: 400 } });
      }
      for (const read of [
        (token?: string) => client(token).admin.postsPage.query({}),
        (token?: string) => client(token).admin.postDetail.query({ id: 9041 }),
      ]) {
        await expect(read()).rejects.toMatchObject({
          data: { httpStatus: 401 },
        });
        await conn.query("UPDATE users SET role='moderator' WHERE id=9040");
        await expect(read(bearer)).rejects.toMatchObject({
          data: { httpStatus: 403 },
        });
        await conn.query("UPDATE users SET role='admin' WHERE id=9040");
      }
    });
    it("returns day summaries instead of all bodies, including a dense day and local boundaries", async () => {
      const admin = client(bearer).admin;
      const days = [
        { from: "2031-01-01T21:00:00Z", to: "2031-01-02T21:00:00Z" },
        { from: "2031-01-02T21:00:00Z", to: "2031-01-03T21:00:00Z" },
      ];
      try {
        await conn.query(
          "INSERT INTO posts(id,text,photos,tags,scheduledAt,status,target,published) VALUES ?",
          [
            Array.from({ length: 742 }, (_, i) => [
              98000 + i,
              "🌿".repeat(1000),
              "[]",
              "[]",
              i === 741 ? "2031-01-02 21:00:00" : "2031-01-02 00:00:00",
              i === 741 ? "draft" : "scheduled",
              "club",
              false,
            ]),
          ],
        );
        const result = await admin.postCalendar.query({ days });
        expect(result.days).toHaveLength(2);
        expect(result.days[0]).toMatchObject({
          dayIndex: 0,
          total: 741,
          published: 0,
          scheduled: 741,
          draft: 0,
        });
        expect(result.days[1]).toMatchObject({
          dayIndex: 1,
          total: 1,
          published: 0,
          scheduled: 0,
          draft: 1,
          id: 98741,
        });
        expect(result.days[0]).not.toHaveProperty("richText");
        expect(result.days[0]).not.toHaveProperty("media");
        expect(result.upcoming).toHaveLength(8);
        expect(
          result.upcoming.slice(0, 2).map((p: { id: number }) => p.id),
        ).toEqual([9043, 9042]);
        expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(
          40 * 1024,
        );
        const page = await admin.postsPage.query({ limit: 50, target: "club" });
        expect(page.posts).toHaveLength(50);
        expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThan(
          150 * 1024,
        );
      } finally {
        await conn.query("DELETE FROM posts WHERE id BETWEEN 98000 AND 98741");
      }
    });
    it("retains the existing header counts including a hidden published record", async () => {
      expect(await client(bearer).admin.postCounts.query()).toEqual({
        total: 5,
        published: 3,
        scheduled: 2,
        draft: 2,
      });
    });
    it("keeps catalog order for scheduled posts sharing one upcoming time", async () => {
      try {
        await conn.query(`INSERT INTO posts(id,text,photos,tags,status,scheduledAt,sortOrder) VALUES
          (99000,'later catalog position',JSON_ARRAY(),JSON_ARRAY(),'scheduled','2030-01-03',-2),
          (99001,'earlier catalog position',JSON_ARRAY(),JSON_ARRAY(),'scheduled','2030-01-03',-3)`);
        const result = await client(bearer).admin.postCalendar.query({
          days: [{ from: "2030-01-03T00:00:00Z", to: "2030-01-04T00:00:00Z" }],
        });
        expect(
          result.upcoming.filter((row) => row.id >= 99000).map((row) => row.id),
        ).toEqual([99001, 99000]);
      } finally {
        await conn.query("DELETE FROM posts WHERE id BETWEEN 99000 AND 99001");
      }
    });
    it("bounds calendar windows and checks access to calendar and counters", async () => {
      const day = { from: "2030-01-01T00:00:00Z", to: "2030-01-02T00:00:00Z" };
      const admin = client(bearer).admin;
      const maximumWindow = Array.from({ length: 62 }, (_, index) => ({
        from: new Date(Date.UTC(2031, 6, index + 1)).toISOString(),
        to: new Date(Date.UTC(2031, 6, index + 2)).toISOString(),
      }));
      expect(
        (await admin.postCalendar.query({ days: maximumWindow })).days,
      ).toEqual([]);
      for (const days of [
        [],
        Array(63).fill(day),
        [day, day],
        [{ ...day, to: "2030-02-01T00:00:00Z" }],
        [{ from: "bad", to: day.to }],
      ]) {
        await expect(
          admin.postCalendar.query({ days } as never),
        ).rejects.toMatchObject({
          data: { httpStatus: 400 },
        });
      }
      expect(
        (
          await admin.postCalendar.query({
            days: [
              { from: "2030-03-30T23:00:00Z", to: "2030-03-31T22:00:00Z" },
            ],
          })
        ).days,
      ).toEqual([]);
      for (const read of [
        (token?: string) =>
          client(token).admin.postCalendar.query({ days: [day] }),
        (token?: string) => client(token).admin.postCounts.query(),
      ]) {
        await expect(read()).rejects.toMatchObject({
          data: { httpStatus: 401 },
        });
        await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=9040");
        await expect(read(bearer)).rejects.toMatchObject({
          data: { httpStatus: 401 },
        });
        await conn.query("UPDATE users SET blockedAt=NULL WHERE id=9040");
      }
    });
    it("orders equal-position admin posts by publication date with creation fallback", async () => {
      try {
        await conn.query(`INSERT INTO posts (id,text,photos,tags,sortOrder,createdAt,publishedAt) VALUES
          (9046,'published earlier',JSON_ARRAY(),JSON_ARRAY(),-5,'2025-01-01','2025-01-06'),
          (9047,'creation fallback',JSON_ARRAY(),JSON_ARRAY(),-5,'2025-01-07',NULL),
          (9048,'created later but published earlier',JSON_ARRAY(),JSON_ARRAY(),-5,'2025-01-08','2025-01-05'),
          (9049,'earlier position wins',JSON_ARRAY(),JSON_ARRAY(),-6,'2025-01-01',NULL)`);
        const rows = await client(bearer).admin.posts.query();
        expect(
          rows
            .filter((row) => row.id >= 9046 && row.id <= 9049)
            .map((row) => row.id),
        ).toEqual([9049, 9047, 9046, 9048]);
      } finally {
        await conn.query("DELETE FROM posts WHERE id BETWEEN 9046 AND 9049");
      }
    });
    it("does not attach a private draft's files to admin posts without media", async () => {
      const rows = await client(bearer).admin.posts.query();
      expect(rows.find((row) => row.id === 9041)?.media).toHaveLength(2);
      for (const id of [9042, 9043, 9044]) {
        expect(rows.find((row) => row.id === id)).toMatchObject({
          id,
          media: [],
        });
      }
    });
    it.each([
      [undefined, [9040, 9044, 9041, 9042, 9043]],
      [{}, [9040, 9044, 9041, 9042, 9043]],
      [{ status: "draft" }, [9041]],
      [{ status: "scheduled" }, [9042, 9043]],
      [{ target: "club" }, [9044, 9041]],
      [{ status: "published", target: "club" }, [9044]],
    ] as const)(
      "retains combined filters and date order (%#)",
      async (input, ids) => {
        expect(
          ownIds(await client(bearer).admin.postsFiltered.query(input)),
        ).toEqual(ids);
      },
    );
    it("orders calendar entries by scheduled time, not catalog or creation order", async () => {
      const rows = await client(bearer).admin.scheduledPosts.query();
      expect(ownIds(rows)).toEqual([9043, 9042]);
      expect(rows.find((row) => row.id === 9042)?.scheduledAt).toEqual(
        new Date("2030-01-02T00:00:00Z"),
      );
    });
    it("returns only the requested draft's ordered media with canonical SQL metadata", async () => {
      const rows = await client(bearer).admin.getPostMedia.query({
        postId: 9041,
      });
      expect(rows.map((row) => row.id)).toEqual([9041, 9040]);
      expect(rows).toMatchObject([
        {
          postId: 9041,
          url: "https://assets.example.test/admin-draft.pdf",
          mimeType: "application/pdf",
          fileSize: 42,
        },
        {
          postId: 9041,
          url: "https://assets.example.test/admin-draft.mp3",
          mimeType: "audio/mpeg",
          fileSize: 23,
        },
      ]);
    });
    it("retains an empty result for a post without attachments", async () => {
      expect(
        await client(bearer).admin.getPostMedia.query({ postId: 9044 }),
      ).toEqual([]);
    });
    it("retains dashboard counts and the private draft's real SQL reaction count", async () => {
      const result = await client(bearer).admin.stats.query();
      // Other suites share the disposable DB; only fixture-local results are exact.
      expect(result.totalPosts).toBeGreaterThanOrEqual(5);
      expect(result.publishedPosts).toBeGreaterThanOrEqual(2);
      expect(result.draftPosts).toBeGreaterThanOrEqual(1);
      expect(result.scheduledPosts).toBeGreaterThanOrEqual(2);
      expect(result.totalLikes).toBeGreaterThanOrEqual(20);
      expect(result.totalSaves).toBeGreaterThanOrEqual(1);
      expect(result.topLikedPosts).toContainEqual({
        id: 9041,
        text: "admin private draft",
        likeCount: 20,
      });
    });
    it("limits dashboard leaders to five and truncates private draft previews to 80 characters", async () => {
      const text = "Тестовая публикация ".repeat(8);
      await conn.query("UPDATE posts SET text=? WHERE id=9041", [text]);
      try {
        await conn.query(
          "INSERT INTO posts (id,text,photos,tags) VALUES (9045,'sixth dashboard candidate',JSON_ARRAY(),JSON_ARRAY())",
        );
        const result = await client(bearer).admin.stats.query();
        expect(result.topLikedPosts).toHaveLength(5);
        expect(result.topLikedPosts).toContainEqual({
          id: 9041,
          text: text.slice(0, 80),
          likeCount: 20,
        });
      } finally {
        await conn.query("DELETE FROM posts WHERE id=9045");
        await conn.query(
          "UPDATE posts SET text='admin private draft' WHERE id=9041",
        );
      }
    });
    it.each([
      [null, "UNAUTHORIZED", 401],
      ["role='user'", "FORBIDDEN", 403],
      ["role='moderator'", "FORBIDDEN", 403],
      ["blockedAt=NOW()", "UNAUTHORIZED", 401],
      ["sessionVersion=1", "UNAUTHORIZED", 401],
    ] as const)(
      "denies every admin read after live identity change: %s",
      async (patch, code, httpStatus) => {
        if (patch) await conn.query(`UPDATE users SET ${patch} WHERE id=9040`);
        const admin = client(patch ? bearer : undefined).admin;
        for (const read of [
          () => admin.posts.query(),
          () => admin.postsFiltered.query(),
          () => admin.scheduledPosts.query(),
          () => admin.stats.query(),
          () => admin.getPostMedia.query({ postId: 9041 }),
        ]) {
          await expect(read()).rejects.toMatchObject({
            data: { code, httpStatus },
          });
        }
      },
    );
    it.each([{ status: "unknown" }, { target: "unknown" }])(
      "rejects invalid filters at the HTTP boundary (%#)",
      async (input) => {
        // Deliberately violate the TypeScript contract to send malformed external input.
        await expect(
          client(bearer).admin.postsFiltered.query(input as never),
        ).rejects.toMatchObject({
          data: { code: "BAD_REQUEST", httpStatus: 400 },
        });
      },
    );
  },
);
