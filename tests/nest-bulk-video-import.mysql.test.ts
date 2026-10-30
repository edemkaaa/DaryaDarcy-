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
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openVideoTestDatabase } from "./helpers/video-mysql";
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
      conn = await openVideoTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "bulk-video-synthetic-secret-32");
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
    it("rolls back the losing competing batch and permits a non-overwriting explicit retry", async () => {
      const existing = (await rows())[0];
      const batches = [
        {
          videos: [
            { youtubeId: "bulk-http-first", title: "Batch A first" },
            { youtubeId: "bulk-http-failure", title: "Batch A shared" },
          ],
        },
        {
          videos: [
            { youtubeId: "bulk-http-second", title: "Batch B first" },
            { youtubeId: "bulk-http-failure", title: "Batch B shared" },
          ],
        },
      ];
      await conn.beginTransaction();
      await conn.query(
        "INSERT INTO videos (youtubeId,title) VALUES ('bulk-http-failure','Uncommitted barrier')",
      );
      const pending = Promise.allSettled(
        batches.map((batch) => client().admin.importVideos.mutate(batch)),
      );
      try {
        // InnoDB can block either the shared row or the preceding insert in
        // the same unique-index gap. Observe both real INSERTs before release,
        // without assuming the contested gap is reached on the second row.
        const deadline = Date.now() + 3000;
        let blocked = 0;
        do {
          const [processes] = await conn.query<RowDataPacket[]>(
            "SHOW FULL PROCESSLIST",
          );
          blocked = processes.filter(
            (p) =>
              /insert into .videos./i.test(p.Info || "") &&
              /bulk-http-(first|second|failure)/.test(String(p.Info)),
          ).length;
          if (blocked === 2) break;
          await new Promise((done) => setTimeout(done, 10));
        } while (Date.now() < deadline);
        expect(blocked).toBe(2);
      } finally {
        await conn.rollback();
        await pending;
      }
      const results = await pending;
      const winner = results.findIndex((r) => r.status === "fulfilled");
      const loser = results.findIndex((r) => r.status === "rejected");
      expect(winner).not.toBe(-1);
      expect(loser).not.toBe(-1);
      expect(results[winner]).toEqual({
        status: "fulfilled",
        value: { imported: 2 },
      });
      expect(results[loser]).toMatchObject({
        status: "rejected",
        reason: {
          message: "Внутренняя ошибка сервера",
          data: { httpStatus: 500 },
        },
      });
      const committed = await rows();
      expect(committed).toHaveLength(3);
      expect(
        committed.find((r) => r.youtubeId === "bulk-http-existing"),
      ).toEqual(existing);
      for (const video of batches[winner].videos)
        expect(
          committed.find((r) => r.youtubeId === video.youtubeId),
        ).toMatchObject(video);
      expect(
        committed.some(
          (r) => r.youtubeId === batches[loser].videos[0].youtubeId,
        ),
      ).toBe(false);
      expect(await client().admin.importVideos.mutate(batches[loser])).toEqual({
        imported: 1,
      });
      const retried = await rows();
      expect(retried).toHaveLength(4);
      for (const video of committed)
        expect(retried.find((r) => r.youtubeId === video.youtubeId)).toEqual(
          video,
        );
      expect(
        retried.find((r) => r.youtubeId === batches[loser].videos[0].youtubeId),
      ).toMatchObject(batches[loser].videos[0]);
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
