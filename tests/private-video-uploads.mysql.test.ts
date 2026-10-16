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
    beforeAll(async () => {
      conn = await openContentTestDatabase();
      wire = await openPrivateUploadWire({ content: true });
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "vu1-native-fixture-session-secret-32-chars");
      vi.stubEnv("PRIVATE_POST_MEDIA_UPLOAD_ENABLED", "true");
      vi.stubEnv("S3_ENDPOINT", wire.endpoint);
      vi.stubEnv("S3_BUCKET", wire.bucket);
      vi.stubEnv("S3_ACCESS_KEY", "wire-fixture-access");
      vi.stubEnv("S3_SECRET_KEY", "wire-fixture-secret");
      await conn.query(
        "INSERT INTO users (id,openId,role) VALUES (97680,'vu1-admin','admin'),(97681,'vu1-other','admin')",
      );
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
      token = await sdk.createSessionToken("vu1-admin", { sessionVersion: 0 });
    });
    beforeEach(async () => {
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
    });
    afterAll(async () => {
      await app?.close();
      if (conn) {
        await conn.query(
          "DELETE FROM private_attachment_uploads WHERE actorUserId=97680",
        );
        await conn.query("DELETE FROM users WHERE id IN (97680,97681)");
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
      expect(responses.map((response) => response.status)).toEqual([
        200, 200, 200,
      ]);
      const receipts = await Promise.all(
        responses.map((response) => response.json()),
      );
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
  },
);
