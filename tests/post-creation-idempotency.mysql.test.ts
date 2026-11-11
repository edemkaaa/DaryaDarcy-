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
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";

const transport = vi.hoisted(() => ({ announcements: [] as number[] }));
const stableVkCover = "https://s3.twcstorage.ru/daryadarcy-s3/covers/vk-v1/fixture.webp";
vi.mock("../apps/backend/src/media/vk-poster-object", () => ({
  saveVkPoster: async () => "https://s3.twcstorage.ru/daryadarcy-s3/covers/vk-v1/fixture.webp",
}));
vi.mock("../apps/backend/src/push", () => ({
  sendMarketingPostNotification: async (_text: string, id: number) => {
    transport.announcements.push(id);
  },
}));
import type { AppRouter } from "../apps/backend/src/routers";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb } from "../apps/backend/src/db";
import { compactContentRecovery } from "../apps/backend/src/content/recovery-compaction";

describe.skipIf(!testDatabaseUrl)(
  "idempotent post creation over real HTTP/JWT/MySQL",
  () => {
    let conn: Connection,
      application: INestApplication,
      base: string,
      adminToken: string;
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
      await conn.query(
        "DELETE FROM content_recovery_markers WHERE kind='post' AND actorUserId IN (97401,97402,97403)",
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
      // These suites deliberately stall media transactions with database triggers.
      // Share fixture ownership so another suite cannot insert into their locked
      // media gaps; concurrent requests within each suite remain unmodified.
      const [locks] = await conn.query<RowDataPacket[]>(
        "SELECT GET_LOCK('backend_test_post_publication',30) AS acquired",
      );
      expect(locks[0].acquired).toBe(1);
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "post-idempotency-test-secret-32-characters");
      await conn.query(`INSERT INTO users (id,openId,role) VALUES
      (97401,'idempotent-admin','admin'),(97402,'idempotent-other-admin','admin'),(97403,'idempotent-member','user')`);
      application = await createBackendApplication();
      await application.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
      adminToken = await sdk.createSessionToken("idempotent-admin", {
        sessionVersion: 0,
      });
      admin = client(adminToken);
    }, 35_000);
    beforeEach(async () => {
      await cleanup();
      vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "false");
      transport.announcements.length = 0;
      await conn.query(
        "UPDATE users SET blockedAt=NULL,role='admin',sessionVersion=0 WHERE id=97401",
      );
    });
    afterAll(async () => {
      await application?.close();
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
    const vk = "https://vkvideo.ru/video_ext.php?oid=-211171256&id=456239243&hash=a1b2c3d4e5f60708&autoplay=0";
    const vkCover = "https://sun9.userapi.com/vk.jpg?size=1280x720&sign=original";
    function provider(response: () => Response) {
      const nativeFetch = globalThis.fetch;
      return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, options) => {
        const address = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (new URL(address).origin === "https://vk.com") return response();
        if (new URL(address).hostname === "sun9.userapi.com")
          return new Response(new Uint8Array([255,216,255,0]), { headers: { "Content-Type": "image/jpeg" } });
        return nativeFetch(input, options);
      });
    }
    function vkPage(cover: string) {
      return new Response("window.cur = Object.assign(window.cur || {}, " + JSON.stringify({
        apiPrefetchCache: [{ method: "video.get", response: { items: [{
          owner_id: -211171256, id: 456239243,
          image: [{ url: cover, width: 1280, height: 720 }],
        }] } }],
      }) + ", {screen: 'embed'});");
    }
    it("returns an automatic VK cover through real HTTP/SQL and preserves it on retry/edit", async () => {
      let cover = vkCover;
      const external = provider(() => vkPage(cover));
      try {
        const request = { ...input, published: false, status: "draft" as const, videos: [vk] };
        const id = await admin.admin.createPost.mutate(request);
        cover = vkCover.replace("original", "changed");
        expect(await admin.admin.createPost.mutate(request)).toBe(id);
        const detail = await admin.admin.postDetail.query({ id });
        expect(detail?.media).toHaveLength(1);
        expect(detail?.media[0]).toMatchObject({ url: vk, posterUrl: stableVkCover });
        await admin.admin.updatePost.mutate({ id, videos: [vk], text: "Edited VK",
          expectedRevision: detail!.editRevision });
        const edited = await admin.admin.postDetail.query({ id });
        expect(edited?.media).toEqual(detail?.media);
        expect(await created()).toEqual([{ id, text: "Edited VK" }]);
        expect(transport.announcements).toEqual([]);
      } finally { external.mockRestore(); }
    });
    it("fills a missing VK cover on explicit video edit without replacing the attachment", async () => {
      let denied = true;
      const external = provider(() => denied ? new Response("Denied", { status: 403 }) : vkPage(vkCover));
      try {
        const id = await admin.admin.createPost.mutate({ ...input, published: false, videos: [vk] });
        const before = await admin.admin.postDetail.query({ id });
        expect(before?.media[0]?.posterUrl).toBeNull();
        denied = false;
        await admin.admin.updatePost.mutate({ id, videos: [vk], expectedRevision: before!.editRevision });
        const after = await admin.admin.postDetail.query({ id });
        expect(after?.media[0]).toEqual({ ...before?.media[0], posterUrl: stableVkCover });
        expect(transport.announcements).toEqual([]);
      } finally { external.mockRestore(); }
    });
    it("preserves existing photo-as-cover without a VK request", async () => {
      let requests = 0;
      const external = provider(() => { requests++; return vkPage(vkCover); });
      try {
        const photos = ["https://assets.example.test/manual-cover.jpg"];
        const id = await admin.admin.createPost.mutate({ ...input, published: false, videos: [vk], photos });
        const detail = await admin.admin.postDetail.query({ id });
        expect(detail?.photos).toEqual(photos);
        expect(detail?.media[0]?.posterUrl).toBeNull();
        await admin.admin.updatePost.mutate({ id, videos: [vk], photos, expectedRevision: detail!.editRevision });
        expect(requests).toBe(0);
      } finally { external.mockRestore(); }
    });
    it("exposes the VK poster to both Club and feed readers after publication", async () => {
      const external = provider(() => vkPage(vkCover));
      try {
        const id = await admin.admin.createPost.mutate({ ...input, target: "both", videos: [vk] });
        const clubPage = await admin.club.list.query({ limit: 200 });
        expect(clubPage.posts.find(post => post.id === id)?.media[0]?.posterUrl).toBe(stableVkCover);
        const post = await admin.feed.getById.query({ id });
        expect(post?.media[0]?.posterUrl).toBe(stableVkCover);
        expect(transport.announcements).toEqual([id]);
      } finally { external.mockRestore(); }
    });
    it("refuses expired keyed creation without duplicating the post", async () => {
      const id = await admin.admin.createPost.mutate(input);
      await conn.query(
        "UPDATE post_creation_requests SET createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=97401",
      );
      vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "true");
      await expect(admin.admin.createPost.mutate(input)).rejects.toMatchObject({
        data: { code: "CONFLICT", httpStatus: 409 },
      });
      expect(await created()).toEqual([{ id, text: "One creation intent" }]);
      expect(transport.announcements).toEqual([id]);
    });
    it("disabled expiry preserves aged keyed post recovery", async () => {
      const id = await admin.admin.createPost.mutate(input);
      await conn.query(
        "UPDATE post_creation_requests SET createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=97401",
      );
      expect(await admin.admin.createPost.mutate(input)).toBe(id);
      expect(await created()).toEqual([{ id, text: "One creation intent" }]);
      expect(transport.announcements).toEqual([id]);
    });
    it("a compacted intent never becomes new when expiry is switched off", async () => {
      const id = await admin.admin.createPost.mutate(input);
      await conn.query(
        "UPDATE post_creation_requests SET createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=97401",
      );
      vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "true");
      vi.stubEnv("CONTENT_RECOVERY_MAINTENANCE_ENABLED", "true");
      expect((await compactContentRecovery((await getDb())!)).post).toBe(1);
      vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "false");
      await expect(admin.admin.createPost.mutate(input)).rejects.toMatchObject({
        data: { code: "CONFLICT", httpStatus: 409 },
      });
      expect(await created()).toEqual([{ id, text: "One creation intent" }]);
      const [keys] = await conn.query<RowDataPacket[]>(
        "SELECT requestKey FROM post_creation_requests WHERE actorUserId=97401",
      );
      expect(keys).toEqual([]);
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
              "SELECT 1 FROM performance_schema.data_lock_waits w JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID=w.REQUESTING_ENGINE_LOCK_ID AND l.ENGINE=w.ENGINE WHERE l.OBJECT_SCHEMA=DATABASE() AND l.OBJECT_NAME='users' AND l.LOCK_DATA='97401'",
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
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST", httpStatus: 400 } });
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
    it("rejects a revoked session before replaying a committed creation", async () => {
      const id = await admin.admin.createPost.mutate(input);
      await conn.query("UPDATE users SET sessionVersion=1 WHERE id=97401");
      await expect(admin.admin.createPost.mutate(input)).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED", httpStatus: 401 },
      });
      expect(await created()).toEqual([{ id, text: "One creation intent" }]);
      expect(transport.announcements).toEqual([id]);
    });
  },
);
