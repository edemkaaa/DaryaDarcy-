import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import {
  S3Client,
  GetBucketPolicyCommand,
  GetBucketVersioningCommand,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { assertTestDatabase } from "../tooling/scripts/test-database-policy";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb } from "../apps/backend/src/db";
import {
  applyLegacyMedia,
  rollbackLegacyMedia,
} from "../apps/backend/src/content/legacy-media-migration";
import { prepareLegacyMigration } from "../apps/backend/src/content/legacy-media-manifest";
import {
  privateStorageNamespace,
  privateAttachmentObjectKey,
  verifyPrivateUploadPolicy,
} from "../apps/backend/src/media/private-upload-object";

const uri = process.env.LEGACY_MEDIA_REHEARSAL_DATABASE_URL;
const enabled = process.env.LEGACY_MEDIA_S3_CANARY === "true" && !!uri;
const owner = randomUUID(),
  actor = { id: 98861, sessionVersion: 0 };
const Bucket = "daryadarcy-s3",
  endpoint = "https://s3.twcstorage.ru";
const sourceKey = `club/tg/codex-legacy-copy-${owner}@тест.mp4`;
const bytes = Buffer.concat([
  Buffer.from([0, 0, 0, 24]),
  Buffer.from("ftypmp42"),
  Buffer.alloc(16),
]);
const hash = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");

describe.skipIf(!enabled)(
  "owned tiny streaming PUT canary on real Timeweb and disposable fresh44 SQL/API",
  () => {
    let conn: Connection, client: S3Client, app: INestApplication, base: string;
    let manifest: unknown, payloadHash: string;
    let ownedRows = false;
    const tokens: Record<string, string> = {};
    async function rows(query: string, args: unknown[] = []) {
      return (await conn.query<RowDataPacket[]>(query, args))[0];
    }
    async function unversioned() {
      const versioning = await client.send(
        new GetBucketVersioningCommand({ Bucket }),
        { abortSignal: AbortSignal.timeout(15000) },
      );
      if (versioning.Status)
        throw new Error(
          "Canary requires unversioned bucket; no version cleanup guessed",
        );
    }
    beforeAll(async () => {
      const url = assertTestDatabase(uri!),
        id = process.env.LEGACY_MEDIA_DATABASE_CONTAINER_ID;
      if (
        !id ||
        !/^[a-f0-9]{64}$/.test(id) ||
        url.hostname !== "127.0.0.1" ||
        !url.port ||
        process.env.DATABASE_URL !== uri ||
        process.env.S3_ENDPOINT !== endpoint ||
        process.env.S3_BUCKET !== Bucket ||
        !process.env.S3_ACCESS_KEY ||
        !process.env.S3_SECRET_KEY
      )
        throw new Error("Explicit canary inputs required");
      const { stdout } = await promisify(execFile)("docker", [
        "inspect",
        id,
        "--format",
        '{"id":{{json .Id}},"name":{{json .Name}},"owner":{{json (index .Config.Labels "codex.owner")}},"mounts":{{json .Mounts}},"tmpfs":{{json .HostConfig.Tmpfs}},"ports":{{json .NetworkSettings.Ports}}}',
      ]);
      const d = JSON.parse(stdout),
        port = d.ports?.["3306/tcp"];
      if (
        d.id !== id ||
        !/^daryadarcy-fresh-legacy-[a-z0-9-]+$/.test(d.owner) ||
        d.name !== `/${d.owner}` ||
        d.mounts.length ||
        !d.tmpfs?.["/var/lib/mysql"] ||
        port?.length !== 1 ||
        port[0].HostIp !== "127.0.0.1" ||
        port[0].HostPort !== url.port
      )
        throw new Error("Unowned SQL fixture refused");
      conn = await mysql.createConnection({ uri: uri!, timezone: "Z" });
      expect(await rows("SELECT id FROM users")).toEqual([]);
      expect(await rows("SELECT id FROM posts")).toEqual([]);
      expect(await rows("SELECT id FROM __drizzle_migrations")).toHaveLength(
        44,
      );
      client = new S3Client({
        endpoint,
        region: "ru-1",
        forcePathStyle: true,
        maxAttempts: 1,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY!,
          secretAccessKey: process.env.S3_SECRET_KEY!,
        },
        requestHandler: {
          connectionTimeout: 5000,
          requestTimeout: 15000,
          throwOnRequestTimeout: true,
        },
      });
      const policy = await client.send(new GetBucketPolicyCommand({ Bucket }), {
        abortSignal: AbortSignal.timeout(15000),
      });
      expect(hash(policy.Policy ?? "")).toBe(
        "0484dfa2cc0164225db616bc516c53e8be377aca975d32701b6a6467ce1715e8",
      );
      verifyPrivateUploadPolicy(
        JSON.parse(policy.Policy ?? "null"),
        Bucket,
        true,
      );
      await unversioned();
      await conn.query(
        "INSERT INTO users(id,openId,role) VALUES(98861,?,'admin'),(98862,?,'user'),(98863,?,'user')",
        [`lm-admin-${owner}`, `lm-member-${owner}`, `lm-outsider-${owner}`],
      );
      ownedRows = true;
      for (const [name, openId] of Object.entries({
        admin: `lm-admin-${owner}`,
        member: `lm-member-${owner}`,
        outsider: `lm-outsider-${owner}`,
      }))
        tokens[name] = await sdk.createSessionToken(openId, {
          sessionVersion: 0,
        });
      await conn.query(
        "INSERT INTO club_payments(userId,orderId,status,expiresAt) VALUES(98862,?,'paid',DATE_ADD(NOW(),INTERVAL 1 DAY))",
        [`lm-paid-${owner}`],
      );
      vi.stubEnv("PRIVATE_POST_MEDIA_UPLOAD_ENABLED", "true");
      vi.stubEnv("PRIVATE_POST_MEDIA_DELIVERY_ENABLED", "true");
      const sourceUrl = `${endpoint}/${Bucket}/${sourceKey}`;
      await conn.query(
        "INSERT INTO posts(id,text,photos,tags,target,published,status) VALUES(98861,'owned synthetic copy canary',JSON_ARRAY(),JSON_ARRAY(),'club',1,'published')",
      );
      await conn.query(
        "INSERT INTO post_media(id,postId,type,url,mimeType,fileSize) VALUES(98861,98861,'video',?,'video/mp4',?)",
        [sourceUrl, bytes.length],
      );
      const put = await client.send(
        new PutObjectCommand({
          Bucket,
          Key: sourceKey,
          Body: bytes,
          ACL: "private",
          IfNoneMatch: "*",
          ContentType: "video/mp4",
          ContentLength: bytes.length,
          ContentMD5: createHash("md5").update(bytes).digest("base64"),
          Metadata: { "codex-owner": owner },
        }),
        { abortSignal: AbortSignal.timeout(15000) },
      );
      if (!put.ETag) throw new Error("Source identity unavailable");
      const subject = { kind: "postMedia", id: 98861, slot: "url" },
        operationId = hash(JSON.stringify([subject, sourceUrl]));
      manifest = {
        version: 1,
        subject,
        operationId,
        idempotencyKey: `legacy:${operationId}`,
        expectedOldUrl: sourceUrl,
        expectedSourceBytes: bytes.length,
        expectedSourceSha256: hash(bytes),
        expectedSourceETag: put.ETag,
        preserveOriginal: true,
        filename: `lm-canary-${owner}.mp4`,
        type: "video",
        transport: "s3Stream",
        probe: bytes,
      };
      payloadHash = (await prepareLegacyMigration(manifest)).payloadHash;
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    }, 90000);
    afterAll(async () => {
      await app?.close();
      try {
        if (client) {
          await unversioned();
          if (conn && payloadHash)
            for (const row of await rows(
              "SELECT * FROM private_attachment_uploads WHERE actorUserId=98861",
            )) {
              if (
                row.filename !== `lm-canary-${owner}.mp4` ||
                row.payloadHash !== payloadHash ||
                row.namespaceHash !== privateStorageNamespace().hash ||
                row.type !== "video"
              )
                throw new Error("Canary cleanup identity mismatch");
              const key = privateAttachmentObjectKey("video", row.assetId);
              let head;
              try {
                head = await client.send(
                  new HeadObjectCommand({ Bucket, Key: key }),
                  { abortSignal: AbortSignal.timeout(15000) },
                );
              } catch (error) {
                if (
                  (error as { $metadata?: { httpStatusCode?: number } })
                    .$metadata?.httpStatusCode !== 404
                )
                  throw error;
              }
              if (head) {
                if (
                  head.Metadata?.["asset-id"] !== row.assetId ||
                  head.Metadata?.["intent-hash"] !== payloadHash ||
                  head.ContentLength !== bytes.length
                )
                  throw new Error("Canary object not owned");
                await client.send(
                  new DeleteObjectCommand({ Bucket, Key: key }),
                  { abortSignal: AbortSignal.timeout(15000) },
                );
                await expect(
                  client.send(new HeadObjectCommand({ Bucket, Key: key }), {
                    abortSignal: AbortSignal.timeout(15000),
                  }),
                ).rejects.toMatchObject({ $metadata: { httpStatusCode: 404 } });
              }
            }
          let source;
          try {
            source = await client.send(
              new HeadObjectCommand({ Bucket, Key: sourceKey }),
              { abortSignal: AbortSignal.timeout(15000) },
            );
          } catch (error) {
            if (
              (error as { $metadata?: { httpStatusCode?: number } }).$metadata
                ?.httpStatusCode !== 404
            )
              throw error;
          }
          if (source) {
            if (
              source.Metadata?.["codex-owner"] !== owner ||
              source.ContentLength !== bytes.length
            )
              throw new Error("Canary source not owned");
            await client.send(
              new DeleteObjectCommand({ Bucket, Key: sourceKey }),
              { abortSignal: AbortSignal.timeout(15000) },
            );
            await expect(
              client.send(new HeadObjectCommand({ Bucket, Key: sourceKey }), {
                abortSignal: AbortSignal.timeout(15000),
              }),
            ).rejects.toMatchObject({ $metadata: { httpStatusCode: 404 } });
          }
        }
      } finally {
        if (conn) {
          if (ownedRows) {
            await conn.query(
              "DELETE FROM private_attachment_uploads WHERE actorUserId=98861",
            );
            await conn.query("DELETE FROM post_media WHERE postId=98861");
            await conn.query("DELETE FROM posts WHERE id=98861");
            await conn.query("DELETE FROM club_payments WHERE orderId=?", [
              `lm-paid-${owner}`,
            ]);
            await conn.query(
              "DELETE FROM users WHERE id BETWEEN 98861 AND 98863",
            );
          }
          await conn.end();
        }
        await (
          (await getDb()) as unknown as { $client: { end(): Promise<void> } }
        )?.$client.end();
        client?.destroy();
        vi.unstubAllEnvs();
      }
    }, 90000);
    it("copies one tiny owned object, verifies real bytes/access and rolls back without touching old data", async () => {
      const result = await applyLegacyMedia(actor, manifest);
      expect(await applyLegacyMedia(actor, manifest)).toEqual(result);
      const privateKey = privateAttachmentObjectKey("video", result.assetId);
      const existing = await client.send(
        new HeadObjectCommand({ Bucket, Key: privateKey }),
        { abortSignal: AbortSignal.timeout(15000) },
      );
      async function status(request: Promise<unknown>) {
        try {
          await request;
          return 200;
        } catch (error) {
          return (
            (error as { $metadata?: { httpStatusCode?: number } }).$metadata
              ?.httpStatusCode ?? 0
          );
        }
      }
      const putCondition = await status(
        client.send(
          new PutObjectCommand({
            Bucket,
            Key: privateKey,
            Body: bytes,
            ContentLength: bytes.length,
            ContentType: "video/mp4",
            ContentMD5: createHash("md5").update(bytes).digest("base64"),
            ACL: "private",
            IfNoneMatch: "*",
            CacheControl: "no-store",
            Metadata: existing.Metadata,
          }),
          { abortSignal: AbortSignal.timeout(15000) },
        ),
      );
      console.log(
        JSON.stringify({
          providerPutDestinationStatus: putCondition,
        }),
      );
      expect(putCondition).toBe(412);
      for (const name of ["admin", "member"]) {
        const r = await fetch(base + result.url, {
          headers: { authorization: `Bearer ${tokens[name]}` },
          signal: AbortSignal.timeout(30000),
        });
        expect(r.status).toBe(200);
        expect(Buffer.from(await r.arrayBuffer())).toEqual(bytes);
      }
      for (const name of ["guest", "outsider"]) {
        const r = await fetch(base + result.url, {
          headers: tokens[name]
            ? { authorization: `Bearer ${tokens[name]}` }
            : {},
          signal: AbortSignal.timeout(15000),
        });
        expect(r.status).toBe(404);
      }
      expect(
        (
          await fetch(
            `${endpoint}/${Bucket}/${privateAttachmentObjectKey("video", result.assetId)}`,
            { method: "HEAD", signal: AbortSignal.timeout(15000) },
          )
        ).status,
      ).toBe(403);
      await conn.query(
        "UPDATE club_payments SET expiresAt='2000-01-01' WHERE orderId=?",
        [`lm-paid-${owner}`],
      );
      expect(
        (
          await fetch(base + result.url, {
            headers: { authorization: `Bearer ${tokens.member}` },
            signal: AbortSignal.timeout(15000),
          })
        ).status,
      ).toBe(404);
      expect(await rollbackLegacyMedia(actor, manifest)).toEqual({
        state: "rolledBack",
      });
      expect(
        (await rows("SELECT url FROM post_media WHERE id=98861"))[0].url,
      ).toBe(`${endpoint}/${Bucket}/${sourceKey}`);
    }, 360000);
  },
);
