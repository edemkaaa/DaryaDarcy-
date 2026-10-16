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
import superjson from "superjson";
import sharp from "sharp";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openPrivateUploadWire } from "./helpers/private-upload-wire";
import { mp4Fixture } from "./helpers/media-fixtures";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb } from "../apps/backend/src/db";

describe.skipIf(!testDatabaseUrl)(
  "private video poster association HTTP/SQL",
  () => {
    let conn: Connection,
      app: INestApplication,
      base: string,
      token: string,
      other: string;
    let wire: Awaited<ReturnType<typeof openPrivateUploadWire>>;
    async function call(
      method: string,
      input: unknown,
      query = false,
      bearer = token,
    ) {
      const encoded = superjson.stringify(input);
      const response = await fetch(
        `${base}/api/trpc/admin.${method}${query ? `?input=${encodeURIComponent(encoded)}` : ""}`,
        {
          method: query ? "GET" : "POST",
          headers: {
            authorization: `Bearer ${bearer}`,
            "content-type": "application/json",
          },
          ...(query ? {} : { body: encoded }),
        },
      );
      const json = await response.json();
      return {
        status: response.status,
        data: json.result
          ? superjson.deserialize<any>(json.result.data)
          : undefined,
      };
    }
    async function video() {
      const response = await fetch(
        `${base}/api/admin/private-video-uploads?filename=video.mp4`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "video/mp4",
            "idempotency-key": "vu2b-video-original-key",
          },
          body: new Uint8Array(mp4Fixture),
        },
      );
      expect(response.status).toBe(200);
      return response.json();
    }
    async function photo(
      key = "vu2b-poster-original-key",
      usage = "postPhoto",
      bearer = token,
    ) {
      const bytes = await sharp({
        create: { width: 2, height: 3, channels: 3, background: "red" },
      })
        .png()
        .toBuffer();
      const result = await call(
        "uploadPrivateContentFile",
        {
          idempotencyKey: key,
          usage,
          filename: "poster.png",
          mimeType: "image/png",
          base64: bytes.toString("base64"),
        },
        false,
        bearer,
      );
      expect(result.status).toBe(200);
      return result.data;
    }
    const input = (videoAssetId: string, posterAssetId: string) => ({
      text: "VU2 private poster",
      photos: [],
      tags: [],
      source: "vu2b-video-suite",
      target: "club",
      status: "draft",
      idempotencyKey: "vu2b-post-original-key",
      privateAssetIds: [videoAssetId],
      privateVideoPosters: [{ videoAssetId, posterAssetId }],
    });
    async function clear() {
      await conn.query(
        "DELETE m FROM post_media m JOIN posts p ON p.id=m.postId WHERE p.source='vu2b-video-suite'",
      );
      await conn.query("DELETE FROM posts WHERE source='vu2b-video-suite'");
      for (const table of [
        "post_creation_requests",
        "private_attachment_uploads",
        "private_content_files",
      ])
        await conn.query(
          `DELETE FROM ${table} WHERE actorUserId IN (97690,97691)`,
        );
    }
    beforeAll(async () => {
      conn = await openContentTestDatabase();
      wire = await openPrivateUploadWire({ content: true });
      for (const [key, value] of Object.entries({
        DATABASE_URL: testDatabaseUrl!,
        JWT_SECRET: "vu2b-native-session-fixture-secret-32-chars",
        PRIVATE_POST_MEDIA_UPLOAD_ENABLED: "true",
        PRIVATE_POST_VIDEO_UPLOAD_ENABLED: "true",
        PRIVATE_POST_MEDIA_DELIVERY_ENABLED: "true",
        PRIVATE_CONTENT_FILES_ENABLED: "true",
        S3_ENDPOINT: wire.endpoint,
        S3_BUCKET: wire.bucket,
        S3_ACCESS_KEY: "wire-fixture-access",
        S3_SECRET_KEY: "wire-fixture-secret",
      }))
        vi.stubEnv(key, value);
      await conn.query(
        "INSERT INTO users(id,openId,role) VALUES(97690,'vu2b-admin','admin'),(97691,'vu2b-other','admin')",
      );
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
      token = await sdk.createSessionToken("vu2b-admin", { sessionVersion: 0 });
      other = await sdk.createSessionToken("vu2b-other", { sessionVersion: 0 });
    });
    beforeEach(async () => {
      await clear();
      wire.objects.clear();
      wire.effects.length = 0;
    });
    afterAll(async () => {
      await app?.close();
      if (conn) {
        await clear();
        await conn.query("DELETE FROM users WHERE id IN (97690,97691)");
        await conn.end();
      }
      if (app)
        await (
          (await getDb()) as unknown as { $client: { end(): Promise<void> } }
        )?.$client.end();
      await wire?.close();
      vi.unstubAllEnvs();
    });
    it("binds an explicit private poster atomically, retains it on unrelated edits and revokes it with the video", async () => {
      const v = await video(),
        p = await photo();
      const request = input(v.assetId, p.assetId);
      const made = await call("createPost", request);
      expect(made.status).toBe(200);
      expect(await call("createPost", request)).toEqual(made);
      const [[post]] = await conn.query<RowDataPacket[]>(
        "SELECT tags FROM posts WHERE id=?",
        [made.data],
      );
      expect(post.tags).toEqual(["video"]);
      const media = await call("getPostMedia", { postId: made.data }, true);
      expect(media.data).toHaveLength(1);
      expect(media.data[0].posterUrl).toBe(p.url);
      expect((await fetch(base + p.url)).status).toBe(404);
      expect(
        (await call("updatePost", { id: made.data, status: "published" }))
          .status,
      ).toBe(200);
      const deniedEffects = wire.effects.length;
      expect((await fetch(base + p.url)).status).toBe(404);
      expect(wire.effects.length).toBe(deniedEffects);
      expect(
        (
          await fetch(base + p.url, {
            method: "HEAD",
            headers: { authorization: `Bearer ${token}` },
          })
        ).status,
      ).toBe(200);
      expect(
        (await call("updatePost", { id: made.data, target: "feed" })).status,
      ).toBe(200);
      const response = await fetch(base + p.url);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/webp");
      expect(response.headers.get("cache-control")).toContain("no-store");
      await response.arrayBuffer();
      expect(
        (
          await call("updatePost", {
            id: made.data,
            photos: [],
            text: "Unrelated edit",
          })
        ).status,
      ).toBe(200);
      expect((await fetch(base + p.url, { method: "HEAD" })).status).toBe(200);
      expect(
        (
          await call("updatePost", {
            id: made.data,
            removedMediaIds: [media.data[0].id],
          })
        ).status,
      ).toBe(200);
      const effects = wire.effects.length;
      expect((await fetch(base + p.url)).status).toBe(404);
      expect(wire.effects.length).toBe(effects);
      const [[poster]] = await conn.query<RowDataPacket[]>(
        "SELECT parentId,retiredAt FROM private_content_files WHERE assetId=?",
        [p.assetId],
      );
      expect(poster.parentId).toBe(made.data);
      expect(poster.retiredAt).toBeInstanceOf(Date);
    });
    it("replaces a poster atomically without losing a gallery photo or reviving the old poster", async () => {
      const v = await video(),
        p = await photo(),
        gallery = await photo("vu2b-gallery-original-key");
      const made = await call("createPost", {
        ...input(v.assetId, p.assetId),
        photos: [gallery.url],
        target: "feed",
        status: "published",
      });
      expect(made.status).toBe(200);
      const replacement = await photo("vu2b-replacement-poster-key");
      const changed = {
        id: made.data,
        privateAssetIds: [v.assetId],
        privateVideoPosters: [
          { videoAssetId: v.assetId, posterAssetId: replacement.assetId },
        ],
      };
      expect((await call("updatePost", changed)).status).toBe(200);
      expect((await call("updatePost", changed)).status).toBe(200);
      expect((await fetch(base + p.url, { method: "HEAD" })).status).toBe(404);
      expect(
        (await fetch(base + replacement.url, { method: "HEAD" })).status,
      ).toBe(200);
      expect((await fetch(base + gallery.url, { method: "HEAD" })).status).toBe(
        200,
      );
      expect(
        (
          await call("updatePost", {
            ...changed,
            privateVideoPosters: [
              { videoAssetId: v.assetId, posterAssetId: p.assetId },
            ],
          })
        ).status,
      ).toBe(409);
      const media = await call("getPostMedia", { postId: made.data }, true);
      expect(media.data).toHaveLength(1);
      expect(media.data[0].posterUrl).toBe(replacement.url);
      const [[post]] = await conn.query<RowDataPacket[]>(
        "SELECT photos FROM posts WHERE id=?",
        [made.data],
      );
      expect(post.photos).toEqual([gallery.url]);
    });
    it.each(["foreign", "wrong-usage", "unrelated-video"])(
      "rejects %s poster association without partial post/media/file binding",
      async (mode) => {
        const v = await video(),
          p = await photo(
            "vu2b-poster-original-key",
            mode === "wrong-usage" ? "articlePhoto" : "postPhoto",
            mode === "foreign" ? other : token,
          );
        const request = input(v.assetId, p.assetId);
        if (mode === "unrelated-video")
          request.privateVideoPosters[0].videoAssetId =
            "00000000-0000-4000-8000-000000000001";
        const made = await call("createPost", request);
        expect(made.status).toBe(mode === "foreign" ? 409 : 400);
        expect(
          (
            await conn.query<RowDataPacket[]>(
              "SELECT id FROM posts WHERE source='vu2b-video-suite'",
            )
          )[0],
        ).toEqual([]);
        const [[asset]] = await conn.query<RowDataPacket[]>(
          "SELECT postId,mediaId FROM private_attachment_uploads WHERE assetId=?",
          [v.assetId],
        );
        expect(asset).toEqual({ postId: null, mediaId: null });
        const [[poster]] = await conn.query<RowDataPacket[]>(
          "SELECT parentId FROM private_content_files WHERE assetId=?",
          [p.assetId],
        );
        expect(poster.parentId).toBeNull();
      },
    );
  },
);
