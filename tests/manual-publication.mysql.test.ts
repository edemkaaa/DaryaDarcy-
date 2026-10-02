import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createTRPCProxyClient, httpLink } from "@trpc/client";
import superjson from "superjson";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { openContentTestDatabase } from "./helpers/content-mysql";

const transport = vi.hoisted(() => ({
  announcements: [] as { text: string; id: number; target: string }[],
}));
vi.mock("../apps/backend/src/push", () => ({
  sendMarketingPostNotification: async (
    text: string,
    id: number,
    target: string,
  ) => {
    transport.announcements.push({ text, id, target });
  },
}));
import { appRouter, type AppRouter } from "../apps/backend/src/routers";
import { createContext } from "../apps/backend/src/_core/context";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb, publishDueScheduledPosts } from "../apps/backend/src/db";

describe.skipIf(!testDatabaseUrl)(
  "manual publication ownership over HTTP and MySQL",
  () => {
    let conn: Connection, server: Server, base: string;
    let admin: ReturnType<typeof createTRPCProxyClient<AppRouter>>;
    const client = (token?: string) =>
      createTRPCProxyClient<AppRouter>({
        links: [
          httpLink({
            url: `${base}/api/trpc`,
            transformer: superjson,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }),
        ],
      });
    async function cleanup() {
      await conn.query(
        "DELETE FROM post_media WHERE postId BETWEEN 11401 AND 11405",
      );
      await conn.query("DELETE FROM posts WHERE id BETWEEN 11401 AND 11405");
    }
    beforeAll(async () => {
      conn = await openContentTestDatabase();
      // Global scheduler tests must not consume another suite's due fixtures.
      // Worker/request concurrency inside this suite still uses real row locks.
      const [locks] = await conn.query<RowDataPacket[]>(
        "SELECT GET_LOCK('backend_test_post_publication',30) AS acquired",
      );
      expect(locks[0].acquired).toBe(1);
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv(
        "JWT_SECRET",
        "manual-publication-fixture-secret-32-characters",
      );
      await conn.query(`INSERT INTO users (id,openId,role) VALUES
      (92601,'publication-admin','admin'),(92602,'publication-member','user')`);
      const app = express();
      app.use(
        "/api/trpc",
        createExpressMiddleware({ router: appRouter, createContext }),
      );
      server = await new Promise<Server>((resolve) => {
        const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
      });
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      admin = client(
        await sdk.createSessionToken("publication-admin", {
          sessionVersion: 0,
        }),
      );
    });
    beforeEach(async () => {
      transport.announcements = [];
      await cleanup();
      await conn.query("UPDATE users SET blockedAt=NULL WHERE id=92601");
      await conn.query(`INSERT INTO posts (id,text,photos,tags,status,published,target,scheduledAt,publishedAt) VALUES
      (11401,'Scheduled club',JSON_ARRAY(),JSON_ARRAY(),'scheduled',FALSE,'club','2026-01-01 00:00:00',NULL),
      (11402,'Draft feed',JSON_ARRAY(),JSON_ARRAY(),'draft',FALSE,'feed',NULL,'2025-01-01 00:00:00'),
      (11403,'Already public',JSON_ARRAY(),JSON_ARRAY(),'published',TRUE,'both',NULL,'2025-01-01 00:00:00'),
      (11404,'Early manual',JSON_ARRAY(),JSON_ARRAY(),'scheduled',FALSE,'feed',DATE_ADD(NOW(),INTERVAL 1 DAY),NULL)`);
      await conn.query(`INSERT INTO post_media (id,postId,type,url,filename,mimeType,sortOrder) VALUES
        (11411,11402,'video','https://assets.example.test/old.mp4','old.mp4','video/mp4',0),
        (11412,11402,'document','https://assets.example.test/guide.pdf','guide.pdf','application/pdf',0)`);
    });
    afterAll(async () => {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      await cleanup();
      await conn?.query("DELETE FROM users WHERE id IN (92601,92602)");
      await conn?.end();
      const database = await getDb();
      await (
        database as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    async function state(id: number) {
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT status,published,
      DATE_FORMAT(publishedAt,'%Y-%m-%d %H:%i:%s') publishedAt FROM posts WHERE id=?`,
        [id],
      );
      return rows[0];
    }
    it("does not reannounce an already-published post", async () => {
      expect(await admin.admin.confirmPost.mutate({ id: 11403 })).toEqual({
        success: true,
      });
      expect(transport.announcements).toEqual([]);
      expect(await state(11403)).toEqual({
        status: "published",
        published: 1,
        publishedAt: "2025-01-01 00:00:00",
      });
    });
    it("retries return success but announce a scheduled post only once", async () => {
      expect(await admin.admin.confirmPost.mutate({ id: 11401 })).toEqual({
        success: true,
      });
      expect(await admin.admin.confirmPost.mutate({ id: 11401 })).toEqual({
        success: true,
      });
      expect(transport.announcements).toEqual([
        { text: "Scheduled club", id: 11401, target: "club" },
      ]);
      expect(await state(11401)).toMatchObject({
        status: "published",
        published: 1,
      });
    });
    it("concurrent manual requests publish and announce a draft only once", async () => {
      expect(
        await Promise.all(
          Array.from({ length: 8 }, () =>
            admin.admin.confirmPost.mutate({ id: 11402 }),
          ),
        ),
      ).toEqual(Array(8).fill({ success: true }));
      expect(transport.announcements).toEqual([
        { text: "Draft feed", id: 11402, target: "feed" },
      ]);
      expect(await state(11402)).toEqual({
        status: "published",
        published: 1,
        publishedAt: "2025-01-01 00:00:00",
      });
    });
    it("keeps explicit early manual confirmation and uses now, not the future schedule", async () => {
      await admin.admin.confirmPost.mutate({ id: 11404 });
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT publishedAt < scheduledAt AS early, publishedAt BETWEEN DATE_SUB(NOW(),INTERVAL 1 MINUTE) AND NOW() AS current FROM posts WHERE id=11404",
      );
      expect(rows).toEqual([{ early: 1, current: 1 }]);
      expect(transport.announcements).toEqual([
        { text: "Early manual", id: 11404, target: "feed" },
      ]);
    });
    it("a missing ID remains a silent successful no-op without an announcement", async () => {
      expect(await admin.admin.confirmPost.mutate({ id: 11405 })).toEqual({
        success: true,
      });
      expect(transport.announcements).toEqual([]);
      expect(await state(11405)).toBeUndefined();
    });
    it("a database failure neither publishes nor announces, and a retry can succeed", async () => {
      const before = await state(11401);
      await conn.query(`CREATE TRIGGER backend_test_manual_publication_failure BEFORE UPDATE ON posts FOR EACH ROW
      BEGIN IF OLD.id=11401 AND NEW.status='published' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Private fixture failure'; END IF; END`);
      try {
        await expect(
          admin.admin.confirmPost.mutate({ id: 11401 }),
        ).rejects.toMatchObject({ message: "Внутренняя ошибка сервера" });
        expect(await state(11401)).toEqual(before);
        expect(transport.announcements).toEqual([]);
      } finally {
        await conn.query(
          "DROP TRIGGER backend_test_manual_publication_failure",
        );
      }
      await admin.admin.confirmPost.mutate({ id: 11401 });
      expect(transport.announcements).toHaveLength(1);
    });
    it("anonymous, member and blocked administrator requests cannot publish", async () => {
      const before = await state(11401);
      await expect(
        client().admin.confirmPost.mutate({ id: 11401 }),
      ).rejects.toMatchObject({ data: { code: "UNAUTHORIZED" } });
      const member = client(
        await sdk.createSessionToken("publication-member", {
          sessionVersion: 0,
        }),
      );
      await expect(
        member.admin.confirmPost.mutate({ id: 11401 }),
      ).rejects.toMatchObject({ data: { code: "FORBIDDEN" } });
      await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=92601");
      await expect(
        admin.admin.confirmPost.mutate({ id: 11401 }),
      ).rejects.toThrow();
      expect(await state(11401)).toEqual(before);
      expect(transport.announcements).toEqual([]);
    });
    it("manual and scheduled confirmation have only one announcement owner", async () => {
      const guard = await openTestDatabase();
      let manual: Promise<unknown> | undefined;
      let scheduled: ReturnType<typeof publishDueScheduledPosts> | undefined;
      let schedulerFinished = false;
      try {
        await guard.beginTransaction();
        await guard.query("SELECT id FROM posts WHERE id=11401 FOR UPDATE");
        manual = admin.admin.confirmPost.mutate({ id: 11401 });
        scheduled = publishDueScheduledPosts().then((rows) => {
          schedulerFinished = true;
          return rows;
        });
        // The scheduler already skips a locked row. Hold the manual writer until
        // that tick finishes; a second tick must not claim the same transition.
        await vi.waitFor(() => expect(schedulerFinished).toBe(true), {
          timeout: 3000,
          interval: 20,
        });
        await guard.commit();
        await manual;
        const batches = [
          ...(await scheduled),
          ...(await publishDueScheduledPosts()),
        ];
        expect([
          ...transport.announcements.map((row) => row.id),
          ...batches.map((row) => row.id),
        ]).toEqual([11401]);
      } finally {
        await guard.rollback();
        await Promise.allSettled([manual, scheduled]);
        await guard.end();
      }
    });
    it("does not reannounce a transition already committed by the scheduler", async () => {
      const scheduled = await publishDueScheduledPosts();
      await admin.admin.confirmPost.mutate({ id: 11401 });
      await admin.admin.updatePost.mutate({ id: 11401, status: "published" });
      expect([
        ...scheduled.map((row) => row.id),
        ...transport.announcements.map((row) => row.id),
      ]).toEqual([11401]);
    });
    it("still repairs a legacy published status with a false visibility flag", async () => {
      await conn.query("UPDATE posts SET published=FALSE WHERE id=11403");
      await admin.admin.confirmPost.mutate({ id: 11403 });
      expect(await state(11403)).toEqual({
        status: "published",
        published: 1,
        publishedAt: "2025-01-01 00:00:00",
      });
      expect(transport.announcements).toEqual([
        { text: "Already public", id: 11403, target: "both" },
      ]);
    });
    async function editSnapshot() {
      const [[post], [media]] = await Promise.all([
        conn.query<RowDataPacket[]>(
          "SELECT text,status,published,publishedAt,target,tags,richText FROM posts WHERE id=11402",
        ),
        conn.query<RowDataPacket[]>(
          "SELECT id,type,url,filename,sortOrder FROM post_media WHERE postId=11402 ORDER BY id",
        ),
      ]);
      return { post: post[0], media };
    }
    it("rolls back post and old videos when the second replacement insert fails", async () => {
      const before = await editSnapshot();
      await conn.query(`CREATE TRIGGER backend_test_edit_media_failure BEFORE INSERT ON post_media FOR EACH ROW
        BEGIN IF NEW.postId=11402 AND NEW.url='https://assets.example.test/broken.mp4' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Fixture second media failure'; END IF; END`);
      try {
        await expect(
          admin.admin.updatePost.mutate({
            id: 11402,
            text: "New title",
            status: "published",
            target: "club",
            videos: [
              "https://assets.example.test/good.mp4",
              "https://assets.example.test/broken.mp4",
            ],
          }),
        ).rejects.toMatchObject({ message: "Внутренняя ошибка сервера" });
        expect(await editSnapshot()).toEqual(before);
        expect(transport.announcements).toEqual([]);
      } finally {
        await conn.query("DROP TRIGGER backend_test_edit_media_failure");
      }
    });
    it("a malformed encoded video filename cannot leave a partial save", async () => {
      const before = await editSnapshot();
      await expect(
        admin.admin.updatePost.mutate({
          id: 11402,
          text: "New title",
          status: "published",
          videos: [
            "https://assets.example.test/good.mp4",
            "https://assets.example.test/%broken.mp4",
          ],
        }),
      ).rejects.toThrow();
      expect(await editSnapshot()).toEqual(before);
      expect(transport.announcements).toEqual([]);
    });
    it("announces the saved sanitized text rather than the raw request", async () => {
      await admin.admin.updatePost.mutate({
        id: 11402,
        text: " \uFEFFSaved title\r\n ",
        status: "published",
        target: "club",
      });
      expect((await editSnapshot()).post.text).toBe("Saved title");
      expect(transport.announcements).toEqual([
        { text: "Saved title", id: 11402, target: "club" },
      ]);
    });
    it("a missing post edit cannot create orphan videos", async () => {
      expect(
        await admin.admin.updatePost.mutate({
          id: 11405,
          text: "Missing",
          videos: ["https://assets.example.test/orphan.mp4"],
        }),
      ).toEqual({ success: true });
      const [media] = await conn.query<RowDataPacket[]>(
        "SELECT id FROM post_media WHERE postId=11405",
      );
      expect(media).toEqual([]);
      expect(transport.announcements).toEqual([]);
    });
    async function waitForPostWriters(count: number) {
      await vi.waitFor(
        async () => {
          const [rows] = await conn.query<
            RowDataPacket[]
          >(`SELECT COUNT(DISTINCT w.REQUESTING_ENGINE_TRANSACTION_ID) n
          FROM performance_schema.data_lock_waits w
          JOIN performance_schema.data_locks b ON b.ENGINE_LOCK_ID=w.BLOCKING_ENGINE_LOCK_ID
          WHERE b.OBJECT_SCHEMA=DATABASE() AND b.OBJECT_NAME='posts' AND b.LOCK_DATA='11402'`);
          expect(Number(rows[0].n)).toBeGreaterThanOrEqual(count);
        },
        { timeout: 3000, interval: 20 },
      );
    }
    it("replaces only videos and preserves documents, decoded names and explicit order", async () => {
      await admin.admin.updatePost.mutate({
        id: 11402,
        text: "Edited",
        tags: ["exclusive"],
        status: "published",
        target: "club",
        videos: [
          " https://assets.example.test/one%20video.mp4?key=fixture ",
          " ",
          "https://assets.example.test/two.mp4",
        ],
      });
      const snapshot = await editSnapshot();
      expect(snapshot.post).toMatchObject({
        text: "Edited",
        status: "published",
        published: 1,
        target: "club",
        tags: ["exclusive", "video"],
      });
      expect(
        snapshot.media.map(({ type, filename, sortOrder }) => ({
          type,
          filename,
          sortOrder,
        })),
      ).toEqual([
        { type: "document", filename: "guide.pdf", sortOrder: 0 },
        { type: "video", filename: "one video.mp4", sortOrder: 0 },
        { type: "video", filename: "two.mp4", sortOrder: 2 },
      ]);
      expect(transport.announcements).toEqual([
        { text: "Edited", id: 11402, target: "club" },
      ]);
    });
    it("omitting videos preserves every attachment on a draft edit", async () => {
      const before = (await editSnapshot()).media;
      await admin.admin.updatePost.mutate({
        id: 11402,
        text: "Correction",
        status: "draft",
      });
      expect((await editSnapshot()).media).toEqual(before);
      expect(transport.announcements).toEqual([]);
    });
    it("an explicit empty video list removes videos but not documents", async () => {
      await admin.admin.updatePost.mutate({
        id: 11402,
        text: "Correction",
        videos: [],
      });
      expect((await editSnapshot()).media).toEqual([
        {
          id: 11412,
          type: "document",
          url: "https://assets.example.test/guide.pdf",
          filename: "guide.pdf",
          sortOrder: 0,
        },
      ]);
      expect(transport.announcements).toEqual([]);
    });
    it("preserves explicit null and backdated publication dates", async () => {
      await admin.admin.updatePost.mutate({
        id: 11402,
        status: "published",
        publishedAt: null,
      });
      expect((await state(11402)).publishedAt).toBeNull();
      await admin.admin.updatePost.mutate({
        id: 11402,
        publishedAt: "2024-01-01T00:00:00Z",
        text: "Correction",
      });
      expect((await state(11402)).publishedAt).toBe("2024-01-01 00:00:00");
      expect(transport.announcements).toHaveLength(1);
    });
    it("an omitted publication date is filled only after locking an undated post", async () => {
      await admin.admin.updatePost.mutate({ id: 11401, status: "published" });
      const [rows] = await conn.query<RowDataPacket[]>(
        // MySQL TIMESTAMP(0) rounds a JS millisecond value into the next second.
        "SELECT publishedAt BETWEEN DATE_SUB(NOW(),INTERVAL 1 MINUTE) AND DATE_ADD(NOW(),INTERVAL 1 SECOND) AS current FROM posts WHERE id=11401",
      );
      expect(rows).toEqual([{ current: 1 }]);
    });
    it("concurrent edits keep one complete matching post and video revision", async () => {
      const revisions = [
        {
          text: "Revision A",
          videos: [
            "https://assets.example.test/a1.mp4",
            "https://assets.example.test/a2.mp4",
          ],
        },
        {
          text: "Revision B",
          videos: [
            "https://assets.example.test/b1.mp4",
            "https://assets.example.test/b2.mp4",
          ],
        },
      ];
      await Promise.all(
        revisions.map((revision) =>
          admin.admin.updatePost.mutate({ id: 11402, ...revision }),
        ),
      );
      const snapshot = await editSnapshot();
      expect(revisions).toContainEqual({
        text: snapshot.post.text,
        videos: snapshot.media
          .filter((row) => row.type === "video")
          .map((row) => row.url),
      });
      expect(
        snapshot.media.filter((row) => row.type === "document"),
      ).toHaveLength(1);
      expect(transport.announcements).toEqual([]);
    });
    it("an empty saved text is not replaced by the previous text in its announcement", async () => {
      await admin.admin.updatePost.mutate({
        id: 11402,
        text: "",
        status: "published",
      });
      expect((await editSnapshot()).post.text).toBe("");
      expect(transport.announcements).toEqual([
        { text: "", id: 11402, target: "feed" },
      ]);
    });
    it("a media-only edit succeeds without an empty SQL SET and keeps the post unchanged", async () => {
      const before = (await editSnapshot()).post;
      expect(
        await admin.admin.updatePost.mutate({ id: 11402, videos: [] }),
      ).toEqual({ success: true });
      expect((await editSnapshot()).post).toEqual(before);
      expect((await editSnapshot()).media.map((row) => row.type)).toEqual([
        "document",
      ]);
      expect(transport.announcements).toEqual([]);
    });
    it("eight waiting edit requests have only one publication owner", async () => {
      const guard = await openTestDatabase();
      let requests: Promise<unknown>[] = [];
      try {
        await guard.beginTransaction();
        await guard.query("SELECT id FROM posts WHERE id=11402 FOR UPDATE");
        requests = Array.from({ length: 8 }, () =>
          admin.admin.updatePost.mutate({ id: 11402, status: "published" }),
        );
        await waitForPostWriters(8);
        expect(transport.announcements).toEqual([]);
        await guard.commit();
        await Promise.all(requests);
        expect(transport.announcements).toEqual([
          { text: "Draft feed", id: 11402, target: "feed" },
        ]);
      } finally {
        await guard.rollback();
        await Promise.allSettled(requests);
        await guard.end();
      }
    });
    it("an edit behind manual confirmation cannot announce the same transition", async () => {
      const guard = await openTestDatabase();
      const requests: Promise<unknown>[] = [];
      try {
        await guard.beginTransaction();
        await guard.query("SELECT id FROM posts WHERE id=11402 FOR UPDATE");
        requests.push(admin.admin.confirmPost.mutate({ id: 11402 }));
        await waitForPostWriters(1);
        requests.push(
          admin.admin.updatePost.mutate({ id: 11402, status: "published" }),
        );
        await waitForPostWriters(2);
        await guard.commit();
        await Promise.all(requests);
        expect(transport.announcements).toEqual([
          { text: "Draft feed", id: 11402, target: "feed" },
        ]);
      } finally {
        await guard.rollback();
        await Promise.allSettled(requests);
        await guard.end();
      }
    });
  },
);
