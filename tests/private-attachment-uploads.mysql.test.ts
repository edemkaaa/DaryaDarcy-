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
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openPrivateUploadWire } from "./helpers/private-upload-wire";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb } from "../apps/backend/src/db";
import { drizzle } from "drizzle-orm/mysql2";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { runPrivateRecoveryProcess } from "./helpers/private-recovery-process";

describe.skipIf(!testDatabaseUrl)(
  "private upload native HTTP/SQL and SDK wire",
  () => {
    let conn: Connection, app: INestApplication, base: string, token: string;
    let wire: Awaited<ReturnType<typeof openPrivateUploadWire>>;
    const input = {
      idempotencyKey: "private-upload-intent-0001",
      type: "document",
      filename: "fixture.txt",
      mimeType: "text/plain",
      base64: Buffer.from("0123456789").toString("base64"),
    };
    async function request(
      method: string,
      value: unknown = input,
      bearer: string | null = token,
      query = false,
    ) {
      const body = superjson.stringify(value);
      const response = await fetch(
        `${base}/api/trpc/admin.${method}${query ? `?input=${encodeURIComponent(body)}` : ""}`,
        {
          method: query ? "GET" : "POST",
          headers: {
            "content-type": "application/json",
            ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
          },
          ...(query ? {} : { body }),
          signal: AbortSignal.timeout(20000),
        },
      );
      const json = await response.json();
      return {
        status: response.status,
        data: json.result
          ? superjson.deserialize<Record<string, unknown>>(json.result.data)
          : json.error?.json?.data?.code,
      };
    }
    async function rows(sql: string, args: unknown[] = []) {
      return (await conn.query<RowDataPacket[]>(sql, args))[0];
    }
    async function cleanupPosts() {
      const ids = (
        await rows("SELECT id FROM posts WHERE source='ag4-upload-suite'")
      ).map((row) => row.id);
      for (const id of ids) {
        await conn.query("DELETE FROM post_media WHERE postId=?", [id]);
        await conn.query("DELETE FROM posts WHERE id=?", [id]);
      }
      await conn.query(
        "DELETE FROM post_creation_requests WHERE actorUserId IN (97330,97331)",
      );
      await conn.query(
        "DELETE FROM content_recovery_markers WHERE actorUserId IN (97330,97331)",
      );
    }
    const postInput = (assetId: string) => ({
      text: "Private attachment fixture",
      photos: [],
      tags: [],
      source: "ag4-upload-suite",
      target: "club",
      status: "draft",
      idempotencyKey: "private-post-intent-0001",
      privateAssetIds: [assetId],
    });
    async function maintain(
      database: MySql2Database = drizzle(conn),
      cleanup = true,
    ) {
      vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "true");
      vi.stubEnv("CONTENT_RECOVERY_MAINTENANCE_ENABLED", "true");
      vi.stubEnv("PRIVATE_ORPHAN_CLEANUP_ENABLED", String(cleanup));
      const module =
        await import("../apps/backend/src/content/private-recovery-maintenance");
      expect(module.maintainPrivateRecovery).toBeTypeOf("function");
      return module.maintainPrivateRecovery(database, { limit: 10 });
    }
    beforeAll(async () => {
      conn = await openContentTestDatabase();
      // Native notification selector finds no recipients; no external push transport.
      await conn.query(
        "CREATE TABLE IF NOT EXISTS push_consent_events (id INT AUTO_INCREMENT PRIMARY KEY,userId INT NOT NULL,consentType ENUM('service','marketing') NOT NULL,status ENUM('granted','revoked') NOT NULL,consentVersion VARCHAR(32) NOT NULL,consentText TEXT,platform VARCHAR(16),createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB",
      );
      wire = await openPrivateUploadWire();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("JWT_SECRET", "ag4-fixture-session-secret-32-characters");
      vi.stubEnv("PRIVATE_POST_MEDIA_UPLOAD_ENABLED", "true");
      vi.stubEnv("S3_ENDPOINT", wire.endpoint);
      vi.stubEnv("S3_BUCKET", wire.bucket);
      vi.stubEnv("S3_ACCESS_KEY", "wire-fixture-access");
      vi.stubEnv("S3_SECRET_KEY", "wire-fixture-secret");
      await conn.query(
        "INSERT INTO users (id,openId,role) VALUES (97330,'ag4-admin','admin'),(97331,'ag4-other-admin','admin'),(97332,'ag4-member','user')",
      );
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
      token = await sdk.createSessionToken("ag4-admin", { sessionVersion: 0 });
    });
    beforeEach(async () => {
      await cleanupPosts();
      if ((await rows("SHOW TABLES LIKE 'private_attachment_uploads'")).length)
        await conn.query(
          "DELETE FROM private_attachment_uploads WHERE actorUserId IN (97330,97331)",
        );
      wire.objects.clear();
      wire.effects.length = 0;
      wire.rejectPolicy(false);
      vi.stubEnv("PRIVATE_POST_MEDIA_UPLOAD_ENABLED", "true");
      vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "false");
      await conn.query(
        "UPDATE users SET role='admin',blockedAt=NULL,sessionVersion=0 WHERE id=97330",
      );
    });
    afterAll(async () => {
      await app?.close();
      if (conn) {
        await cleanupPosts();
        if (
          (await rows("SHOW TABLES LIKE 'private_attachment_uploads'")).length
        )
          await conn.query(
            "DELETE FROM private_attachment_uploads WHERE actorUserId IN (97330,97331)",
          );
        await conn.query("DELETE FROM users WHERE id IN (97330,97331,97332)");
        await conn.end();
      }
      if (app)
        await (
          (await getDb()) as unknown as { $client: { end(): Promise<void> } }
        )?.$client.end();
      await wire?.close();
      vi.unstubAllEnvs();
    });
    it("expired never-bound upload is deleted once and cannot be resurrected", async () => {
      expect((await request("uploadPrivateAttachment")).status).toBe(200);
      await conn.query(
        "UPDATE private_attachment_uploads SET createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=97330",
      );
      const result = await maintain();
      expect(result.deleted).toBe(1);
      expect(wire.objects.size).toBe(0);
      expect(
        await rows(
          "SELECT assetId FROM private_attachment_uploads WHERE actorUserId=97330",
        ),
      ).toEqual([]);
      expect(
        await rows(
          "SELECT kind FROM content_recovery_markers WHERE actorUserId=97330",
        ),
      ).toEqual([{ kind: "private_attachment" }]);
      const effects = wire.effects.length;
      expect((await request("uploadPrivateAttachment")).status).toBe(409);
      expect(
        (
          await request(
            "privateAttachmentStatus",
            { idempotencyKey: input.idempotencyKey },
            token,
            true,
          )
        ).status,
      ).toBe(409);
      expect(wire.effects).toHaveLength(effects);
    });
    it("compacts a live bound receipt without deleting its object or read evidence", async () => {
      const uploaded = await request("uploadPrivateAttachment");
      const assetId = String(uploaded.data.assetId);
      expect((await request("createPost", postInput(assetId))).status).toBe(
        200,
      );
      await conn.query(
        "UPDATE private_attachment_uploads SET createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=97330",
      );
      const result = await maintain();
      expect(result.compacted).toBe(1);
      expect(result.deleted).toBe(0);
      expect(wire.objects.size).toBe(1);
      const [receipt] = await rows(
        "SELECT filename,mimeType,fileSize,etag,mediaId,postId FROM private_attachment_uploads WHERE actorUserId=97330",
      );
      expect(receipt.filename).toBe("");
      expect(receipt.mimeType).toBe("text/plain; charset=utf-8");
      expect(receipt.fileSize).toBe(10);
      expect(receipt.etag).toBeTruthy();
      expect(receipt.mediaId).toBeGreaterThan(0);
      expect(receipt.postId).toBeGreaterThan(0);
      expect(wire.effects.some((effect) => effect.startsWith("DELETE "))).toBe(
        false,
      );
      vi.stubEnv("PRIVATE_POST_MEDIA_DELIVERY_ENABLED", "true");
      expect(
        (
          await request("updatePost", {
            id: receipt.postId,
            status: "published",
            target: "feed",
            privateAssetIds: [assetId],
          })
        ).status,
      ).toBe(200);
      const response = await fetch(
        `${base}/api/media/post-attachments/${receipt.mediaId}`,
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("0123456789");
    });
    it("starts a detached receipt clock at observation, not its old upload date", async () => {
      const uploaded = await request("uploadPrivateAttachment");
      const assetId = String(uploaded.data.assetId);
      expect((await request("createPost", postInput(assetId))).status).toBe(
        200,
      );
      await conn.query(
        "DELETE m FROM post_media m JOIN private_attachment_uploads u ON m.id=u.mediaId WHERE u.actorUserId=97330",
      );
      await conn.query(
        "UPDATE private_attachment_uploads SET createdAt=DATE_SUB(NOW(),INTERVAL 90 DAY) WHERE actorUserId=97330",
      );
      expect((await maintain()).deleted).toBe(0);
      const [receipt] = await rows(
        "SELECT orphanedAt FROM private_attachment_uploads WHERE actorUserId=97330",
      );
      expect(Date.now() - receipt.orphanedAt.getTime()).toBeLessThan(10000);
      expect((await maintain()).deleted).toBe(0);
      expect(wire.objects.size).toBe(1);
      await conn.query(
        "UPDATE private_attachment_uploads SET orphanedAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=97330",
      );
      expect((await maintain()).deleted).toBe(1);
      expect(wire.objects.size).toBe(0);
    });
    it("keeps durable evidence after lost DELETE ACK and confirms absence on retry", async () => {
      await request("uploadPrivateAttachment");
      await conn.query(
        "UPDATE private_attachment_uploads SET createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=97330",
      );
      wire.dropDeleteAck();
      const first = await maintain();
      expect(first.failed).toBe(1);
      expect(first.deleted).toBe(0);
      expect(wire.objects.size).toBe(0);
      expect(
        await rows(
          "SELECT assetId FROM private_attachment_uploads WHERE actorUserId=97330",
        ),
      ).toHaveLength(1);
      expect((await request("uploadPrivateAttachment")).status).toBe(409);
      const resumed = await runPrivateRecoveryProcess();
      expect(resumed.pid).not.toBe(process.pid);
      expect(resumed.result.deleted).toBe(1);
      expect(resumed.result.failed).toBe(0);
      expect(
        wire.effects.filter((effect) => effect.startsWith("DELETE ")),
      ).toHaveLength(1);
      expect(
        await rows(
          "SELECT assetId FROM private_attachment_uploads WHERE actorUserId=97330",
        ),
      ).toEqual([]);
    });
    it("reconciles an expired pending upload without performing another PUT", async () => {
      wire.dropPutAck();
      expect((await request("uploadPrivateAttachment")).status).toBe(503);
      await conn.query(
        "UPDATE private_attachment_uploads SET createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=97330",
      );
      expect((await maintain()).deleted).toBe(1);
      expect(
        wire.effects.filter((effect) => effect.startsWith("PUT ")),
      ).toHaveLength(1);
      expect(wire.objects.size).toBe(0);
    });
    it("refuses a foreign object and retains its receipt for investigation", async () => {
      await request("uploadPrivateAttachment");
      await conn.query(
        "UPDATE private_attachment_uploads SET createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=97330",
      );
      for (const object of wire.objects.values())
        object.metadata["intent-hash"] = "foreign";
      const result = await maintain();
      expect(result.failed).toBe(1);
      expect(result.deleted).toBe(0);
      expect(wire.objects.size).toBe(1);
      expect(wire.effects.some((effect) => effect.startsWith("DELETE "))).toBe(
        false,
      );
      expect(
        await rows(
          "SELECT assetId FROM private_attachment_uploads WHERE actorUserId=97330",
        ),
      ).toHaveLength(1);
    });
    it("never reports compaction when the SQL transaction was rolled back", async () => {
      await request("uploadPrivateAttachment");
      await conn.query(
        "UPDATE private_attachment_uploads SET createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=97330",
      );
      await conn.query(
        "CREATE TRIGGER backend_test_ag5_rollback BEFORE UPDATE ON private_attachment_uploads FOR EACH ROW BEGIN IF NEW.actorUserId=97330 AND NEW.orphanedAt IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Owned lifecycle failure'; END IF; END",
      );
      try {
        const result = await maintain();
        expect(result.compacted).toBe(0);
        expect(result.observed).toBe(0);
        expect(result.deleted).toBe(0);
        expect(result.failed).toBe(1);
        expect(
          await rows(
            "SELECT filename FROM private_attachment_uploads WHERE actorUserId=97330",
          ),
        ).toEqual([{ filename: "fixture.txt" }]);
        expect(
          await rows(
            "SELECT kind FROM content_recovery_markers WHERE actorUserId=97330",
          ),
        ).toEqual([]);
        expect(wire.objects.size).toBe(1);
      } finally {
        await conn.query("DROP TRIGGER backend_test_ag5_rollback");
      }
    });
    it("keeps compacted orphan evidence without contacting S3 while cleanup is disabled", async () => {
      await request("uploadPrivateAttachment");
      await conn.query(
        "UPDATE private_attachment_uploads SET createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=97330",
      );
      wire.effects.length = 0;
      const result = await maintain(drizzle(conn), false);
      expect(result.compacted).toBe(1);
      expect(result.deleted).toBe(0);
      expect(wire.effects).toEqual([]);
      expect(wire.objects.size).toBe(1);
    });
    it("refuses a non-loopback S3 endpoint without any storage request", async () => {
      await request("uploadPrivateAttachment");
      await conn.query(
        "UPDATE private_attachment_uploads SET createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=97330",
      );
      wire.effects.length = 0;
      vi.stubEnv("S3_ENDPOINT", "https://storage.example.test");
      try {
        const result = await maintain();
        expect(result.failed).toBe(1);
        expect(result.deleted).toBe(0);
        expect(wire.effects).toEqual([]);
        expect(wire.objects.size).toBe(1);
      } finally {
        vi.stubEnv("S3_ENDPOINT", wire.endpoint);
      }
    });
    it("serializes cleanup against a late binding without deleting a newly bound object", async () => {
      const upload = await request("uploadPrivateAttachment");
      const assetId = String(upload.data.assetId);
      await conn.query(
        "UPDATE private_attachment_uploads SET createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=97330",
      );
      const gate = wire.pauseDelete();
      const cleanup = maintain((await getDb())!);
      let bind: ReturnType<typeof request> | undefined;
      try {
        await gate.entered;
        // Disabling expiry must not reopen the already committed spent marker.
        vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "false");
        bind = request("createPost", postInput(assetId));
        await vi.waitFor(
          async () =>
            expect(
              (
                await rows(
                  "SELECT 1 FROM performance_schema.data_lock_waits w JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID=w.REQUESTING_ENGINE_LOCK_ID AND l.ENGINE=w.ENGINE WHERE l.OBJECT_SCHEMA=DATABASE() AND l.OBJECT_NAME='private_attachment_uploads'",
                )
              ).length,
            ).toBeGreaterThan(0),
          { timeout: 3000, interval: 20 },
        );
      } finally {
        gate.release();
        await cleanup;
      }
      expect((await bind!).status).toBe(409);
      expect(
        await rows("SELECT id FROM posts WHERE source='ag4-upload-suite'"),
      ).toEqual([]);
      expect(wire.objects.size).toBe(0);
    });
    it("uploads a private document and replays the same server receipt", async () => {
      const first = await request("uploadPrivateAttachment");
      expect(first.status).toBe(200);
      expect(first.data).toMatchObject({
        state: "ready",
        type: "document",
        filename: "fixture.txt",
        mimeType: "text/plain; charset=utf-8",
        fileSize: 10,
      });
      expect(first.data.assetId).toMatch(/^[a-f0-9-]{36}$/);
      expect(JSON.stringify(first.data)).not.toMatch(
        /https?:|private-v1|objectKey|secret/i,
      );
      expect(await request("uploadPrivateAttachment")).toEqual(first);
      expect(wire.objects.size).toBe(1);
      expect([...wire.objects.values()][0].bytes.toString()).toBe("0123456789");
      expect(
        wire.effects.filter((value) => value.startsWith("PUT")),
      ).toHaveLength(1);
      expect(
        await request(
          "privateAttachmentStatus",
          { idempotencyKey: input.idempotencyKey },
          token,
          true,
        ),
      ).toEqual(first);
    });
    it("recovers a lost storage ACK using the same object, never a second PUT", async () => {
      wire.dropPutAck();
      expect((await request("uploadPrivateAttachment")).status).toBe(503);
      expect(
        (
          await request(
            "privateAttachmentStatus",
            { idempotencyKey: input.idempotencyKey },
            token,
            true,
          )
        ).data,
      ).toMatchObject({ state: "pending" });
      const recovered = await request("uploadPrivateAttachment");
      expect(recovered.status).toBe(200);
      expect(recovered.data.state).toBe("ready");
      expect(wire.objects.size).toBe(1);
      expect(
        wire.effects.filter((value) => value.startsWith("PUT")),
      ).toHaveLength(1);
    });
    it("rejects a changed payload under the same intent without another object", async () => {
      expect((await request("uploadPrivateAttachment")).status).toBe(200);
      wire.effects.length = 0;
      expect(
        (
          await request("uploadPrivateAttachment", {
            ...input,
            base64: Buffer.from("changed").toString("base64"),
          })
        ).status,
      ).toBe(409);
      expect(wire.objects.size).toBe(1);
      expect(wire.effects).toEqual([]);
    });
    it("refuses storage without the prefix policy before PUT", async () => {
      wire.rejectPolicy(true);
      expect((await request("uploadPrivateAttachment")).status).toBe(503);
      expect(wire.objects.size).toBe(0);
    });
    it("disabled upload rejects before receiving a large body or contacting S3", async () => {
      vi.stubEnv("PRIVATE_POST_MEDIA_UPLOAD_ENABLED", "false");
      expect((await request("uploadPrivateAttachment")).status).toBe(404);
      expect(wire.effects).toEqual([]);
    });
    it("guest is refused before storage", async () => {
      expect(
        (await request("uploadPrivateAttachment", input, null)).status,
      ).toBe(401);
      expect(wire.effects).toEqual([]);
    });
    it("parallel retries commit one intent and one object", async () => {
      const results = await Promise.all(
        Array.from({ length: 4 }, () => request("uploadPrivateAttachment")),
      );
      expect(results.every((result) => result.status === 200)).toBe(true);
      expect(new Set(results.map((result) => result.data.assetId)).size).toBe(
        1,
      );
      expect(
        await rows(
          "SELECT assetId FROM private_attachment_uploads WHERE actorUserId=97330",
        ),
      ).toHaveLength(1);
      // Concurrent conditional writes may race; only one object can win.
      expect(wire.objects.size).toBe(1);
    });
    it("releases SQL locks while storage waits and refuses finalization after revocation", async () => {
      const gate = wire.pausePut();
      const pending = request("uploadPrivateAttachment");
      try {
        await gate.entered;
        await conn.query("SET SESSION innodb_lock_wait_timeout=1");
        // This UPDATE must complete while the S3 request is still paused.
        await conn.query("UPDATE users SET sessionVersion=1 WHERE id=97330");
        expect(await rows("SELECT state FROM private_attachment_uploads WHERE actorUserId=97330")).toEqual([{ state: "pending" }]);
      } finally { gate.release(); }
      expect((await pending).status).toBe(401);
      expect(await rows("SELECT state,etag FROM private_attachment_uploads WHERE actorUserId=97330")).toEqual([{ state: "pending", etag: null }]);
      expect(wire.objects.size).toBe(1);
    });
    it("changed storage namespace cannot replay or report a ready receipt", async () => {
      expect((await request("uploadPrivateAttachment")).status).toBe(200);
      wire.effects.length = 0;
      vi.stubEnv("S3_BUCKET", "other-fixture-bucket");
      try {
        expect((await request("uploadPrivateAttachment")).status).toBe(503);
        expect(
          (
            await request(
              "privateAttachmentStatus",
              { idempotencyKey: input.idempotencyKey },
              token,
              true,
            )
          ).status,
        ).toBe(503);
        expect(wire.effects).toEqual([]);
      } finally {
        vi.stubEnv("S3_BUCKET", wire.bucket);
      }
    });
    it("a missing uniqueness guard refuses upload before any storage request", async () => {
      await conn.query(
        "ALTER TABLE private_attachment_uploads DROP INDEX private_attachment_asset_unique",
      );
      try {
        expect((await request("uploadPrivateAttachment")).status).toBe(503);
        expect(wire.effects).toEqual([]);
      } finally {
        await conn.query(
          "ALTER TABLE private_attachment_uploads ADD UNIQUE private_attachment_asset_unique (assetId)",
        );
      }
    });
    it("revoked admin cannot recover a committed receipt", async () => {
      expect((await request("uploadPrivateAttachment")).status).toBe(200);
      await conn.query("UPDATE users SET role='user' WHERE id=97330");
      wire.effects.length = 0;
      expect((await request("uploadPrivateAttachment")).status).toBe(403);
      expect(wire.effects).toEqual([]);
    });
    it("binds a ready receipt in post creation without exposing the object URL", async () => {
      const receipt = (await request("uploadPrivateAttachment")).data;
      const created = await request("createPost", postInput(receipt.assetId));
      expect(created.status).toBe(200);
      const media = await rows("SELECT * FROM post_media WHERE postId=?", [
        created.data,
      ]);
      expect(media).toHaveLength(1);
      expect(media[0]).toMatchObject({
        type: "document",
        filename: "fixture.txt",
        mimeType: "text/plain; charset=utf-8",
        fileSize: 10,
        url: `/api/media/post-attachments/${media[0].id}`,
      });
      expect(await request("createPost", postInput(receipt.assetId))).toEqual(
        created,
      );
      expect(
        await rows("SELECT id FROM posts WHERE source='ag4-upload-suite'"),
      ).toHaveLength(1);
      expect(
        await rows("SELECT id FROM post_media WHERE postId=?", [created.data]),
      ).toHaveLength(1);
      expect((await fetch(`${base}${media[0].url}`)).status).toBe(404);
      expect(
        (
          await request("updatePost", {
            id: created.data,
            status: "published",
            privateAssetIds: [receipt.assetId],
          })
        ).status,
      ).toBe(200);
      vi.stubEnv("PRIVATE_POST_MEDIA_DELIVERY_ENABLED", "true");
      const authorized = await fetch(`${base}${media[0].url}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(authorized.status).toBe(200);
      expect(authorized.headers.get("content-type")).toBe(
        "text/plain; charset=utf-8",
      );
      expect(await authorized.text()).toBe("0123456789");
      expect((await fetch(`${base}${media[0].url}`)).status).toBe(404);
    });
    it("rejects a foreign receipt and rolls back post creation", async () => {
      const receipt = (await request("uploadPrivateAttachment")).data;
      const other = await sdk.createSessionToken("ag4-other-admin", {
        sessionVersion: 0,
      });
      expect(
        (await request("createPost", postInput(receipt.assetId), other)).status,
      ).toBe(409);
      expect(
        await rows("SELECT id FROM posts WHERE source='ag4-upload-suite'"),
      ).toHaveLength(0);
    });
    it("removal revokes read and late attachment retry cannot resurrect it", async () => {
      const receipt = (await request("uploadPrivateAttachment")).data;
      const created = await request("createPost", postInput(receipt.assetId));
      const media = await rows("SELECT id FROM post_media WHERE postId=?", [
        created.data,
      ]);
      expect(media).toHaveLength(1);
      vi.stubEnv("PRIVATE_POST_MEDIA_DELIVERY_ENABLED", "true");
      await request("updatePost", {
        id: created.data,
        target: "feed",
        status: "published",
      });
      const before = await fetch(
        `${base}/api/media/post-attachments/${media[0].id}`,
      );
      expect(before.status).toBe(200);
      await before.text();
      expect(
        (
          await request("updatePost", {
            id: created.data,
            removedMediaIds: [media[0].id],
          })
        ).status,
      ).toBe(200);
      wire.effects.length = 0;
      expect(
        (await fetch(`${base}/api/media/post-attachments/${media[0].id}`))
          .status,
      ).toBe(404);
      expect(wire.effects).toEqual([]);
      expect(
        (
          await request("updatePost", {
            id: created.data,
            privateAssetIds: [receipt.assetId],
          })
        ).status,
      ).toBe(409);
      expect(
        await rows("SELECT id FROM post_media WHERE postId=?", [created.data]),
      ).toHaveLength(0);
      expect(wire.objects.size).toBe(1);
    });
    it("legacy deleteMedia rolls back removal of the final post body", async () => {
      const asset = (await request("uploadPrivateAttachment")).data;
      const created = await request("createPost", postInput(asset.assetId));
      const [media] = await rows("SELECT id FROM post_media WHERE postId=?", [created.data]);
      await conn.query("UPDATE posts SET text='',status='published',published=1 WHERE id=?", [created.data]);
      expect((await request("deleteMedia", { id: media.id })).status).toBe(400);
      expect(await rows("SELECT id FROM post_media WHERE id=?", [media.id])).toHaveLength(1);
      await conn.query("UPDATE posts SET text='Remaining body' WHERE id=?", [created.data]);
      expect((await request("deleteMedia", { id: media.id })).status).toBe(200);
      expect(await rows("SELECT id FROM post_media WHERE id=?", [media.id])).toEqual([]);
      expect((await request("updatePost", { id: created.data, privateAssetIds: [asset.assetId] })).status).toBe(409);
      // The historical binding is a fence against resurrection, not a live URL.
      expect((await fetch(`${base}/api/media/post-attachments/${media.id}`)).status).toBe(404);
    });
    it("legacy URL attachment cannot bypass ownership for a private-v1 object", async () => {
      await request("uploadPrivateAttachment");
      const url = `${wire.endpoint}/${wire.bucket}/${[...wire.objects.keys()][0]}`;
      const payload = {
        ...postInput("unused"),
        privateAssetIds: [],
        attachments: [
          {
            type: "document",
            url,
            filename: "fixture.txt",
            mimeType: "text/plain",
            fileSize: 10,
          },
        ],
      };
      expect((await request("createPost", payload)).status).toBe(400);
      expect(
        await rows("SELECT id FROM posts WHERE source='ag4-upload-suite'"),
      ).toHaveLength(0);
    });
    it("failed media insertion rolls back the post edit and receipt binding", async () => {
      const receipt = (await request("uploadPrivateAttachment")).data;
      const created = await request("createPost", {
        ...postInput(receipt.assetId),
        privateAssetIds: [],
      });
      await conn.query(
        "CREATE TRIGGER ag4_fixture_media_abort BEFORE INSERT ON post_media FOR EACH ROW BEGIN IF NEW.url LIKE 'private-asset:%' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='ag4 fixture rollback'; END IF; END",
      );
      try {
        expect(
          (
            await request("updatePost", {
              id: created.data,
              text: "must roll back",
              privateAssetIds: [receipt.assetId],
            })
          ).status,
        ).toBe(500);
        expect(
          (await rows("SELECT text FROM posts WHERE id=?", [created.data]))[0]
            .text,
        ).toBe("Private attachment fixture");
        expect(
          await rows("SELECT id FROM post_media WHERE postId=?", [
            created.data,
          ]),
        ).toHaveLength(0);
        expect(
          (
            await rows(
              "SELECT postId,mediaId FROM private_attachment_uploads WHERE assetId=?",
              [receipt.assetId],
            )
          )[0],
        ).toEqual({ postId: null, mediaId: null });
      } finally {
        await conn.query("DROP TRIGGER ag4_fixture_media_abort");
      }
    });
    it("pending receipt cannot be attached or treated as a completed post", async () => {
      wire.dropPutAck();
      await request("uploadPrivateAttachment");
      const receipt = (
        await request(
          "privateAttachmentStatus",
          { idempotencyKey: input.idempotencyKey },
          token,
          true,
        )
      ).data;
      expect(
        (await request("createPost", postInput(receipt.assetId))).status,
      ).toBe(409);
      expect(
        await rows("SELECT id FROM posts WHERE source='ag4-upload-suite'"),
      ).toHaveLength(0);
    });
    it("a receipt cannot be rebound to another post", async () => {
      const receipt = (await request("uploadPrivateAttachment")).data;
      expect(
        (await request("createPost", postInput(receipt.assetId))).status,
      ).toBe(200);
      expect(
        (
          await request("createPost", {
            ...postInput(receipt.assetId),
            idempotencyKey: "private-post-intent-0002",
          })
        ).status,
      ).toBe(409);
      expect(
        await rows("SELECT id FROM posts WHERE source='ag4-upload-suite'"),
      ).toHaveLength(1);
    });
    it("changed object ETag is not served under a previously committed receipt", async () => {
      const receipt = (await request("uploadPrivateAttachment")).data;
      const created = await request("createPost", postInput(receipt.assetId));
      await request("updatePost", {
        id: created.data,
        target: "feed",
        status: "published",
      });
      const media = await rows("SELECT id FROM post_media WHERE postId=?", [
        created.data,
      ]);
      [...wire.objects.values()][0].etag = '"changed-object"';
      vi.stubEnv("PRIVATE_POST_MEDIA_DELIVERY_ENABLED", "true");
      expect(
        (await fetch(`${base}/api/media/post-attachments/${media[0].id}`))
          .status,
      ).toBe(503);
    });
    it("ready receipt without committed storage evidence never reports success", async () => {
      expect((await request("uploadPrivateAttachment")).status).toBe(200);
      await conn.query(
        "UPDATE private_attachment_uploads SET etag=NULL WHERE actorUserId=97330",
      );
      wire.effects.length = 0;
      expect((await request("uploadPrivateAttachment")).status).toBe(503);
      expect(
        (
          await request(
            "privateAttachmentStatus",
            { idempotencyKey: input.idempotencyKey },
            token,
            true,
          )
        ).status,
      ).toBe(503);
      expect(wire.effects).toEqual([]);
    });
    it("refuses a detected audio format that the closed read route cannot serve", async () => {
      const bytes = Buffer.concat([Buffer.from("fLaC"), Buffer.alloc(64)]);
      expect(
        (
          await request("uploadPrivateAttachment", {
            ...input,
            type: "audio",
            filename: "fixture.flac",
            mimeType: "audio/flac",
            base64: bytes.toString("base64"),
          })
        ).status,
      ).toBe(400);
      expect(wire.effects).toEqual([]);
    });
    it("expired upload intent refuses replay and status without another storage effect", async () => {
      const original = await request("uploadPrivateAttachment");
      expect(original.status).toBe(200);
      await conn.query(
        "UPDATE private_attachment_uploads SET createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=97330",
      );
      vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "true");
      wire.effects.length = 0;
      expect(await request("uploadPrivateAttachment")).toEqual({
        status: 409,
        data: "CONFLICT",
      });
      expect(
        await request(
          "privateAttachmentStatus",
          { idempotencyKey: input.idempotencyKey },
          token,
          true,
        ),
      ).toEqual({ status: 409, data: "CONFLICT" });
      expect(wire.effects).toEqual([]);
      expect(wire.objects.size).toBe(1);
      expect(
        await rows(
          "SELECT assetId,state FROM private_attachment_uploads WHERE actorUserId=97330",
        ),
      ).toEqual([
        expect.objectContaining({
          assetId: original.data.assetId,
          state: "ready",
        }),
      ]);
    });
    it("expired unknown storage outcome cannot retry the external write", async () => {
      wire.dropPutAck();
      expect((await request("uploadPrivateAttachment")).status).toBe(503);
      await conn.query(
        "UPDATE private_attachment_uploads SET createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=97330",
      );
      vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "true");
      wire.effects.length = 0;
      expect((await request("uploadPrivateAttachment")).status).toBe(409);
      expect(wire.effects).toEqual([]);
      expect(wire.objects.size).toBe(1);
      expect(
        (
          await rows(
            "SELECT state FROM private_attachment_uploads WHERE actorUserId=97330",
          )
        )[0].state,
      ).toBe("pending");
    });
    it("expired unbound receipt cannot create a post or media binding", async () => {
      const receipt = (await request("uploadPrivateAttachment")).data;
      await conn.query(
        "UPDATE private_attachment_uploads SET createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=97330",
      );
      vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "true");
      wire.effects.length = 0;
      expect(
        (await request("createPost", postInput(receipt.assetId))).status,
      ).toBe(409);
      expect(
        await rows("SELECT id FROM posts WHERE source='ag4-upload-suite'"),
      ).toEqual([]);
      expect(
        await rows(
          "SELECT postId,mediaId FROM private_attachment_uploads WHERE actorUserId=97330",
        ),
      ).toEqual([{ postId: null, mediaId: null }]);
      expect(wire.effects).toEqual([]);
    });
    it("disabled retention preserves aged upload and status recovery", async () => {
      const first = await request("uploadPrivateAttachment");
      expect(first.status).toBe(200);
      await conn.query(
        "UPDATE private_attachment_uploads SET createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=97330",
      );
      wire.effects.length = 0;
      expect(await request("uploadPrivateAttachment")).toEqual(first);
      expect(
        await request(
          "privateAttachmentStatus",
          { idempotencyKey: input.idempotencyKey },
          token,
          true,
        ),
      ).toEqual(first);
      expect(wire.effects).toEqual([]);
    });
    it("aged bound receipt remains readable and editable without reattachment", async () => {
      const receipt = (await request("uploadPrivateAttachment")).data;
      const post = await request("createPost", postInput(receipt.assetId));
      expect(post.status).toBe(200);
      await conn.query(
        "UPDATE private_attachment_uploads SET createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=97330",
      );
      await conn.query(
        "INSERT INTO content_recovery_markers (kind,requestKey,actorUserId,createdAt) SELECT 'private_attachment',requestKey,actorUserId,createdAt FROM private_attachment_uploads WHERE actorUserId=97330",
      );
      vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "true");
      vi.stubEnv("PRIVATE_POST_MEDIA_DELIVERY_ENABLED", "true");
      expect(
        (
          await request("updatePost", {
            id: post.data,
            status: "published",
            target: "feed",
            privateAssetIds: [receipt.assetId],
          })
        ).status,
      ).toBe(200);
      const media = await rows("SELECT url FROM post_media WHERE postId=?", [
        post.data,
      ]);
      expect(media).toHaveLength(1);
      const response = await fetch(`${base}${media[0].url}`);
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("0123456789");
    });
    it("a compacted private intent cannot upload again or report notRecorded", async () => {
      const first = await request("uploadPrivateAttachment");
      expect(first.status).toBe(200);
      await conn.query(
        "INSERT INTO content_recovery_markers (kind,requestKey,actorUserId,createdAt) SELECT 'private_attachment',requestKey,actorUserId,createdAt FROM private_attachment_uploads WHERE actorUserId=97330",
      );
      await conn.query(
        "DELETE FROM private_attachment_uploads WHERE actorUserId=97330",
      );
      wire.effects.length = 0;
      expect((await request("uploadPrivateAttachment")).status).toBe(409);
      expect(
        (
          await request(
            "privateAttachmentStatus",
            { idempotencyKey: input.idempotencyKey },
            token,
            true,
          )
        ).status,
      ).toBe(409);
      expect(wire.effects).toEqual([]);
      expect(wire.objects.size).toBe(1);
      expect(
        await rows(
          "SELECT assetId FROM private_attachment_uploads WHERE actorUserId=97330",
        ),
      ).toEqual([]);
    });
    it("a retained orphan receipt cannot bind after its marker closes recovery", async () => {
      const first = await request("uploadPrivateAttachment");
      expect(first.status).toBe(200);
      await conn.query(
        "INSERT INTO content_recovery_markers (kind,requestKey,actorUserId,createdAt) SELECT 'private_attachment',requestKey,actorUserId,createdAt FROM private_attachment_uploads WHERE actorUserId=97330",
      );
      expect(
        (await request("createPost", postInput(first.data.assetId))).status,
      ).toBe(409);
      expect(
        await rows("SELECT id FROM posts WHERE source='ag4-upload-suite'"),
      ).toEqual([]);
      expect(
        await rows(
          "SELECT mediaId FROM private_attachment_uploads WHERE actorUserId=97330",
        ),
      ).toEqual([{ mediaId: null }]);
    });
  },
);
