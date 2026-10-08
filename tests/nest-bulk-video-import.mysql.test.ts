import {
  afterAll,
  beforeAll,
  beforeEach,
  afterEach,
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
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { getDb } from "../apps/backend/src/db";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import type { AppRouter } from "../apps/backend/src/routers";

describe.skipIf(!testDatabaseUrl)(
  "bulk video import over real HTTP/JWT/MySQL",
  () => {
    let conn: Connection;
    let app: INestApplication;
    let base: string;
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "bulk-video-synthetic-secret-32");
      await conn.query(`CREATE TABLE IF NOT EXISTS videos (
      id INT AUTO_INCREMENT PRIMARY KEY,youtubeId VARCHAR(32) NOT NULL UNIQUE,
      title VARCHAR(512) NOT NULL,duration VARCHAR(16),thumbnailUrl TEXT,videoUrl TEXT,
      views VARCHAR(32),publishedText VARCHAR(64),sortOrder INT NOT NULL DEFAULT 0,
      published BOOLEAN NOT NULL DEFAULT TRUE,createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB`);
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    });
    async function cleanup() {
      await conn.query("DROP TRIGGER IF EXISTS bulk_video_import_refusal");
      await conn.query(
        "DELETE FROM videos WHERE youtubeId IN ('bulk-http-existing','bulk-http-first','bulk-http-second','bulk-http-failure')",
      );
      await conn.query("DELETE FROM users WHERE id IN (8460,8461)");
    }
    beforeEach(async () => {
      await cleanup();
      await conn.query(
        "INSERT INTO users (id,openId,role,sessionVersion) VALUES (8460,'bulk-http-admin','admin',0),(8461,'bulk-http-member','user',0)",
      );
      await conn.query(
        "INSERT INTO videos (youtubeId,title,videoUrl,published,sortOrder) VALUES ('bulk-http-existing','Existing title','https://example.invalid/existing.mp4',FALSE,90)",
      );
    });
    afterEach(async () => {
      await conn.query("DROP TRIGGER IF EXISTS bulk_video_import_refusal");
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
                    Authorization: `Bearer ${await sdk.createSessionToken(`bulk-http-${actor}`, { sessionVersion: 0 })}`,
                  }
                : {},
          }),
        ],
      });
    }
    async function rows() {
      const [result] = await conn.query<RowDataPacket[]>(
        "SELECT youtubeId,title,duration,thumbnailUrl,videoUrl,views,publishedText,sortOrder,published FROM videos WHERE youtubeId IN ('bulk-http-existing','bulk-http-first','bulk-http-second','bulk-http-failure') ORDER BY youtubeId",
      );
      return result;
    }
    const input = {
      videos: [
        {
          youtubeId: "bulk-http-first",
          title: "First",
          duration: "1:23",
          thumbnailUrl: "https://example.invalid/first.webp",
          views: "10",
          publishedText: "Fixture date",
        },
        {
          youtubeId: "bulk-http-second",
          title: "Second",
          duration: "",
          thumbnailUrl: "",
          views: "",
          publishedText: "",
        },
      ],
    };
    it("persists validated metadata, empty strings and input order without changing existing videos", async () => {
      const existing = (await rows())[0];
      expect(await client().admin.importVideos.mutate(input)).toEqual({
        imported: 2,
      });
      expect(await rows()).toEqual([
        existing,
        {
          youtubeId: "bulk-http-first",
          title: "First",
          duration: "1:23",
          thumbnailUrl: "https://example.invalid/first.webp",
          videoUrl: null,
          views: "10",
          publishedText: "Fixture date",
          sortOrder: 0,
          published: 1,
        },
        {
          youtubeId: "bulk-http-second",
          title: "Second",
          duration: "",
          thumbnailUrl: "",
          videoUrl: null,
          views: "",
          publishedText: "",
          sortOrder: 1,
          published: 1,
        },
      ]);
    });
    it("skips existing IDs and repeated imports without overwriting them", async () => {
      const before = await rows();
      const batch = {
        videos: [
          { youtubeId: "bulk-http-existing", title: "Do not overwrite" },
          { youtubeId: "bulk-http-first", title: "New" },
        ],
      };
      expect(await client().admin.importVideos.mutate(batch)).toEqual({
        imported: 1,
      });
      const saved = await rows();
      expect(saved[0]).toEqual(before[0]);
      expect(saved[1]).toMatchObject({
        duration: null,
        thumbnailUrl: null,
        views: null,
        publishedText: null,
        videoUrl: null,
        sortOrder: 1,
      });
      expect(await client().admin.importVideos.mutate(batch)).toEqual({
        imported: 0,
      });
      expect(await rows()).toEqual(saved);
    });
    it("keeps the first duplicate occurrence within one batch", async () => {
      expect(
        await client().admin.importVideos.mutate({
          videos: [
            { youtubeId: "bulk-http-first", title: "First occurrence" },
            { youtubeId: "bulk-http-first", title: "Ignored occurrence" },
            { youtubeId: "bulk-http-second", title: "Second ID" },
          ],
        }),
      ).toEqual({ imported: 2 });
      expect((await rows()).slice(1)).toMatchObject([
        { title: "First occurrence", sortOrder: 0 },
        { title: "Second ID", sortOrder: 2 },
      ]);
    });
    it("preserves an empty batch's zero count and no writes", async () => {
      const before = await rows();
      expect(await client().admin.importVideos.mutate({ videos: [] })).toEqual({
        imported: 0,
      });
      expect(await rows()).toEqual(before);
    });
    it("rolls back earlier imported rows when a later insert fails, then permits a clean retry", async () => {
      const before = await rows();
      await conn.query(`CREATE TRIGGER bulk_video_import_refusal BEFORE INSERT ON videos FOR EACH ROW
      BEGIN IF NEW.youtubeId='bulk-http-second' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic private import failure'; END IF; END`);
      await expect(
        client().admin.importVideos.mutate(input),
      ).rejects.toMatchObject({
        message: "Внутренняя ошибка сервера",
        data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500 },
      });
      expect(await rows()).toEqual(before);
      await conn.query("DROP TRIGGER bulk_video_import_refusal");
      expect(await client().admin.importVideos.mutate(input)).toEqual({
        imported: 2,
      });
      expect(await rows()).toHaveLength(3);
    });
    it.each([null, "member"] as const)(
      "refuses %s without importing",
      async (actor) => {
        const before = await rows();
        await expect(
          client(actor).admin.importVideos.mutate(input),
        ).rejects.toMatchObject({ data: { httpStatus: actor ? 403 : 401 } });
        expect(await rows()).toEqual(before);
      },
    );
  },
);
