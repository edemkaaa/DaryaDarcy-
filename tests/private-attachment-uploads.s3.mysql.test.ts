import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createServer, request as nativeRequest, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Connection, RowDataPacket } from "mysql2/promise";
import {
  S3Client,
  GetBucketPolicyCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import superjson from "superjson";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { privateAttachmentProcesses } from "./helpers/private-attachment-process";
import { wavFixture } from "./helpers/media-fixtures";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb } from "../apps/backend/src/db";
import { COOKIE_NAME } from "../packages/shared/src/const";

const enabled = process.env.AG4_S3_ACCEPTANCE === "true" && !!testDatabaseUrl;
/** Явно включаемая приёмка private attachment upload на настоящем S3 с потерей HTTP-ответа и новым процессом API. */
describe.skipIf(!enabled)(
  "actual private upload with SQL, lost HTTP ACK and process restart",
  () => {
    let conn: Connection,
      storage: S3Client,
      workers: Awaited<ReturnType<typeof privateAttachmentProcesses>>;
    let api: Awaited<ReturnType<typeof workers.start>>,
      token: string,
      memberToken: string,
      policy: string;
    const owner = randomUUID(),
      filename = `ag4-${owner}.txt`,
      source = "ag4-s3-native";
    const input = {
      idempotencyKey: `ag4-${owner}`,
      type: "document",
      filename,
      mimeType: "text/plain",
      base64: Buffer.from("0123456789").toString("base64"),
    };
    const Bucket = "daryadarcy-s3";
    const objects: Array<{
      Key: string;
      assetId: string;
      payloadHash: string;
      size: number;
      etag: string;
    }> = [];
    /** Читает собственные upload/post journals и media через контрольное соединение. */
    const rows = async (sql: string, args: unknown[] = []) =>
      (await conn.query<RowDataPacket[]>(sql, args))[0];
    /** Вызывает admin-процедуру настоящего API с выбранной JWT и deadline. */
    async function request(
      method: string,
      value: unknown,
      query = false,
      bearer = token,
      base = api.base,
    ) {
      const encoded = superjson.stringify(value);
      const response = await fetch(
        `${base}/api/trpc/admin.${method}${query ? `?input=${encodeURIComponent(encoded)}` : ""}`,
        {
          method: query ? "GET" : "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${bearer}`,
          },
          ...(query ? {} : { body: encoded }),
          signal: AbortSignal.timeout(30000),
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
    /** Пропускает полный upstream ответ через loopback proxy, затем разрывает downstream для имитации потерянного ACK. */
    async function droppedResponse(method: string, value: unknown) {
      let proxy: Server | undefined;
      try {
        proxy = createServer((req, res) => {
          const upstream = nativeRequest(
            `${api.base}/api/trpc/admin.${method}`,
            { method: "POST", headers: req.headers },
            (response) => {
              // Complete real upstream HTTP/body, then destroy the client connection.
              response.resume();
              response.once("end", () => res.destroy());
            },
          );
          upstream.once("error", () => res.destroy());
          req.pipe(upstream);
        });
        await new Promise<void>((resolve) =>
          proxy!.listen(0, "127.0.0.1", resolve),
        );
        const base = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`;
        await expect(
          request(method, value, false, token, base),
        ).rejects.toThrow();
      } finally {
        proxy?.closeAllConnections();
        if (proxy)
          await new Promise<void>((resolve) => proxy!.close(() => resolve()));
      }
    }
    /** Формирует точный список новых fixture-keys только из owner-префикса filename, UUID и своих receipt. */
    async function rememberOwnObjects() {
      for (const row of await rows(
        "SELECT * FROM private_attachment_uploads WHERE actorUserId=97350",
      )) {
        if (
          !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
            row.assetId,
          ) ||
          !row.filename.startsWith(`ag4-${owner}`)
        )
          throw new Error("Fixture ledger ownership mismatch");
        const Key = `feed/${row.type === "audio" ? "audio" : "documents"}/private-v1/${row.assetId}`;
        if (!objects.some((object) => object.Key === Key))
          objects.push({
            Key,
            assetId: row.assetId,
            payloadHash: row.payloadHash,
            size: row.fileSize,
            etag: row.etag,
          });
      }
    }
    /** Требует совпадающий disposable DB и явный S3-доступ, сохраняет policy и создаёт своих admin/member и paid-период. */
    beforeAll(async () => {
      if (
        process.env.DATABASE_URL !== testDatabaseUrl ||
        process.env.S3_ENDPOINT !== "https://s3.twcstorage.ru" ||
        process.env.S3_BUCKET !== Bucket ||
        !process.env.S3_ACCESS_KEY ||
        !process.env.S3_SECRET_KEY
      )
        throw new Error("Explicit acceptance inputs required");
      vi.stubEnv("JWT_SECRET", "ag4-s3-native-session-secret-32-characters");
      storage = new S3Client({
        endpoint: process.env.S3_ENDPOINT,
        region: "ru-1",
        forcePathStyle: true,
        maxAttempts: 1,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY,
          secretAccessKey: process.env.S3_SECRET_KEY,
        },
        requestHandler: {
          connectionTimeout: 5000,
          requestTimeout: 10000,
          throwOnRequestTimeout: true,
        },
      });
      policy = (await storage.send(new GetBucketPolicyCommand({ Bucket })))
        .Policy!;
      conn = await openContentTestDatabase();
      await conn.query(
        "CREATE TABLE IF NOT EXISTS push_consent_events (id INT AUTO_INCREMENT PRIMARY KEY,userId INT NOT NULL,consentType ENUM('service','marketing') NOT NULL,status ENUM('granted','revoked') NOT NULL,consentVersion VARCHAR(32) NOT NULL,consentText TEXT,platform VARCHAR(16),createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB",
      );
      await conn.query(
        "INSERT INTO users (id,openId,role) VALUES (97350,?,'admin'),(97351,?,'user')",
        [`ag4-s3-${owner}`, `ag4-member-${owner}`],
      );
      await conn.query(
        "INSERT INTO club_payments (userId,orderId,status,expiresAt) VALUES (97351,?,'paid',DATE_ADD(NOW(),INTERVAL 1 DAY))",
        [`ag4-paid-${owner}`],
      );
      token = await sdk.createSessionToken(`ag4-s3-${owner}`, {
        sessionVersion: 0,
      });
      memberToken = await sdk.createSessionToken(`ag4-member-${owner}`, {
        sessionVersion: 0,
      });
      workers = await privateAttachmentProcesses();
      api = await workers.start();
    }, 25000);
    /** Останавливает процессы и удаляет только новые owner-fixture объекты после live metadata/ETag guard, затем свои SQL-строки; policy сравнивается неизменной. */
    afterAll(async () => {
      await api?.stop();
      await workers?.close();
      if (conn) {
        await rememberOwnObjects();
        // Delete exact new fixtures only after independent live metadata/ETag guards.
        for (const object of objects) {
          let meta;
          try {
            meta = await storage.send(
              new HeadObjectCommand({ Bucket, Key: object.Key }),
            );
          } catch (error) {
            if (
              (error as { $metadata?: { httpStatusCode?: number } }).$metadata
                ?.httpStatusCode === 404
            )
              continue;
            throw new Error("Own fixture cleanup unavailable");
          }
          if (
            meta.Metadata?.["asset-id"] !== object.assetId ||
            meta.Metadata?.["intent-hash"] !== object.payloadHash ||
            meta.ContentLength !== object.size ||
            !meta.ETag ||
            (object.etag && object.etag !== meta.ETag)
          )
            throw new Error("Own fixture cleanup guard refused");
          await storage.send(
            new DeleteObjectCommand({
              Bucket,
              Key: object.Key,
              IfMatch: meta.ETag,
            }),
          );
          await expect(
            storage.send(new HeadObjectCommand({ Bucket, Key: object.Key })),
          ).rejects.toMatchObject({ $metadata: { httpStatusCode: 404 } });
        }
        expect(
          (await storage.send(new GetBucketPolicyCommand({ Bucket }))).Policy,
        ).toBe(policy);
        for (const row of await rows(
          "SELECT postId FROM post_creation_requests WHERE actorUserId=97350",
        )) {
          if (row.postId) {
            await conn.query("DELETE FROM post_media WHERE postId=?", [
              row.postId,
            ]);
            await conn.query("DELETE FROM posts WHERE id=? AND source=?", [
              row.postId,
              source,
            ]);
          }
        }
        await conn.query(
          "DELETE FROM post_creation_requests WHERE actorUserId=97350",
        );
        await conn.query(
          "DELETE FROM private_attachment_uploads WHERE actorUserId=97350",
        );
        await conn.query(
          "DELETE FROM club_payments WHERE orderId=? AND userId=97351",
          [`ag4-paid-${owner}`],
        );
        await conn.query(
          "DELETE FROM users WHERE (id=97350 AND openId=?) OR (id=97351 AND openId=?)",
          [`ag4-s3-${owner}`, `ag4-member-${owner}`],
        );
        await conn.end();
        await (
          (await getDb()) as unknown as { $client: { end(): Promise<void> } }
        )?.$client.end();
      }
      storage?.destroy();
      vi.unstubAllEnvs();
    }, 25000);
    /** После двух потерянных ответов новый API восстанавливает один asset и пост, private-доступ меняется с parent и retired нельзя привязать заново. */
    it("lost upload/post responses survive a fresh backend process without duplicates", async () => {
      await droppedResponse("uploadPrivateAttachment", input);
      expect(
        api.commands.filter((name) => name === "PutObjectCommand"),
      ).toHaveLength(1);
      const recorded = await rows(
        "SELECT * FROM private_attachment_uploads WHERE actorUserId=97350",
      );
      expect(recorded).toHaveLength(1);
      expect(recorded[0].state).toBe("ready");
      const previousPid = api.pid;
      await api.stop();
      api = await workers.start();
      expect(api.pid).not.toBe(previousPid);
      const recovered = await request(
        "privateAttachmentStatus",
        { idempotencyKey: input.idempotencyKey },
        true,
      );
      expect(recovered.status).toBe(200);
      expect(recovered.data.assetId).toBe(recorded[0].assetId);
      expect(await request("uploadPrivateAttachment", input)).toEqual(
        recovered,
      );
      expect(
        api.commands.filter((name) => name === "PutObjectCommand"),
      ).toHaveLength(0);
      const post = {
        text: "Native private document",
        photos: [],
        tags: [],
        target: "club",
        status: "draft",
        source,
        idempotencyKey: `post-${owner}`,
        privateAssetIds: [recovered.data.assetId],
      };
      await droppedResponse("createPost", post);
      const created = await request("createPost", post);
      expect(created.status).toBe(200);
      const media = await rows("SELECT * FROM post_media WHERE postId=?", [
        created.data,
      ]);
      expect(media).toHaveLength(1);
      expect(media[0].url).toBe(`/api/media/post-attachments/${media[0].id}`);
      await rememberOwnObjects();
      const object = objects[0];
      for (const method of ["GET", "HEAD"]) {
        const direct = await fetch(
          `https://s3.twcstorage.ru/${Bucket}/${object.Key}`,
          { method, redirect: "error", signal: AbortSignal.timeout(10000) },
        );
        expect(direct.status).toBe(403);
        await direct.body?.cancel();
      }
      /** Читает bound media URL с выбранной cookie либо как гость. */
      const read = (cookie?: string) =>
        fetch(`${api.base}${media[0].url}`, {
          headers: cookie ? { cookie: `${COOKIE_NAME}=${cookie}` } : {},
        });
      expect((await read(memberToken)).status).toBe(404);
      expect(
        (await request("updatePost", { id: created.data, status: "published" }))
          .status,
      ).toBe(200);
      const allowed = await read(memberToken);
      expect(allowed.status).toBe(200);
      expect(await allowed.text()).toBe("0123456789");
      const before = api.commands.length;
      expect((await read()).status).toBe(404);
      expect(api.commands.length).toBe(before);
      await conn.query(
        "UPDATE club_payments SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE orderId=?",
        [`ag4-paid-${owner}`],
      );
      expect((await read(memberToken)).status).toBe(404);
      expect(api.commands.length).toBe(before);
      await request("updatePost", { id: created.data, target: "feed" });
      const publicRead = await read();
      expect(publicRead.status).toBe(200);
      await publicRead.text();
      await request("updatePost", {
        id: created.data,
        removedMediaIds: [media[0].id],
      });
      const removedCount = api.commands.length;
      expect((await read()).status).toBe(404);
      expect(api.commands.length).toBe(removedCount);
      expect(
        (
          await request("updatePost", {
            id: created.data,
            privateAssetIds: [recovered.data.assetId],
          })
        ).status,
      ).toBe(409);
      expect(
        await rows("SELECT id FROM post_media WHERE postId=?", [created.data]),
      ).toHaveLength(0);
      expect(
        await rows("SELECT id FROM posts WHERE source=?", [source]),
      ).toHaveLength(1);
    }, 35000);
    /** Валидный маленький WAV сохраняется в private audio-prefix и выдаёт точный RIFF Range при анонимном отказе прямого S3 HEAD. */
    it("uploads real WAV bytes to the audio prefix and serves an exact range", async () => {
      const bytes = wavFixture();
      const audio = await request("uploadPrivateAttachment", {
        ...input,
        idempotencyKey: `audio-${owner}`,
        type: "audio",
        filename: `ag4-${owner}.wav`,
        mimeType: "audio/wav",
        base64: bytes.toString("base64"),
      });
      expect(audio.status).toBe(200);
      expect(audio.data).toMatchObject({
        type: "audio",
        mimeType: "audio/wav",
        fileSize: 46,
      });
      const created = await request("createPost", {
        text: "Native WAV",
        photos: [],
        tags: [],
        target: "feed",
        source,
        status: "published",
        idempotencyKey: `wav-post-${owner}`,
        privateAssetIds: [audio.data.assetId],
      });
      expect(created.status).toBe(200);
      const media = await rows("SELECT * FROM post_media WHERE postId=?", [
        created.data,
      ]);
      expect(media).toHaveLength(1);
      const response = await fetch(`${api.base}${media[0].url}`, {
        headers: { Range: "bytes=0-3" },
      });
      expect(response.status).toBe(206);
      expect(response.headers.get("content-range")).toBe("bytes 0-3/46");
      expect(await response.text()).toBe("RIFF");
      await rememberOwnObjects();
      const key = `feed/audio/private-v1/${audio.data.assetId}`;
      const direct = await fetch(`https://s3.twcstorage.ru/${Bucket}/${key}`, {
        method: "HEAD",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      expect(direct.status).toBe(403);
      expect(
        api.commands.filter((name) => name === "PutObjectCommand"),
      ).toHaveLength(1);
    }, 20000);
  },
);
