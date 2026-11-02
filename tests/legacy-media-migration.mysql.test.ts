import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { docxFixture, docxMime } from "./helpers/document-fixtures";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import sharp from "sharp";
import { assertTestDatabase } from "../tooling/scripts/test-database-policy";
import { openPrivateUploadWire } from "./helpers/private-upload-wire";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { getDb } from "../apps/backend/src/db";
import { sdk } from "../apps/backend/src/_core/sdk";
import {
  applyLegacyMedia,
  rollbackLegacyMedia,
} from "../apps/backend/src/content/legacy-media-migration";

const uri = process.env.LEGACY_MEDIA_REHEARSAL_DATABASE_URL;
const hash = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
const source =
  "https://s3.twcstorage.ru/daryadarcy-s3/feed/photos/owned-synthetic.jpg";
const actor = { id: 98851, sessionVersion: 0 };
describe.skipIf(!uri)(
  "legacy migration on fresh50 SQL, real API and owned SDK wire",
  () => {
    let conn: Connection, app: INestApplication, base: string;
    let wire: Awaited<ReturnType<typeof openPrivateUploadWire>>;
    let photo: Buffer;
    const tokens: Record<string, string> = {};
    function input(
      bytes = photo,
      kind = "postPhoto",
      id = 98851,
      slot = "photos.0",
      type = "photo",
    ) {
      const subject = { kind, id, slot },
        operationId = hash(JSON.stringify([subject, source]));
      return {
        version: 1,
        operationId,
        idempotencyKey: `legacy:${operationId}`,
        subject,
        expectedOldUrl: source,
        expectedSourceSha256: hash(bytes),
        expectedSourceBytes: bytes.length,
        preserveOriginal: true,
        type,
        filename: "synthetic",
        bytes,
      };
    }
    function copyInput() {
      const bytes = Buffer.concat([
        Buffer.from([0, 0, 0, 24]),
        Buffer.from("ftypmp42"),
        Buffer.alloc(16),
      ]);
      const expectedOldUrl =
        "https://s3.twcstorage.ru/daryadarcy-s3/club/tg/owned-копия@2026.mp4";
      const request = input(bytes, "postMedia", 98851, "url", "video");
      const operationId = hash(
        JSON.stringify([request.subject, expectedOldUrl]),
      );
      const etag = '"' + createHash("md5").update(bytes).digest("hex") + '"';
      wire.objects.set("club/tg/owned-копия@2026.mp4", {
        bytes: Buffer.from(bytes),
        etag,
        mime: "video/mp4",
        metadata: {},
      });
      const { bytes: _bytes, ...rest } = request;
      return {
        ...rest,
        operationId,
        idempotencyKey: `legacy:${operationId}`,
        expectedOldUrl,
        expectedSourceSha256: null,
        expectedSourceETag: etag,
        transport: "s3Stream",
        probe: bytes,
      };
    }
    async function rows(sql: string, args: unknown[] = []) {
      return (await conn.query<RowDataPacket[]>(sql, args))[0];
    }
    async function read(
      path: string,
      who = "member",
      headers: Record<string, string> = {},
    ) {
      return fetch(base + path, {
        headers: {
          ...(tokens[who] ? { authorization: `Bearer ${tokens[who]}` } : {}),
          ...headers,
        },
      });
    }
    async function clear() {
      await conn.query("DROP TRIGGER IF EXISTS legacy_migration_refusal");
      await conn.query(
        "DELETE FROM private_content_files WHERE actorUserId IN (98851,98852)",
      );
      await conn.query(
        "DELETE FROM private_attachment_uploads WHERE actorUserId IN (98851,98852)",
      );
      await conn.query("DELETE FROM post_media WHERE postId=98851");
      await conn.query("DELETE FROM articles WHERE id=98851");
      await conn.query("DELETE FROM posts WHERE id IN (98851,98852)");
      await conn.query(
        "DELETE FROM club_payments WHERE orderId='legacy-synthetic-access'",
      );
    }
    async function restartedApply(
      request: ReturnType<typeof input> | ReturnType<typeof copyInput>,
      discard = false,
    ) {
      const field = "bytes" in request ? "bytes" : "probe";
      const value = "bytes" in request ? request.bytes : request.probe;
      const json = JSON.stringify({
        ...request,
        [field]: value.toString("base64"),
      });
      const script = `const {applyLegacyMedia}=require('./apps/backend/src/content/legacy-media-migration');const {getDb}=require('./apps/backend/src/db');async function main(){try{const x=${json};x[${JSON.stringify(field)}]=Buffer.from(x[${JSON.stringify(field)}],'base64');const result=await applyLegacyMedia(${JSON.stringify(actor)},x);${discard ? "process.exitCode=23;" : "console.log(JSON.stringify(result));"}}finally{await (await getDb())?.$client.end();}}main().catch(()=>{process.exitCode=1;});`;
      return promisify(execFile)(
        process.execPath,
        ["--require", "tsx/cjs", "--eval", script],
        {
          timeout: 30000,
          env: {
            PATH: process.env.PATH,
            NODE_ENV: "test",
            DATABASE_URL: uri!,
            S3_ENDPOINT: wire.endpoint,
            S3_BUCKET: wire.bucket,
            S3_ACCESS_KEY: "legacy-fixture",
            S3_SECRET_KEY: "legacy-fixture-secret",
            PRIVATE_CONTENT_FILES_ENABLED: "true",
            PRIVATE_POST_MEDIA_UPLOAD_ENABLED: "true",
            PRIVATE_POST_MEDIA_DELIVERY_ENABLED: "true",
          },
        },
      );
    }
    beforeAll(async () => {
      assertTestDatabase(uri!);
      conn = await mysql.createConnection(uri!);
      expect(
        Number(
          (await rows("SELECT COUNT(*) n FROM __drizzle_migrations"))[0].n,
        ),
      ).toBe(50);
      wire = await openPrivateUploadWire({ content: true });
      for (const [key, value] of Object.entries({
        DATABASE_URL: uri!,
        JWT_SECRET: "legacy-rehearsal-synthetic-jwt-secret",
        S3_ENDPOINT: wire.endpoint,
        S3_BUCKET: wire.bucket,
        S3_ACCESS_KEY: "legacy-fixture",
        S3_SECRET_KEY: "legacy-fixture-secret",
        PRIVATE_CONTENT_FILES_ENABLED: "true",
        PRIVATE_POST_MEDIA_UPLOAD_ENABLED: "true",
        PRIVATE_POST_MEDIA_DELIVERY_ENABLED: "true",
      }))
        vi.stubEnv(key, value);
      await conn.query(
        "INSERT INTO users(id,openId,role) VALUES(98851,'legacy-admin','admin'),(98852,'legacy-other-admin','admin'),(98853,'legacy-member','user'),(98854,'legacy-outsider','user')",
      );
      for (const [name, openId] of Object.entries({
        admin: "legacy-admin",
        other: "legacy-other-admin",
        member: "legacy-member",
        outsider: "legacy-outsider",
      }))
        tokens[name] = await sdk.createSessionToken(openId, {
          sessionVersion: 0,
        });
      photo = await sharp({
        create: { width: 4, height: 3, channels: 3, background: "red" },
      })
        .jpeg({ quality: 95 })
        .toBuffer();
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    });
    beforeEach(async () => {
      await clear();
      wire.objects.clear();
      wire.effects.length = 0;
      await conn.query(
        "UPDATE users SET role=IF(id IN (98851,98852),'admin','user'),blockedAt=NULL,sessionVersion=0,accountDeletionRequestedAt=NULL WHERE id BETWEEN 98851 AND 98854",
      );
      await conn.query(
        "INSERT INTO posts(id,text,photos,tags,target,published,status) VALUES(98851,'synthetic club',?,JSON_ARRAY(),'club',1,'published'),(98852,'public sentinel',?,JSON_ARRAY(),'feed',1,'published')",
        [JSON.stringify([source]), JSON.stringify([source])],
      );
      await conn.query(
        "INSERT INTO articles(id,title,coverUrl,access,published,sections) VALUES(98851,'synthetic article',?,'club',1,?)",
        [
          source,
          JSON.stringify([
            { type: "photo", url: source },
            { type: "carousel", urls: [source] },
            { type: "link", url: source },
          ]),
        ],
      );
      await conn.query(
        "INSERT INTO post_media(id,postId,type,url,mimeType,fileSize,sortOrder) VALUES(98851,98851,'video',?,'video/mp4',28,7)",
        [source],
      );
      await conn.query(
        "INSERT INTO club_payments(userId,orderId,status,expiresAt) VALUES(98853,'legacy-synthetic-access','paid','2037-01-01')",
      );
      vi.stubEnv("PRIVATE_CONTENT_FILES_ENABLED", "true");
      vi.stubEnv("PRIVATE_POST_MEDIA_UPLOAD_ENABLED", "true");
    });
    afterAll(async () => {
      await app?.close();
      if (conn) {
        await clear();
        await conn.query("DELETE FROM users WHERE id BETWEEN 98851 AND 98854");
        await conn.end();
      }
      await (
        (await getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      await wire?.close();
      vi.unstubAllEnvs();
    });
    it("copies exact bytes and binds only the selected slot, preserving public references", async () => {
      const result = await applyLegacyMedia(actor, input());
      expect(result.state).toBe("committed");
      expect(
        (await rows("SELECT photos FROM posts WHERE id=98851"))[0].photos,
      ).toEqual([result.url]);
      expect(
        (await rows("SELECT photos FROM posts WHERE id=98852"))[0].photos,
      ).toEqual([source]);
      expect(
        (await rows("SELECT coverUrl FROM articles WHERE id=98851"))[0]
          .coverUrl,
      ).toBe(source);
      expect([...wire.objects.values()][0].bytes).toEqual(photo);
      const response = await read(result.url);
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/jpeg");
      expect(response.headers.get("content-disposition")).toContain(
        'inline; filename="file.jpg"',
      );
      expect(Buffer.from(await response.arrayBuffer())).toEqual(photo);
    });
    it("authorizes admin/member and denies guest, outsider, expiry, blocking and direct storage", async () => {
      const result = await applyLegacyMedia(actor, input());
      for (const name of ["admin", "member"])
        expect((await read(result.url, name)).status).toBe(200);
      for (const name of ["guest", "outsider"]) {
        const before = wire.effects.length;
        expect((await read(result.url, name)).status).toBe(404);
        expect(wire.effects.length).toBe(before);
      }
      await conn.query(
        "UPDATE club_payments SET expiresAt='2000-01-01' WHERE orderId='legacy-synthetic-access'",
      );
      expect((await read(result.url)).status).toBe(404);
      await conn.query(
        "UPDATE club_payments SET expiresAt='2037-01-01' WHERE orderId='legacy-synthetic-access'",
      );
      await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=98853");
      expect((await read(result.url)).status).toBe(404);
      const key = [...wire.objects.keys()][0];
      expect(
        (await fetch(`${wire.endpoint}/${wire.bucket}/${key}`)).status,
      ).toBe(403);
    });
    it("recovers a lost PUT acknowledgement with one object and one binding", async () => {
      wire.dropPutAck();
      await expect(applyLegacyMedia(actor, input())).rejects.toMatchObject({
        code: "SERVICE_UNAVAILABLE",
      });
      expect(
        (await rows("SELECT photos FROM posts WHERE id=98851"))[0].photos,
      ).toEqual([source]);
      const resumed = await applyLegacyMedia(actor, input());
      expect(await applyLegacyMedia(actor, input())).toEqual(resumed);
      expect(wire.objects.size).toBe(1);
      expect(
        wire.effects.filter((effect) => effect.startsWith("PUT ")),
      ).toHaveLength(1);
      expect(
        await rows(
          "SELECT assetId FROM private_content_files WHERE actorUserId=98851",
        ),
      ).toHaveLength(1);
    });
    it("keeps the source binding when commit fails, then resumes the staged copy", async () => {
      await conn.query(
        "CREATE TRIGGER legacy_migration_refusal BEFORE UPDATE ON posts FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic refusal'",
      );
      await expect(applyLegacyMedia(actor, input())).rejects.toMatchObject({
        code: "SERVICE_UNAVAILABLE",
      });
      expect(
        (await rows("SELECT photos FROM posts WHERE id=98851"))[0].photos,
      ).toEqual([source]);
      expect(
        (
          await rows(
            "SELECT parentId FROM private_content_files WHERE actorUserId=98851",
          )
        )[0].parentId,
      ).toBeNull();
      await conn.query("DROP TRIGGER legacy_migration_refusal");
      expect((await applyLegacyMedia(actor, input())).state).toBe("committed");
      expect(wire.objects.size).toBe(1);
    });
    it("rejects an edited source and public parents before storage effects", async () => {
      await conn.query(
        "UPDATE posts SET photos=JSON_ARRAY('https://example.test/changed.jpg') WHERE id=98851",
      );
      await expect(applyLegacyMedia(actor, input())).rejects.toMatchObject({
        code: "CONFLICT",
      });
      await expect(
        applyLegacyMedia(actor, input(photo, "postPhoto", 98852)),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(wire.effects).toHaveLength(0);
    });
    it("rejects foreign accounts, stale sessions, disabled flags and wrong-key payload", async () => {
      await expect(
        applyLegacyMedia({ id: 98854, sessionVersion: 0 }, input()),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await conn.query("UPDATE users SET sessionVersion=1 WHERE id=98851");
      await expect(applyLegacyMedia(actor, input())).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      await conn.query("UPDATE users SET sessionVersion=0 WHERE id=98851");
      vi.stubEnv("PRIVATE_CONTENT_FILES_ENABLED", "false");
      await expect(applyLegacyMedia(actor, input())).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
      expect(wire.effects).toHaveLength(0);
      vi.stubEnv("PRIVATE_CONTENT_FILES_ENABLED", "true");
      await applyLegacyMedia(actor, input());
      await expect(
        applyLegacyMedia({ id: 98852, sessionVersion: 0 }, input()),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      await expect(
        applyLegacyMedia(actor, { ...input(), filename: "changed" }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
    it("rolls back only its binding, disables its private reference and refuses replay", async () => {
      const request = input(),
        result = await applyLegacyMedia(actor, request);
      expect(await rollbackLegacyMedia(actor, request)).toEqual({
        state: "rolledBack",
      });
      expect(await rollbackLegacyMedia(actor, request)).toEqual({
        state: "rolledBack",
      });
      expect(
        (await rows("SELECT photos FROM posts WHERE id=98851"))[0].photos,
      ).toEqual([source]);
      expect((await read(result.url, "admin")).status).toBe(404);
      await expect(applyLegacyMedia(actor, request)).rejects.toMatchObject({
        code: "CONFLICT",
      });
      expect(wire.objects.size).toBe(1);
      expect(wire.effects.some((effect) => effect.startsWith("DELETE "))).toBe(
        false,
      );
    });
    it("does not overwrite a later editor change during rollback", async () => {
      await applyLegacyMedia(actor, input());
      await conn.query(
        "UPDATE posts SET photos=JSON_ARRAY('https://example.test/editor.jpg') WHERE id=98851",
      );
      await expect(rollbackLegacyMedia(actor, input())).rejects.toMatchObject({
        code: "CONFLICT",
      });
      expect(
        (await rows("SELECT photos FROM posts WHERE id=98851"))[0].photos,
      ).toEqual(["https://example.test/editor.jpg"]);
    });
    it("preserves animated GIF bytes and covers while binding article media", async () => {
      const bytes = await sharp(
        Buffer.concat([
          Buffer.alloc(2 * 2 * 3, 0),
          Buffer.alloc(2 * 2 * 3, 255),
        ]),
        {
          raw: { width: 2, height: 4, channels: 3, pageHeight: 2 },
        },
      )
        .gif({ loop: 0, delay: [50, 120] })
        .toBuffer();
      expect(await sharp(bytes, { animated: true }).metadata()).toMatchObject({
        pages: 2,
        loop: 0,
        delay: [50, 120],
      });
      const request = input(bytes, "articleMedia", 98851, "sections.1.url"),
        result = await applyLegacyMedia(actor, request);
      const response = await read(result.url);
      expect(response.status).toBe(200);
      expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
      expect(response.headers.get("content-type")).toBe("image/gif");
      expect(response.headers.get("content-disposition")).toContain(
        'inline; filename="file.gif"',
      );
      expect(
        (await rows("SELECT coverUrl FROM articles WHERE id=98851"))[0]
          .coverUrl,
      ).toBe(source);
      await rollbackLegacyMedia(actor, request);
      expect(
        (await rows("SELECT sections FROM articles WHERE id=98851"))[0]
          .sections[0].url,
      ).toBe(source);
    });
    it("binds article carousel and document slots without touching other blocks", async () => {
      const image = await applyLegacyMedia(
        actor,
        input(photo, "articleMedia", 98851, "sections.2.urls.0"),
      );
      const document = Buffer.from("owned document bytes");
      const file = await applyLegacyMedia(
        actor,
        input(document, "articleMedia", 98851, "sections.3.url", "document"),
      );
      expect(Buffer.from(await (await read(file.url)).arrayBuffer())).toEqual(
        document,
      );
      const blocks = (
        await rows("SELECT sections FROM articles WHERE id=98851")
      )[0].sections;
      expect(blocks[0].url).toBe(source);
      expect(blocks[1].urls).toEqual([image.url]);
      expect(blocks[2].url).toBe(file.url);
    });
    it("migrates a DOCX with an exact Unicode source URL through the attachment namespace", async () => {
      const documents = await openPrivateUploadWire();
      vi.stubEnv("S3_ENDPOINT", documents.endpoint);
      const expectedOldUrl =
        "https://s3.twcstorage.ru/daryadarcy-s3/club/tg/список покупок.docx";
      const request = input(docxFixture, "postMedia", 98851, "url", "document");
      const operationId = hash(
        JSON.stringify([request.subject, expectedOldUrl]),
      );
      const manifest = {
        ...request,
        operationId,
        expectedOldUrl,
        idempotencyKey: `legacy:${operationId}`,
      };
      try {
        await conn.query(
          "UPDATE post_media SET type='document',url=?,mimeType=?,fileSize=? WHERE id=98851",
          [expectedOldUrl, docxMime, docxFixture.length],
        );
        const result = await applyLegacyMedia(actor, manifest);
        const response = await read(result.url);
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe(docxMime);
        expect(Buffer.from(await response.arrayBuffer())).toEqual(docxFixture);
        expect([...documents.objects.keys()][0]).toMatch(
          /^feed\/documents\/private-v1\//,
        );
        await rollbackLegacyMedia(actor, manifest);
        expect(
          (await rows("SELECT url FROM post_media WHERE id=98851"))[0].url,
        ).toBe(expectedOldUrl);
      } finally {
        vi.stubEnv("S3_ENDPOINT", wire.endpoint);
        await documents.close();
      }
    });
    it("keeps video IDs, order, bytes and byte ranges through migration and rollback", async () => {
      const bytes = Buffer.concat([
        Buffer.from([0, 0, 0, 24]),
        Buffer.from("ftypmp42"),
        Buffer.alloc(16),
      ]);
      const request = input(bytes, "postMedia", 98851, "url", "video"),
        result = await applyLegacyMedia(actor, request);
      expect(result.url).toBe("/api/media/post-attachments/98851");
      const media = (
        await rows("SELECT id,sortOrder,url FROM post_media WHERE id=98851")
      )[0];
      expect(media).toMatchObject({ id: 98851, sortOrder: 7, url: result.url });
      const response = await read(result.url, "member", { Range: "bytes=2-9" });
      expect(response.status).toBe(206);
      expect(Buffer.from(await response.arrayBuffer())).toEqual(
        bytes.subarray(2, 10),
      );
      await rollbackLegacyMedia(actor, request);
      expect(
        (await rows("SELECT url FROM post_media WHERE id=98851"))[0].url,
      ).toBe(source);
      await expect(applyLegacyMedia(actor, request)).rejects.toMatchObject({
        code: "CONFLICT",
      });
    });
    it("copies within storage, verifies streaming SHA and preserves the source", async () => {
      const request = copyInput();
      await conn.query("UPDATE post_media SET url=? WHERE id=98851", [
        request.expectedOldUrl,
      ]);
      const before = Buffer.from(
        wire.objects.get("club/tg/owned-копия@2026.mp4")!.bytes,
      );
      const result = await applyLegacyMedia(actor, request);
      expect(Buffer.from(await (await read(result.url)).arrayBuffer())).toEqual(
        before,
      );
      expect(wire.objects.get("club/tg/owned-копия@2026.mp4")!.bytes).toEqual(
        before,
      );
      const copied = [...wire.objects.entries()].find(([key]) =>
        key.startsWith("content/private-v1/"),
      )![1];
      expect(copied.metadata["source-sha256"]).toBe(hash(before));
      expect(copied.bytes).toEqual(before);
      expect(await applyLegacyMedia(actor, request)).toEqual(result);
      expect(
        wire.effects.filter((effect) => effect.startsWith("PUT ")),
      ).toHaveLength(1);
      await rollbackLegacyMedia(actor, request);
      expect(
        (await rows("SELECT url FROM post_media WHERE id=98851"))[0].url,
      ).toBe(request.expectedOldUrl);
    });
    it("does not hold the administrator row lock while storage is uploading", async () => {
      const gate = wire.pausePut(),
        pending = applyLegacyMedia(actor, input());
      await gate.entered;
      await conn.query("SET SESSION innodb_lock_wait_timeout=1");
      let changed = false;
      try {
        await conn.query(
          "UPDATE users SET name='synthetic edit during upload' WHERE id=98851",
        );
        changed = true;
      } catch {
        /* Report the lock contract below, after releasing and observing the upload. */
      } finally {
        gate.release();
      }
      await pending;
      expect(changed).toBe(true);
    });
    it("recovers the committed result in a fresh process after the first response is discarded", async () => {
      await expect(restartedApply(input(), true)).rejects.toMatchObject({
        code: 23,
      });
      const result = JSON.parse((await restartedApply(input())).stdout);
      expect(result.state).toBe("committed");
      expect(
        (await rows("SELECT photos FROM posts WHERE id=98851"))[0].photos,
      ).toEqual([result.url]);
      expect(wire.objects.size).toBe(1);
      expect(
        await rows(
          "SELECT assetId FROM private_content_files WHERE actorUserId=98851",
        ),
      ).toHaveLength(1);
    });
    it("runs the stream transfer in an independent process and recovers its discarded response", async () => {
      const request = copyInput();
      await conn.query("UPDATE post_media SET url=? WHERE id=98851", [
        request.expectedOldUrl,
      ]);
      await expect(restartedApply(request, true)).rejects.toMatchObject({
        code: 23,
      });
      const result = JSON.parse((await restartedApply(request)).stdout);
      expect(result.state).toBe("committed");
      expect(
        (await rows("SELECT url FROM post_media WHERE id=98851"))[0].url,
      ).toBe(result.url);
      expect(
        wire.effects.filter((effect) => effect.startsWith("PUT ")),
      ).toHaveLength(1);
      expect(
        await rows(
          "SELECT assetId FROM private_attachment_uploads WHERE actorUserId=98851",
        ),
      ).toHaveLength(1);
    });
    it("rechecks role after storage work and can resume only after permission returns", async () => {
      const gate = wire.pausePut(),
        pending = applyLegacyMedia(actor, input());
      await gate.entered;
      await conn.query("UPDATE users SET role='user' WHERE id=98851");
      gate.release();
      await expect(pending).rejects.toMatchObject({ code: "FORBIDDEN" });
      expect(
        (await rows("SELECT photos FROM posts WHERE id=98851"))[0].photos,
      ).toEqual([source]);
      await conn.query("UPDATE users SET role='admin' WHERE id=98851");
      expect((await applyLegacyMedia(actor, input())).state).toBe("committed");
      expect(wire.objects.size).toBe(1);
      expect(
        wire.effects.filter((effect) => effect.startsWith("PUT ")),
      ).toHaveLength(1);
    });
    it("does not resurrect a cancelled pending copy when a late storage response arrives", async () => {
      const gate = wire.pausePut(),
        pending = applyLegacyMedia(actor, input());
      await gate.entered;
      expect(await rollbackLegacyMedia(actor, input())).toEqual({
        state: "rolledBack",
      });
      gate.release();
      await expect(pending).rejects.toMatchObject({ code: "CONFLICT" });
      expect(
        (await rows("SELECT photos FROM posts WHERE id=98851"))[0].photos,
      ).toEqual([source]);
      expect(wire.effects.some((effect) => effect.startsWith("DELETE "))).toBe(
        false,
      );
    });
    it("recovers a lost streaming PUT ACK without another copy", async () => {
      const request = copyInput();
      await conn.query("UPDATE post_media SET url=? WHERE id=98851", [
        request.expectedOldUrl,
      ]);
      wire.dropPutAck();
      await expect(applyLegacyMedia(actor, request)).rejects.toMatchObject({
        code: "SERVICE_UNAVAILABLE",
      });
      expect(
        (await rows("SELECT url FROM post_media WHERE id=98851"))[0].url,
      ).toBe(request.expectedOldUrl);
      expect((await applyLegacyMedia(actor, request)).state).toBe("committed");
      expect(
        wire.effects.filter((effect) => effect.startsWith("PUT ")),
      ).toHaveLength(1);
    });
    it("refuses changed source or corrupt destination evidence before binding", async () => {
      const request = copyInput();
      await conn.query("UPDATE post_media SET url=? WHERE id=98851", [
        request.expectedOldUrl,
      ]);
      wire.objects.get("club/tg/owned-копия@2026.mp4")!.etag = '"changed"';
      await expect(applyLegacyMedia(actor, request)).rejects.toMatchObject({
        code: "SERVICE_UNAVAILABLE",
      });
      expect(
        wire.effects.filter((effect) => effect.startsWith("PUT ")),
      ).toHaveLength(0);
      wire.objects.get("club/tg/owned-копия@2026.mp4")!.etag =
        request.expectedSourceETag;
      wire.dropPutAck();
      await expect(applyLegacyMedia(actor, request)).rejects.toThrow();
      const copied = [...wire.objects.entries()].find(([key]) =>
        key.startsWith("content/private-v1/"),
      )![1];
      copied.bytes[0] ^= 1;
      await expect(applyLegacyMedia(actor, request)).rejects.toMatchObject({
        code: "SERVICE_UNAVAILABLE",
      });
      expect(
        (await rows("SELECT url FROM post_media WHERE id=98851"))[0].url,
      ).toBe(request.expectedOldUrl);
    });
  },
);
