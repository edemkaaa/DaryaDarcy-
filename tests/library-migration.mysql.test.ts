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
import { randomUUID, createHash } from "node:crypto";
import sharp from "sharp";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { openPrivateUploadWire } from "./helpers/private-upload-wire";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { getDb } from "../apps/backend/src/db";
import { sdk } from "../apps/backend/src/_core/sdk";
import {
  applyLibraryMigration,
  rollbackLibraryMigration,
  inspectLibraryMigration,
} from "../apps/backend/src/content/library-file-migration";

describe.skipIf(!testDatabaseUrl)(
  "library migration rehearsal on native SQL/API/loopback wire",
  () => {
    let conn: Connection,
      app: INestApplication,
      base: string,
      wire: Awaited<ReturnType<typeof openPrivateUploadWire>>,
      token: string;
    const actor = { id: 98701, sessionVersion: 0 };
    const hash = (bytes: Buffer) =>
      createHash("sha256").update(bytes).digest("hex");
    const document = (
      fileKey = "main",
      text = "fixture library bytes",
      expectedRevision = 0,
    ) => {
      const bytes = Buffer.from(text);
      return {
        fileKey,
        filename: "fixture.txt",
        mimeType: "text/plain",
        bytes,
        sha256: hash(bytes),
        sortOrder: 0,
        expectedRevision,
      };
    };
    const input = (files = [document()], materialKey = "recipes") => ({
      materialKey,
      idempotencyKey: "library-rehearsal-" + randomUUID(),
      files,
    });
    async function rows(sql: string, args: unknown[] = []) {
      return (await conn.query<RowDataPacket[]>(sql, args))[0];
    }
    async function clear() {
      await conn.query("DROP TRIGGER IF EXISTS library_rehearsal_refusal");
      await conn.query(
        "DELETE b FROM library_file_bindings b JOIN private_content_files f ON f.assetId=b.assetId WHERE f.actorUserId IN (98701,98702)",
      );
      await conn.query(
        "DELETE FROM private_content_files WHERE actorUserId IN (98701,98702)",
      );
      await conn.query("DELETE FROM library_file_migrations");
      await conn.query(
        "DELETE FROM club_payments WHERE orderId='library-rehearsal-paid'",
      );
    }
    beforeAll(async () => {
      conn = await openTestDatabase();
      wire = await openPrivateUploadWire({ content: true });
      for (const [key, value] of Object.entries({
        DATABASE_URL: testDatabaseUrl!,
        JWT_SECRET: "library-rehearsal-synthetic-jwt-key",
        S3_ENDPOINT: wire.endpoint,
        S3_BUCKET: wire.bucket,
        S3_ACCESS_KEY: "library-wire-fixture",
        S3_SECRET_KEY: "library-wire-fixture-secret",
        PRIVATE_LIBRARY_FILES_ENABLED: "true",
        PRIVATE_CONTENT_FILES_ENABLED: "true",
      }))
        vi.stubEnv(key, value);
      await conn.query(
        "INSERT INTO users(id,openId,role) VALUES(98701,'library-rehearsal-admin','admin'),(98702,'library-rehearsal-other','admin'),(98703,'library-rehearsal-reader','moderator')",
      );
      token = await sdk.createSessionToken("library-rehearsal-reader", {
        sessionVersion: 0,
      });
      app = await createBackendApplication();
      await app.listen(0, "127.0.0.1");
      base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    });
    beforeEach(async () => {
      await clear();
      wire.objects.clear();
      wire.effects.length = 0;
      await conn.query(
        "UPDATE users SET blockedAt=NULL,sessionVersion=0,accountDeletionRequestedAt=NULL,role='admin' WHERE id IN (98701,98702)",
      );
      vi.stubEnv("PRIVATE_LIBRARY_FILES_ENABLED", "true");
    });
    afterAll(async () => {
      await app?.close();
      if (conn) {
        await clear();
        await conn.query("DELETE FROM users WHERE id BETWEEN 98701 AND 98703");
        await conn.end();
      }
      await (
        (await getDb()) as unknown as { $client: { end(): Promise<void> } }
      )?.$client.end();
      await wire?.close();
      vi.unstubAllEnvs();
    });
    const read = (path: string) =>
      fetch(base + path, { headers: { authorization: `Bearer ${token}` } });
    async function restartedImport(
      request: ReturnType<typeof input>,
      discardReply = false,
    ) {
      const serialized = JSON.stringify({
        ...request,
        files: request.files.map((file) => ({
          ...file,
          bytes: file.bytes.toString("base64"),
        })),
      });
      // A separate Node process has no importer module/cache state from the prior attempt.
      const script = `const {applyLibraryMigration}=require('./apps/backend/src/content/library-file-migration');const {getDb}=require('./apps/backend/src/db');async function main(){try{const input=${serialized};input.files=input.files.map(f=>({...f,bytes:Buffer.from(f.bytes,'base64')}));const result=await applyLibraryMigration(${JSON.stringify(actor)},input);${discardReply ? "process.exitCode=23;" : "console.log(JSON.stringify(result));"}}finally{await (await getDb())?.$client.end();}}main().catch(()=>{process.exitCode=1;});`;
      return promisify(execFile)(
        process.execPath,
        ["--require", "tsx/cjs", "--eval", script],
        {
          cwd: fileURLToPath(new URL("../", import.meta.url)),
          timeout: 30000,
          env: {
            PATH: process.env.PATH,
            NODE_ENV: "test",
            DATABASE_URL: testDatabaseUrl!,
            S3_ENDPOINT: wire.endpoint,
            S3_BUCKET: wire.bucket,
            S3_ACCESS_KEY: "library-wire-fixture",
            S3_SECRET_KEY: "library-wire-fixture-secret",
            PRIVATE_LIBRARY_FILES_ENABLED: "true",
            PRIVATE_CONTENT_FILES_ENABLED: "true",
          },
        },
      );
    }
    it("records intent before lost storage ACK and publishes the whole material once on retry", async () => {
      const request = input([document("first"), document("second")]);
      wire.dropPutAck();
      await expect(applyLibraryMigration(actor, request)).rejects.toThrow();
      expect(await rows("SELECT state FROM library_file_migrations")).toEqual([
        { state: "pending" },
      ]);
      expect(await rows("SELECT id FROM library_file_bindings")).toEqual([]);
      expect((await applyLibraryMigration(actor, request)).state).toBe(
        "committed",
      );
      expect((await applyLibraryMigration(actor, request)).state).toBe(
        "committed",
      );
      expect(wire.objects.size).toBe(2);
      expect(wire.effects.filter((e) => e.startsWith("PUT "))).toHaveLength(2);
      expect(
        await rows(
          "SELECT fileKey,revision FROM library_file_bindings ORDER BY fileKey",
        ),
      ).toEqual([
        { fileKey: "first", revision: 1 },
        { fileKey: "second", revision: 1 },
      ]);
      expect(
        await (await read("/api/media/library-files/recipes/first")).text(),
      ).toBe("fixture library bytes");
      await expect(
        applyLibraryMigration(actor, {
          ...request,
          files: [document("first", "changed"), document("second")],
        }),
      ).rejects.toMatchObject({ code: "CONFLICT" });
    });
    it("rolls back a failed binding transaction and retries without additional binary copies", async () => {
      const request = input([document("first"), document("second")]);
      await conn.query(
        "CREATE TRIGGER library_rehearsal_refusal BEFORE INSERT ON library_file_bindings FOR EACH ROW BEGIN IF NEW.fileKey='second' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='fixture refusal'; END IF; END",
      );
      await expect(applyLibraryMigration(actor, request)).rejects.toThrow();
      expect(await rows("SELECT id FROM library_file_bindings")).toEqual([]);
      expect(wire.objects.size).toBe(2);
      await conn.query("DROP TRIGGER library_rehearsal_refusal");
      await applyLibraryMigration(actor, request);
      expect(wire.effects.filter((e) => e.startsWith("PUT "))).toHaveLength(2);
    });
    it("keeps stable URLs through replacement and revision-guarded rollback, never reviving the rolled-back import", async () => {
      const first = input();
      await applyLibraryMigration(actor, first);
      const second = input([document("main", "replacement", 1)]);
      await applyLibraryMigration(actor, second);
      expect(
        await (await read("/api/media/library-files/recipes/main")).text(),
      ).toBe("replacement");
      expect(
        (await rollbackLibraryMigration(actor, second.idempotencyKey)).state,
      ).toBe("rolledBack");
      expect(
        (await rollbackLibraryMigration(actor, second.idempotencyKey)).state,
      ).toBe("rolledBack");
      expect(
        await (await read("/api/media/library-files/recipes/main")).text(),
      ).toBe("fixture library bytes");
      expect(await rows("SELECT revision FROM library_file_bindings")).toEqual([
        { revision: 3 },
      ]);
      await expect(applyLibraryMigration(actor, second)).rejects.toMatchObject({
        code: "CONFLICT",
      });
      const third = input([document("main", "third", 3)]);
      await applyLibraryMigration(actor, third);
      await expect(
        rollbackLibraryMigration(actor, first.idempotencyKey),
      ).rejects.toMatchObject({ code: "CONFLICT" });
      expect(wire.objects.size).toBe(3);
    });
    it("rejects stale revisions and disabled or revoked operators before binary writes", async () => {
      await applyLibraryMigration(actor, input());
      const effects = wire.effects.length;
      await expect(applyLibraryMigration(actor, input())).rejects.toMatchObject(
        { code: "CONFLICT" },
      );
      await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=98701");
      await expect(
        applyLibraryMigration(actor, input([document("other")])),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      vi.stubEnv("PRIVATE_LIBRARY_FILES_ENABLED", "");
      await expect(
        applyLibraryMigration(actor, input([document("another")])),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(wire.effects.length).toBe(effects);
    });
    it("rehearses six synthetic files across process restarts and lost copy/commit replies without touching public controls", async () => {
      const patternFiles = [];
      for (const [sortOrder, fileKey] of [
        "holly",
        "sock",
        "star",
        "apple",
      ].entries()) {
        const bytes = await sharp({
          create: {
            width: 4,
            height: 5,
            channels: 3,
            background: { r: sortOrder * 40, g: 20, b: 60 },
          },
        })
          .webp({ lossless: true })
          .toBuffer();
        patternFiles.push({
          ...document(fileKey),
          filename: `${fileKey}.webp`,
          mimeType: "image/webp",
          bytes,
          sha256: hash(bytes),
          sortOrder,
        });
      }
      const requests = [
        input([document("main", "synthetic recipes")]),
        input(
          [document("main", "synthetic Petersburg placeholder")],
          "peterburg",
        ),
        input(patternFiles, "patterns"),
      ];
      const publicBytes = Buffer.from(
        "synthetic public horse/styling/cover control",
      );
      wire.objects.set("public-control/fixture", {
        bytes: publicBytes,
        etag: '"fixture-control"',
        mime: "text/plain",
        metadata: {},
      });
      const publicBefore = structuredClone(
        wire.objects.get("public-control/fixture"),
      );
      for (const request of requests)
        expect(await inspectLibraryMigration(request)).toMatchObject({
          files: request.files.length,
        });
      expect(wire.effects).toEqual([]);
      expect(await rows("SELECT id FROM library_file_bindings")).toEqual([]);
      wire.dropPutAck();
      await expect(restartedImport(requests[0])).rejects.toThrow();
      expect(await rows("SELECT state FROM library_file_migrations")).toEqual([
        { state: "pending" },
      ]);
      await restartedImport(requests[0]);
      // Child commits durably but deliberately loses its result to the caller.
      await expect(restartedImport(requests[1], true)).rejects.toMatchObject({
        code: 23,
      });
      const effects = wire.effects.length;
      await restartedImport(requests[1]);
      expect(wire.effects.length).toBe(effects);
      await restartedImport(requests[2]);
      expect(
        await rows(
          "SELECT COUNT(*) AS n FROM library_file_bindings WHERE enabled=1",
        ),
      ).toEqual([{ n: 6 }]);
      expect(
        await rows(
          "SELECT COUNT(*) AS n FROM private_content_files WHERE actorUserId=98701",
        ),
      ).toEqual([{ n: 6 }]);
      expect(await rows("SELECT state FROM library_file_migrations")).toEqual([
        { state: "committed" },
        { state: "committed" },
        { state: "committed" },
      ]);
      expect(
        wire.effects.filter((effect) => effect.startsWith("PUT ")),
      ).toHaveLength(6);
      for (const request of requests) {
        const listing = await (
          await read(`/api/library/materials/${request.materialKey}/files`)
        ).json();
        expect(
          listing.files.map((file: { fileKey: string }) => file.fileKey),
        ).toEqual(request.files.map((file) => file.fileKey));
        expect(JSON.stringify(listing)).not.toMatch(
          /private-v1|127\.0\.0\.1|s3\.|sha256/,
        );
        for (const file of request.files) {
          const response = await read(
            `/api/media/library-files/${request.materialKey}/${file.fileKey}`,
          );
          expect(response.status).toBe(200);
          expect(hash(Buffer.from(await response.arrayBuffer()))).toBe(
            file.sha256,
          );
        }
      }
      expect(
        structuredClone(wire.objects.get("public-control/fixture")),
      ).toEqual(publicBefore);
      expect(
        wire.effects.some((effect) => effect.includes("public-control")),
      ).toBe(false);
    }, 40000);
    it("serializes simultaneous retries into one committed operation and one asset per slot", async () => {
      const request = input([document("first"), document("second")]);
      const attempts = await Promise.allSettled(
        Array.from({ length: 4 }, () => applyLibraryMigration(actor, request)),
      );
      // A conditional PUT race may return retryable 503, never an overwrite/new key.
      for (const attempt of attempts)
        if (attempt.status === "rejected")
          expect(attempt.reason).toMatchObject({ code: "SERVICE_UNAVAILABLE" });
      const results = await Promise.all(
        Array.from({ length: 4 }, () => applyLibraryMigration(actor, request)),
      );
      expect(results.every((result) => result.state === "committed")).toBe(
        true,
      );
      expect(
        new Set(results.map((result) => JSON.stringify(result.bindings))).size,
      ).toBe(1);
      expect(
        await rows("SELECT COUNT(*) AS n FROM library_file_migrations"),
      ).toEqual([{ n: 1 }]);
      expect(
        await rows(
          "SELECT COUNT(*) AS n FROM private_content_files WHERE actorUserId=98701",
        ),
      ).toEqual([{ n: 2 }]);
      expect(wire.objects.size).toBe(2);
    });
    it("keeps copied pending files unreadable and refuses recovery after operator revocation", async () => {
      const request = input();
      wire.dropPutAck();
      await expect(applyLibraryMigration(actor, request)).rejects.toThrow();
      const [file] = await rows(
        "SELECT assetId FROM private_content_files WHERE actorUserId=98701",
      );
      const effects = wire.effects.length;
      expect(
        (await read(`/api/media/content-files/${file.assetId}`)).status,
      ).toBe(404);
      expect((await read("/api/media/library-files/recipes/main")).status).toBe(
        404,
      );
      await conn.query("UPDATE users SET sessionVersion=1 WHERE id=98701");
      await expect(applyLibraryMigration(actor, request)).rejects.toMatchObject(
        { code: "UNAUTHORIZED" },
      );
      expect(wire.effects.length).toBe(effects);
      expect(await rows("SELECT id FROM library_file_bindings")).toEqual([]);
    });
    it("refuses a nontransactional binding table before recording intent or copying bytes", async () => {
      await conn.query("ALTER TABLE library_file_bindings ENGINE=MyISAM");
      try {
        await expect(
          applyLibraryMigration(actor, input()),
        ).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
        expect(
          await rows("SELECT requestKey FROM library_file_migrations"),
        ).toEqual([]);
        expect(wire.effects).toEqual([]);
      } finally {
        await conn.query("ALTER TABLE library_file_bindings ENGINE=InnoDB");
      }
    });
  },
);
