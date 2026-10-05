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
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";

const transport = vi.hoisted(() => ({ announcements: [] as number[] }));
vi.mock("../apps/backend/src/push", () => ({
  sendMarketingPostNotification: async (_text: string, id: number) => {
    transport.announcements.push(id);
  },
}));
import { appRouter, type AppRouter } from "../apps/backend/src/routers";
import { createContext } from "../apps/backend/src/_core/context";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb } from "../apps/backend/src/db";

describe.skipIf(!testDatabaseUrl)(
  "idempotent post creation over real HTTP/JWT/MySQL",
  () => {
    let conn: Connection, server: Server, base: string, adminToken: string;
    let admin: ReturnType<typeof createTRPCProxyClient<AppRouter>>;
    const source = "backend-test-idempotent-create";
    const input = {
      text: "One creation intent",
      photos: [],
      tags: [],
      source,
      idempotencyKey: "post-intent-00000001",
    };
    const client = (token?: string, httpFetch: typeof fetch = fetch) =>
      createTRPCProxyClient<AppRouter>({
        links: [
          httpLink({
            url: `${base}/api/trpc`,
            transformer: superjson,
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            fetch: httpFetch,
          }),
        ],
      });
    async function cleanup() {
      // A joined DELETE scans/locks other suites' media before filtering by source.
      // Resolve our own IDs with a nonlocking read, then delete only those fixtures.
      const ownPosts = await created();
      if (ownPosts.length) {
        const ids = ownPosts.map((post) => post.id);
        const placeholders = ids.map(() => "?").join(",");
        await conn.query(
          `DELETE FROM post_media WHERE postId IN (${placeholders})`,
          ids,
        );
        await conn.query(
          `DELETE FROM posts WHERE id IN (${placeholders})`,
          ids,
        );
      }
      const [tables] = await conn.query<RowDataPacket[]>(
        "SHOW TABLES LIKE 'post_creation_requests'",
      );
      if (tables.length)
        await conn.query(
          "DELETE FROM post_creation_requests WHERE actorUserId IN (97401,97402,97403)",
        );
    }
    async function created() {
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT id,text FROM posts WHERE source=? ORDER BY id",
        [source],
      );
      return rows;
    }
    beforeAll(async () => {
      conn = await openContentTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "post-idempotency-test-secret-32-characters");
      await conn.query(`INSERT INTO users (id,openId,role) VALUES
      (97401,'idempotent-admin','admin'),(97402,'idempotent-other-admin','admin'),(97403,'idempotent-member','user')`);
      const app = express();
      app.use(
        "/api/trpc",
        createExpressMiddleware({ router: appRouter, createContext }),
      );
      server = await new Promise<Server>((resolve) => {
        const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
      });
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      adminToken = await sdk.createSessionToken("idempotent-admin", {
        sessionVersion: 0,
      });
      admin = client(adminToken);
    });
    beforeEach(async () => {
      await cleanup();
      transport.announcements.length = 0;
      await conn.query(
        "UPDATE users SET blockedAt=NULL,role='admin' WHERE id=97401",
      );
    });
    afterAll(async () => {
      await new Promise<void>((resolve) => server?.close(() => resolve()));
      await cleanup();
      await conn.query("DELETE FROM users WHERE id IN (97401,97402,97403)");
      await conn.end();
      const database = await getDb();
      await (
        database as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      vi.unstubAllEnvs();
    });
    it("returns the original numeric ID on a sequential retry without reannouncing", async () => {
      const id = await admin.admin.createPost.mutate(input);
      expect(await admin.admin.createPost.mutate(input)).toBe(id);
      expect(await created()).toEqual([{ id, text: "One creation intent" }]);
      expect(transport.announcements).toEqual([id]);
    });
    it("serializes concurrent identical requests into one committed post", async () => {
      const ids = await Promise.all(
        Array.from({ length: 12 }, () => admin.admin.createPost.mutate(input)),
      );
      expect(new Set(ids).size).toBe(1);
      expect(await created()).toEqual([
        { id: ids[0], text: "One creation intent" },
      ]);
      expect(transport.announcements).toEqual([ids[0]]);
    });
    it("waits for an in-flight owner and exposes neither the post nor the key before commit", async () => {
      const gate = "backend_test_idempotency_gate";
      const [lock] = await conn.query<RowDataPacket[]>(
        "SELECT GET_LOCK(?,3) acquired",
        [gate],
      );
      expect(lock[0].acquired).toBe(1);
      let ownsTrigger = false;
      const requests: Promise<number>[] = [];
      try {
        await conn.query(`CREATE TRIGGER backend_test_idempotency_gate BEFORE INSERT ON post_media FOR EACH ROW
        BEGIN IF NEW.url='https://assets.example.test/idempotent-gated.mp4' THEN
        SET @backend_test_gate=GET_LOCK('backend_test_idempotency_gate',5);
        DO RELEASE_LOCK('backend_test_idempotency_gate'); END IF; END`);
        ownsTrigger = true;
        const request = {
          ...input,
          videos: ["https://assets.example.test/idempotent-gated.mp4"],
        };
        requests.push(admin.admin.createPost.mutate(request));
        await vi.waitFor(
          async () => {
            const [waiting] = await conn.query<RowDataPacket[]>(
              "SELECT 1 FROM performance_schema.metadata_locks WHERE OBJECT_TYPE='USER LEVEL LOCK' AND OBJECT_NAME=? AND LOCK_STATUS='PENDING'",
              [gate],
            );
            expect(waiting.length).toBeGreaterThan(0);
          },
          { timeout: 3000, interval: 20 },
        );
        requests.push(admin.admin.createPost.mutate(request));
        await vi.waitFor(
          async () => {
            const [waiting] = await conn.query<RowDataPacket[]>(
              "SELECT 1 FROM performance_schema.data_lock_waits w JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID=w.REQUESTING_ENGINE_LOCK_ID AND l.ENGINE=w.ENGINE WHERE l.OBJECT_SCHEMA=DATABASE() AND l.OBJECT_NAME='post_creation_requests'",
            );
            expect(waiting.length).toBeGreaterThan(0);
          },
          { timeout: 3000, interval: 20 },
        );
        expect(await created()).toEqual([]);
        const [keys] = await conn.query<RowDataPacket[]>(
          "SELECT requestKey FROM post_creation_requests WHERE actorUserId=97401",
        );
        expect(keys).toEqual([]);
        expect(transport.announcements).toEqual([]);
        await conn.query("SELECT RELEASE_LOCK(?)", [gate]);
        const ids = await Promise.all(requests);
        expect(ids[1]).toBe(ids[0]);
        expect(await created()).toEqual([{ id: ids[0], text: input.text }]);
        const [media] = await conn.query<RowDataPacket[]>(
          "SELECT id FROM post_media WHERE postId=?",
          [ids[0]],
        );
        expect(media).toHaveLength(1);
        expect(transport.announcements).toEqual([ids[0]]);
      } finally {
        await conn.query("SELECT RELEASE_LOCK(?)", [gate]);
        await Promise.allSettled(requests);
        if (ownsTrigger)
          await conn.query("DROP TRIGGER backend_test_idempotency_gate");
      }
    });
    it("rejects a changed payload for a completed key without creating another post", async () => {
      const id = await admin.admin.createPost.mutate(input);
      await expect(
        admin.admin.createPost.mutate({ ...input, text: "Different intent" }),
      ).rejects.toMatchObject({ data: { code: "CONFLICT", httpStatus: 409 } });
      expect(await created()).toEqual([{ id, text: "One creation intent" }]);
      expect(transport.announcements).toEqual([id]);
    });
    it("replays a committed post after the client loses its successful HTTP response", async () => {
      const lossyClient = client(adminToken, async (url, options) => {
        const response = await fetch(url, options);
        expect(response.status).toBe(200);
        await response.body?.cancel();
        throw new Error("Simulated lost response after commit");
      });
      await expect(lossyClient.admin.createPost.mutate(input)).rejects.toThrow(
        "Simulated lost response",
      );
      const [post] = await created();
      expect(await admin.admin.createPost.mutate(input)).toBe(post.id);
      expect(await created()).toHaveLength(1);
      expect(transport.announcements).toEqual([post.id]);
    });

    it("one concurrent conflicting payload wins and the other receives 409", async () => {
      const results = await Promise.allSettled([
        admin.admin.createPost.mutate(input),
        admin.admin.createPost.mutate({
          ...input,
          text: "Other concurrent intent",
        }),
      ]);
      const successes = results.filter(
        (result) => result.status === "fulfilled",
      );
      const failures = results.filter((result) => result.status === "rejected");
      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      expect(failures[0].reason).toMatchObject({
        data: { code: "CONFLICT", httpStatus: 409 },
      });
      expect(await created()).toHaveLength(1);
      expect(transport.announcements).toEqual([successes[0].value]);
    });
    it("commits videos, audio and the durable request result once", async () => {
      const request = {
        ...input,
        videos: ["https://assets.example.test/lesson.mp4"],
        attachments: [
          {
            type: "audio" as const,
            url: "https://assets.example.test/lesson.mp3",
            filename: "Lesson.mp3",
            mimeType: "audio/mpeg",
            fileSize: 7,
          },
        ],
      };
      const id = await admin.admin.createPost.mutate(request);
      expect(await admin.admin.createPost.mutate(request)).toBe(id);
      const [media] = await conn.query<RowDataPacket[]>(
        "SELECT type FROM post_media WHERE postId=? ORDER BY id",
        [id],
      );
      expect(media.map((row) => row.type)).toEqual(["video", "audio"]);
      const [requests] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM post_creation_requests WHERE actorUserId=97401",
      );
      expect(requests).toHaveLength(1);
      expect(requests[0]).toMatchObject({ actorUserId: 97401, postId: id });
      expect(requests[0].requestKey).toMatch(/^[a-f0-9]{64}$/);
      expect(requests[0].payloadHash).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.stringify(requests)).not.toContain(input.idempotencyKey);
      expect(transport.announcements).toEqual([id]);
    });
    it("rolls back the key with failed media and permits a corrected retry", async () => {
      await expect(
        admin.admin.createPost.mutate({
          ...input,
          videos: [
            "https://assets.example.test/good.mp4",
            "https://assets.example.test/%ZZ.mp4",
          ],
        }),
      ).rejects.toThrow();
      expect(await created()).toEqual([]);
      const [requests] = await conn.query<RowDataPacket[]>(
        "SELECT requestKey FROM post_creation_requests WHERE actorUserId=97401",
      );
      expect(requests).toEqual([]);
      expect(transport.announcements).toEqual([]);
      const id = await admin.admin.createPost.mutate({
        ...input,
        text: "Corrected retry",
      });
      expect(await created()).toEqual([{ id, text: "Corrected retry" }]);
    });
    it("scopes the same client key separately for different authenticated administrators", async () => {
      const other = client(
        await sdk.createSessionToken("idempotent-other-admin", {
          sessionVersion: 0,
        }),
      );
      const ids = await Promise.all([
        admin.admin.createPost.mutate(input),
        other.admin.createPost.mutate(input),
      ]);
      expect(new Set(ids).size).toBe(2);
      expect(await created()).toHaveLength(2);
      expect(transport.announcements).toHaveLength(2);
    });
    it("treats distinct keys, including differently cased keys, as distinct intentions", async () => {
      const ids = await Promise.all([
        admin.admin.createPost.mutate(input),
        admin.admin.createPost.mutate({
          ...input,
          idempotencyKey: input.idempotencyKey.toUpperCase(),
        }),
      ]);
      expect(new Set(ids).size).toBe(2);
      expect(await created()).toHaveLength(2);
    });
    it("preserves old unkeyed calls as independent creates", async () => {
      const { idempotencyKey: _key, ...legacy } = input;
      const ids = await Promise.all([
        admin.admin.createPost.mutate(legacy),
        admin.admin.createPost.mutate(legacy),
      ]);
      expect(new Set(ids).size).toBe(2);
      expect(await created()).toHaveLength(2);
    });
    it("ignores object property order while preserving the same rich-text intent", async () => {
      const id = await admin.admin.createPost.mutate({
        ...input,
        richText: [
          { type: "paragraph", children: [{ text: input.text, bold: true }] },
        ],
      });
      expect(
        await admin.admin.createPost.mutate({
          ...input,
          richText: [
            { children: [{ bold: true, text: input.text }], type: "paragraph" },
          ],
        }),
      ).toBe(id);
      expect(await created()).toHaveLength(1);
    });
    it("applies existing schema defaults consistently on a retry", async () => {
      const id = await admin.admin.createPost.mutate(input);
      expect(
        await admin.admin.createPost.mutate({
          ...input,
          status: "published",
          published: true,
          sortOrder: 0,
          target: "feed",
        }),
      ).toBe(id);
    });
    it("preserves array order in the accepted intent", async () => {
      const photos = [
        "https://assets.example.test/first.jpg",
        "https://assets.example.test/second.jpg",
      ];
      const id = await admin.admin.createPost.mutate({ ...input, photos });
      await expect(
        admin.admin.createPost.mutate({
          ...input,
          photos: [...photos].reverse(),
        }),
      ).rejects.toMatchObject({ data: { code: "CONFLICT" } });
      expect(await created()).toEqual([{ id, text: input.text }]);
    });
    it("rejects non-JSON rich text before claiming a key", async () => {
      await expect(
        admin.admin.createPost.mutate({ ...input, richText: { amount: 1n } }),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } });
      expect(await created()).toEqual([]);
      const [keys] = await conn.query<RowDataPacket[]>(
        "SELECT requestKey FROM post_creation_requests WHERE actorUserId=97401",
      );
      expect(keys).toEqual([]);
      expect(transport.announcements).toEqual([]);
    });
    it.each([
      { photos: ["https://assets.example.test/photo.jpg"] },
      { videos: ["https://assets.example.test/video.mp4"] },
      {
        richText: [
          { type: "paragraph", children: [{ text: input.text, italic: true }] },
        ],
      },
      { target: "club" as const },
      { publishedAt: "2026-01-01T00:00:00Z" },
    ])(
      "guards all effect-bearing fields, not just text (%#)",
      async (change) => {
        const id = await admin.admin.createPost.mutate(input);
        await expect(
          admin.admin.createPost.mutate({ ...input, ...change }),
        ).rejects.toMatchObject({ data: { code: "CONFLICT" } });
        expect(await created()).toEqual([{ id, text: input.text }]);
      },
    );
    it.each([
      "",
      "too-short",
      " ".repeat(20),
      "x".repeat(129),
      "русский-ключ-запроса",
      null,
      123,
    ])("rejects malformed keys before writing anything (%#)", async (key) => {
      const invalid = {
        ...input,
        ...({ idempotencyKey: key } as Record<string, unknown>),
      };
      await expect(
        admin.admin.createPost.mutate(invalid),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } });
      expect(await created()).toEqual([]);
      expect(transport.announcements).toEqual([]);
    });
    it.each(["draft", "scheduled"] as const)(
      "replays a %s create without an announcement",
      async (status) => {
        const request = {
          ...input,
          status,
          scheduledAt: "2027-01-01T00:00:00Z",
        };
        const id = await admin.admin.createPost.mutate(request);
        expect(await admin.admin.createPost.mutate(request)).toBe(id);
        expect(transport.announcements).toEqual([]);
      },
    );
    it("does not resurrect a deleted post when its successful creation is replayed", async () => {
      const id = await admin.admin.createPost.mutate(input);
      await conn.query("DELETE FROM posts WHERE id=? AND source=?", [
        id,
        source,
      ]);
      expect(await admin.admin.createPost.mutate(input)).toBe(id);
      expect(await created()).toEqual([]);
      expect(transport.announcements).toEqual([id]);
    });
    it("does not revert an edited post when replaying its original creation", async () => {
      const id = await admin.admin.createPost.mutate(input);
      await conn.query(
        "UPDATE posts SET text='Later correction' WHERE id=? AND source=?",
        [id, source],
      );
      expect(await admin.admin.createPost.mutate(input)).toBe(id);
      expect(await created()).toEqual([{ id, text: "Later correction" }]);
    });
    it.each(["blocked", "demoted"])(
      "rechecks %s administrator access before replay",
      async (change) => {
        const id = await admin.admin.createPost.mutate(input);
        await conn.query(
          change === "blocked"
            ? "UPDATE users SET blockedAt=NOW() WHERE id=97401"
            : "UPDATE users SET role='user' WHERE id=97401",
        );
        await expect(
          admin.admin.createPost.mutate(input),
        ).rejects.toMatchObject({
          data: { code: change === "blocked" ? "UNAUTHORIZED" : "FORBIDDEN" },
        });
        expect(await created()).toEqual([{ id, text: input.text }]);
      },
    );
    it.each(["anonymous", "member"])(
      "does not let a %s use another administrator's completed key",
      async (role) => {
        const id = await admin.admin.createPost.mutate(input);
        const token =
          role === "member"
            ? await sdk.createSessionToken("idempotent-member", {
                sessionVersion: 0,
              })
            : undefined;
        await expect(
          client(token).admin.createPost.mutate(input),
        ).rejects.toMatchObject({
          data: { code: role === "member" ? "FORBIDDEN" : "UNAUTHORIZED" },
        });
        expect(await created()).toEqual([{ id, text: input.text }]);
      },
    );
  },
);
