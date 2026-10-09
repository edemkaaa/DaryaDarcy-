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
