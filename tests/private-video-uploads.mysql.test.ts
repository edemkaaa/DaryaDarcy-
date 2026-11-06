import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Connection, RowDataPacket } from "mysql2/promise";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { request as rawRequest } from "node:http";
import superjson from "superjson";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openPrivateUploadWire } from "./helpers/private-upload-wire";
import {
  mp4Fixture,
  movFixture,
  audioWebmFixture,
  mp3Fixture,
} from "./helpers/media-fixtures";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb } from "../apps/backend/src/db";

// Real HTTP/JWT/SQL/AWS SDK; loopback object transport is NOT provider ACL acceptance.
describe.skipIf(!testDatabaseUrl)(
  "private video upload HTTP/SQL recovery",
  () => {
    let conn: Connection, app: INestApplication, base: string, token: string;
    let wire: Awaited<ReturnType<typeof openPrivateUploadWire>>;
    const key = "vu1-original-video-intent";
    const rows = async () =>
      (
        await conn.query<RowDataPacket[]>(
          "SELECT * FROM private_attachment_uploads WHERE actorUserId=97680",
        )
      )[0];
    async function upload(
      bytes = mp4Fixture,
      mime = "video/mp4",
      idempotencyKey: string | null = key,
      bearer: string | null = token,
      query = "filename=lesson.mp4",
    ) {
      return fetch(`${base}/api/admin/private-video-uploads?${query}`, {
        method: "POST",
        headers: {
          "content-type": mime,
          ...(idempotencyKey === null
            ? {}
            : { "Idempotency-Key": idempotencyKey }),
          ...(bearer === null ? {} : { authorization: `Bearer ${bearer}` }),
        },
        body: new Uint8Array(bytes),
        signal: AbortSignal.timeout(20000),
      });
    }
    async function status(bearer = token) {
      const input = encodeURIComponent(
        superjson.stringify({ idempotencyKey: key }),
      );
      const response = await fetch(
        `${base}/api/trpc/admin.privateAttachmentStatus?input=${input}`,
        { headers: { authorization: `Bearer ${bearer}` } },
      );
      const json = await response.json();
      return {
        status: response.status,
        data: json.result ? superjson.deserialize(json.result.data) : undefined,
      };
    }
    async function write(method: string, input: unknown) {
      const response = await fetch(`${base}/api/trpc/admin.${method}`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: superjson.stringify(input),
      });
      const json = await response.json();
      return {
        status: response.status,
        data: json.result ? superjson.deserialize(json.result.data) : undefined,
      };
    }
    const postInput = (assetId: string) => ({
      text: "VU private video",
      photos: [],
      tags: [],
      source: "vu1-video-suite",
      target: "club",
      status: "draft",
      idempotencyKey: "vu2-original-post-intent",
      privateAssetIds: [assetId],
    });
    async function cleanupPosts() {
      await conn.query(
        "DELETE m FROM post_media m JOIN posts p ON p.id=m.postId WHERE p.source='vu1-video-suite'",
      );
      await conn.query("DELETE FROM posts WHERE source='vu1-video-suite'");
      await conn.query(
        "DELETE FROM post_creation_requests WHERE actorUserId=97680",
      );
    }
    beforeAll(async () => {
      conn = await openContentTestDatabase();
      await conn.query(
        "CREATE TABLE IF NOT EXISTS push_consent_events (id INT AUTO_INCREMENT PRIMARY KEY,userId INT NOT NULL,consentType ENUM('service','marketing') NOT NULL,status ENUM('granted','revoked') NOT NULL,consentVersion VARCHAR(32) NOT NULL,consentText TEXT,platform VARCHAR(16),createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB",
      );
      wire = await openPrivateUploadWire({ content: true });
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "vu1-native-fixture-session-secret-32-chars");
      vi.stubEnv("PRIVATE_POST_MEDIA_UPLOAD_ENABLED", "true");
      vi.stubEnv("S3_ENDPOINT", wire.endpoint);
      vi.stubEnv("S3_BUCKET", wire.bucket);
      vi.stubEnv("S3_ACCESS_KEY", "wire-fixture-access");
      vi.stubEnv("S3_SECRET_KEY", "wire-fixture-secret");
      await conn.query(
        "INSERT INTO users (id,openId,role) VALUES (97680,'vu1-admin','admin'),(97681,'vu1-other','admin'),(97682,'vu2-paid','user')",
      );
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
      token = await sdk.createSessionToken("vu1-admin", { sessionVersion: 0 });
    });
    beforeEach(async () => {
      await cleanupPosts();
      await conn.query("DELETE FROM club_payments WHERE userId=97682");
      await conn.query(
        "DELETE FROM private_attachment_uploads WHERE actorUserId=97680",
      );
      await conn.query(
        "UPDATE users SET role='admin',blockedAt=NULL,sessionVersion=0 WHERE id=97680",
      );
      wire.objects.clear();
      wire.effects.length = 0;
      wire.rejectPolicy(false);
      vi.stubEnv("PRIVATE_POST_VIDEO_UPLOAD_ENABLED", "true");
      vi.stubEnv("PRIVATE_POST_MEDIA_UPLOAD_ENABLED", "true");
      vi.stubEnv("PRIVATE_POST_MEDIA_DELIVERY_ENABLED", "true");
    });
    afterAll(async () => {
      await app?.close();
      if (conn) {
        await cleanupPosts();
        await conn.query("DELETE FROM club_payments WHERE userId=97682");
        await conn.query(
          "DELETE FROM private_attachment_uploads WHERE actorUserId=97680",
        );
        await conn.query("DELETE FROM users WHERE id IN (97680,97681,97682)");
        await conn.end();
      }
      if (app)
        await (
          (await getDb()) as unknown as { $client: { end(): Promise<void> } }
        )?.$client.end();
      await wire?.close();
      vi.unstubAllEnvs();
    });
    it.each([
      [mp4Fixture, "video/mp4"],
      [movFixture, "video/quicktime"],
      [audioWebmFixture, "video/webm"],
    ] as const)(
      "keeps canonical video bytes private and replays one asset",
      async (bytes, mime) => {
        const response = await upload(bytes, "application/octet-stream");
        expect(response.status).toBe(200);
        const receipt = await response.json();
        expect(receipt).toEqual({
          state: "ready",
          assetId: expect.any(String),
          type: "video",
          filename: "lesson.mp4",
          mimeType: mime,
          fileSize: bytes.length,
        });
        expect(
          await (await upload(bytes, "application/octet-stream")).json(),
        ).toEqual(receipt);
        expect(await status()).toEqual({ status: 200, data: receipt });
        expect(await rows()).toHaveLength(1);
        expect(wire.objects.size).toBe(1);
        expect([...wire.objects.keys()]).toEqual([
          `content/private-v1/${receipt.assetId}`,
        ]);
        expect([...wire.objects.values()][0].bytes).toEqual(bytes);
        expect(
          wire.effects.filter((effect) => effect.startsWith("PUT ")),
        ).toHaveLength(1);
      },
    );
    it("recovers a lost PUT acknowledgement from durable pending evidence without a second PUT", async () => {
      wire.dropPutAck();
      expect((await upload()).status).toBe(503);
      const [intent] = await rows();
      expect(intent.state).toBe("pending");
      expect(intent.etag).toBeNull();
      expect((await status()).data).toMatchObject({
        state: "pending",
        assetId: intent.assetId,
        type: "video",
      });
      expect((await upload()).status).toBe(200);
      expect((await rows())[0]).toMatchObject({
        assetId: intent.assetId,
        state: "ready",
      });
      expect(
        wire.effects.filter((effect) => effect.startsWith("PUT ")),
      ).toHaveLength(1);
    });
    it("cancels a slow S3 request on HTTP disconnect and recovers an accepted object without another PUT", async () => {
      const gate = wire.pausePut();
      const client = rawRequest(`${base}/api/admin/private-video-uploads?filename=lesson.mp4`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "video/mp4", "idempotency-key": key },
      });
      client.on("error", () => {});
      client.end(mp4Fixture);
      try {
        await gate.entered;
        client.destroy();
        await vi.waitFor(() => expect(gate.isDisconnected()).toBe(true), { timeout: 1500 });
        const [intent] = await rows();
        expect(intent.state).toBe("pending");
        expect((await status()).data).toMatchObject({ state: "pending", assetId: intent.assetId });
        // The provider may accept bytes even after its response socket closes.
        gate.release();
        await vi.waitFor(() => expect(wire.objects.size).toBe(1));
        const resumed = await upload();
        expect(resumed.status).toBe(200);
        expect(await resumed.json()).toMatchObject({ state: "ready", assetId: intent.assetId });
        expect(await rows()).toHaveLength(1);
        expect(wire.effects.filter(effect => effect.startsWith("PUT "))).toHaveLength(1);
      } finally {
        client.destroy();
        gate.release();
        // Await the synthetic provider completion even on a failing assertion.
        await vi.waitFor(() => expect(wire.objects.size).toBe(1));
      }
    });
    it("rejects changed bytes and filenames under the original key", async () => {
      expect((await upload()).status).toBe(200);
      expect((await upload(movFixture)).status).toBe(409);
      expect(
        (
          await upload(
            mp4Fixture,
            "video/mp4",
            key,
            token,
            "filename=changed.mp4",
          )
        ).status,
      ).toBe(409);
      expect(await rows()).toHaveLength(1);
      expect(wire.objects.size).toBe(1);
    });
    it("isolates status from another account and converges simultaneous same-key uploads", async () => {
      const responses = await Promise.all([upload(), upload(), upload()]);
      expect(responses.map(response => response.status).sort()).toEqual([200, 429, 429]);
      const receipts = [];
      for (let response of responses) {
        if (response.status === 429) {
          expect(response.headers.get("retry-after")).toBe("2");
          await response.json();
          response = await upload();
          expect(response.status).toBe(200);
        }
        receipts.push(await response.json());
      }
      expect(receipts[1]).toEqual(receipts[0]);
      expect(receipts[2]).toEqual(receipts[0]);
      const other = await sdk.createSessionToken("vu1-other", {
        sessionVersion: 0,
      });
      expect(await status(other)).toEqual({
        status: 200,
        data: { state: "notRecorded" },
      });
      expect(await rows()).toHaveLength(1);
      expect(wire.objects.size).toBe(1);
    });
    it.each([Buffer.from("<svg>not video</svg>"), mp3Fixture, Buffer.alloc(0)])(
      "rejects non-video before ledger/storage effects",
      async (bytes) => {
        expect((await upload(bytes)).status).toBe(400);
        expect(await rows()).toEqual([]);
        expect(wire.effects).toEqual([]);
      },
    );
    it.each([null, "short"])(
      "requires a stable valid key before recording intent",
      async (invalid) => {
        expect((await upload(mp4Fixture, "video/mp4", invalid)).status).toBe(
          400,
        );
        expect(await rows()).toEqual([]);
        expect(wire.effects).toEqual([]);
      },
    );
    it("defaults off, and never falls back when storage policy is unavailable", async () => {
      vi.stubEnv("PRIVATE_POST_VIDEO_UPLOAD_ENABLED", "false");
      expect((await upload()).status).toBe(404);
      expect(await rows()).toEqual([]);
      vi.stubEnv("PRIVATE_POST_VIDEO_UPLOAD_ENABLED", "true");
      wire.rejectPolicy(true);
      expect((await upload()).status).toBe(503);
      expect((await rows())[0].state).toBe("pending");
      expect(wire.objects.size).toBe(0);
    });
    it.each([
      ["role='user'", 403],
      ["blockedAt=NOW()", 401],
      ["sessionVersion=1", 401],
    ] as const)(
      "denies stale access before bytes/storage: %s",
      async (patch, code) => {
        await conn.query(`UPDATE users SET ${patch} WHERE id=97680`);
        expect((await upload()).status).toBe(code);
        expect(await rows()).toEqual([]);
        expect(wire.effects).toEqual([]);
      },
    );
    it("keeps the 80MiB bound without a durable intent", async () => {
      expect((await upload(Buffer.alloc(80 * 1024 * 1024 + 1))).status).toBe(
        413,
      );
      expect(await rows()).toEqual([]);
      expect(wire.effects).toEqual([]);
    });
    it.each([
      "filename=a.mp4&mimeType=video/mp4",
      "filename=a.mp4&filename=b.mp4",
      "filename=a.mp4&extra=1",
      "",
    ])("rejects ambiguous metadata query: %s", async (query) => {
      expect(
        (await upload(mp4Fixture, "video/mp4", key, token, query)).status,
      ).toBe(400);
      expect(await rows()).toEqual([]);
      expect(wire.effects).toEqual([]);
    });
    it("rechecks account revocation while an authenticated raw body is still streaming", async () => {
      let admit!: () => void;
      const admitted = new Promise<void>((resolve) => {
        admit = resolve;
      });
      const authenticate = sdk.authenticateRequest.bind(sdk);
      const observer = vi
        .spyOn(sdk, "authenticateRequest")
        .mockImplementation(async (req) => {
          const user = await authenticate(req);
          admit();
          return user;
        });
      const client = rawRequest(
        `${base}/api/admin/private-video-uploads?filename=lesson.mp4`,
        {
          method: "POST",
          signal: AbortSignal.timeout(5000),
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "video/mp4",
            "content-length": mp4Fixture.length,
            "idempotency-key": key,
          },
        },
      );
      const response = new Promise<number | undefined>((resolve, reject) => {
        client.on("error", reject);
        client.on("response", (res) => {
          res.resume();
          res.on("end", () => resolve(res.statusCode));
        });
      });
      try {
        client.write(mp4Fixture.subarray(0, 8));
        await Promise.race([
          admitted,
          response.then(() => {
            throw new Error("Premature reply");
          }),
        ]);
        await conn.query("UPDATE users SET sessionVersion=1 WHERE id=97680");
        client.end(mp4Fixture.subarray(8));
        expect(await response).toBe(401);
        expect(await rows()).toEqual([]);
        expect(wire.effects).toEqual([]);
      } finally {
        client.destroy();
        observer.mockRestore();
      }
    });
    it("binds once, gates draft/club/expiry reads and revokes an explicitly removed video", async () => {
      const uploaded = await (await upload()).json();
      const input = postInput(uploaded.assetId);
      const created = await write("createPost", input);
      expect(created.status).toBe(200);
      expect(await write("createPost", input)).toEqual(created);
      const [asset] = await rows();
      const path = `${base}/api/media/post-attachments/${asset.mediaId}`;
      expect(
        await conn
          .query<
            RowDataPacket[]
          >("SELECT id FROM post_media WHERE postId=?", [asset.postId])
          .then(([rows]) => rows),
      ).toHaveLength(1);
      expect((await fetch(path)).status).toBe(404);
      expect(
        (await write("updatePost", { id: asset.postId, status: "published" }))
          .status,
      ).toBe(200);
      const member = await sdk.createSessionToken("vu2-paid", {
        sessionVersion: 0,
      });
      const headers = { authorization: `Bearer ${member}` };
      const deniedEffects = wire.effects.length;
      expect((await fetch(path, { headers })).status).toBe(404);
      expect(wire.effects.length).toBe(deniedEffects);
      await conn.query(
        "INSERT INTO club_payments(userId,orderId,status,expiresAt) VALUES(97682,'vu2-paid-order','paid',DATE_ADD(NOW(),INTERVAL 1 DAY))",
      );
      const response = await fetch(path, { headers });
      expect(response.status).toBe(200);
      expect(Buffer.from(await response.arrayBuffer())).toEqual(mp4Fixture);
      expect(response.headers.get("content-type")).toBe("video/mp4");
      expect(response.headers.get("cache-control")).toContain("no-store");
      expect((await fetch(path, { method: "HEAD", headers })).status).toBe(200);
      const range = await fetch(path, {
        headers: { ...headers, range: "bytes=2-5" },
      });
      expect(range.status).toBe(206);
      expect(Buffer.from(await range.arrayBuffer())).toEqual(
        mp4Fixture.subarray(2, 6),
      );
      await conn.query(
        "UPDATE club_payments SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE userId=97682",
      );
      const beforeDenied = wire.effects.length;
      expect((await fetch(path, { headers })).status).toBe(404);
      expect((await fetch(path, { method: "HEAD", headers })).status).toBe(404);
      expect(wire.effects.length).toBe(beforeDenied);
      expect(
        (
          await write("updatePost", {
            id: asset.postId,
            removedMediaIds: [asset.mediaId],
          })
        ).status,
      ).toBe(200);
      expect(
        (await fetch(path, { headers: { authorization: `Bearer ${token}` } }))
          .status,
      ).toBe(404);
      expect(
        (
          await write("updatePost", {
            id: asset.postId,
            privateAssetIds: [uploaded.assetId],
          })
        ).status,
      ).toBe(409);
    });
    it("does not detach a private video when legacy videos[] is saved without it", async () => {
      const uploaded = await (await upload()).json();
      expect(
        (await write("createPost", postInput(uploaded.assetId))).status,
      ).toBe(200);
      const [asset] = await rows();
      expect(
        (
          await write("updatePost", {
            id: asset.postId,
            videos: ["https://vkvideo.ru/video-123_456"],
          })
        ).status,
      ).toBe(200);
      const [media] = await conn.query<RowDataPacket[]>(
        "SELECT id,type,url,mimeType,fileSize FROM post_media WHERE postId=? ORDER BY id",
        [asset.postId],
      );
      expect(media).toHaveLength(2);
      expect(media[0]).toEqual({
        id: asset.mediaId,
        type: "video",
        url: `/api/media/post-attachments/${asset.mediaId}`,
        mimeType: "video/mp4",
        fileSize: mp4Fixture.length,
      });
      expect(
        (await write("updatePost", { id: asset.postId, videos: [] })).status,
      ).toBe(200);
      expect(
        (
          await conn.query<RowDataPacket[]>(
            "SELECT id FROM post_media WHERE postId=?",
            [asset.postId],
          )
        )[0],
      ).toEqual([{ id: asset.mediaId }]);
    });
    it("keeps legacy video removal validation independent of private storage configuration", async () => {
      expect((await write("createPost",{...postInput("unused"),privateAssetIds:[],videos:["https://vkvideo.ru/video-123_456"]})).status).toBe(200);
      const [[media]] = await conn.query<RowDataPacket[]>("SELECT m.id,m.postId FROM post_media m JOIN posts p ON p.id=m.postId WHERE p.source='vu1-video-suite'");
      vi.stubEnv("S3_ENDPOINT", "");
      try { expect((await write("updatePost",{id:media.postId,removedMediaIds:[media.id]})).status).toBe(400); }
      finally { vi.stubEnv("S3_ENDPOINT",wire.endpoint); }
    });
    it.each([
      "/api/media/post-attachments/123",
      "https://assets.example.test/content/private-v1/123",
      "https://assets.example.test/%63ontent/private-v1/123",
    ])(
      "rejects unowned reserved video URL without creating a post: %s",
      async (url) => {
        const result = await write("createPost", {
          ...postInput("unused"),
          privateAssetIds: [],
          videos: [url],
        });
        expect(result.status).toBe(400);
        expect(
          (
            await conn.query<RowDataPacket[]>(
              "SELECT id FROM posts WHERE source='vu1-video-suite'",
            )
          )[0],
        ).toEqual([]);
      },
    );
  },
);
