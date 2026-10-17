import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Connection } from "mysql2/promise";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb } from "../apps/backend/src/db";
import { randomUUID } from "node:crypto";
import { openPrivateUploadWire } from "./helpers/private-upload-wire";
import {
  ensurePrivateUploadObject,
  privateStorageNamespace,
  digest,
} from "../apps/backend/src/media/private-upload-object";

describe.skipIf(!testDatabaseUrl)("library files native HTTP/JWT/SQL", () => {
  let conn: Connection, app: INestApplication, base: string, token: string;
  let wire: Awaited<ReturnType<typeof openPrivateUploadWire>>;
  const made: string[] = [];
  const bytes = Buffer.from("library fixture document");
  async function seed(key = "holly", order = 0) {
    const assetId = randomUUID();
    made.push(assetId);
    const namespaceHash = privateStorageNamespace().hash;
    const payloadHash = digest(bytes);
    const stored = await ensurePrivateUploadObject(
      {
        scope: "content",
        assetId,
        type: "document",
        payloadHash,
        mimeType: "text/plain; charset=utf-8",
        fileSize: bytes.length,
        namespaceHash,
      },
      bytes,
    );
    const [result] = await conn.execute<import("mysql2").ResultSetHeader>(
      "INSERT INTO library_file_bindings(materialKey,fileKey,assetId,sortOrder,enabled,revision) VALUES('patterns',?,?,?,TRUE,1)",
      [key, assetId, order],
    );
    await conn.query(
      "INSERT INTO private_content_files(requestKey,actorUserId,assetId,payloadHash,namespaceHash,`usage`,filename,mimeType,fileSize,state,etag,parentKind,parentId) VALUES(?,98601,?,?,?,'libraryDocument','fixture.txt','text/plain; charset=utf-8',?,'ready',?,'library',?)",
      [
        digest(assetId),
        assetId,
        payloadHash,
        namespaceHash,
        bytes.length,
        stored,
        result.insertId,
      ],
    );
    return assetId;
  }
  const read = (path: string, options: RequestInit = {}) =>
    fetch(base + path, {
      ...options,
      headers: { authorization: `Bearer ${token}`, ...options.headers },
    });
  beforeAll(async () => {
    conn = await openTestDatabase();
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    vi.stubEnv("JWT_SECRET", "library-native-synthetic-session-key-32");
    vi.stubEnv("PRIVATE_LIBRARY_FILES_ENABLED", "true");
    vi.stubEnv("PRIVATE_CONTENT_FILES_ENABLED", "true");
    wire = await openPrivateUploadWire({ content: true });
    vi.stubEnv("S3_ENDPOINT", wire.endpoint);
    vi.stubEnv("S3_BUCKET", wire.bucket);
    vi.stubEnv("S3_ACCESS_KEY", "library-test-access");
    vi.stubEnv("S3_SECRET_KEY", "library-test-secret");
    await conn.query(
      "INSERT INTO users(id,openId,role) VALUES(98601,'library-member','moderator')",
    );
    token = await sdk.createSessionToken("library-member", {
      sessionVersion: 0,
    });
    app = await createBackendApplication();
    await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  });
  beforeEach(async () => {
    for (const id of made) {
      await conn.query("DELETE FROM library_file_bindings WHERE assetId=?", [
        id,
      ]);
      await conn.query("DELETE FROM private_content_files WHERE assetId=?", [
        id,
      ]);
    }
    made.length = 0;
    wire.objects.clear();
    wire.effects.length = 0;
    await conn.query(
      "UPDATE users SET role='moderator',blockedAt=NULL,sessionVersion=0 WHERE id=98601",
    );
    await conn.query("DELETE FROM club_payments WHERE orderId='library-paid'");
    vi.stubEnv("PRIVATE_LIBRARY_FILES_ENABLED", "true");
  });
  afterAll(async () => {
    await app?.close();
    for (const id of made) {
      await conn?.query("DELETE FROM library_file_bindings WHERE assetId=?", [
        id,
      ]);
      await conn?.query("DELETE FROM private_content_files WHERE assetId=?", [
        id,
      ]);
    }
    await conn?.query("DELETE FROM club_payments WHERE orderId='library-paid'");
    await conn?.query("DELETE FROM users WHERE id=98601");
    await conn?.end();
    await (
      (await getDb()) as unknown as { $client: { end(): Promise<void> } }
    )?.$client.end();
    await wire?.close();
    vi.unstubAllEnvs();
  });
  it("streams exact bytes, HEAD and single Range through the stable URL without disclosing a storage address", async () => {
    await seed();
    const listed = await read("/api/library/materials/patterns/files");
    const result = await listed.json();
    expect(result.files).toEqual([
      {
        fileKey: "holly",
        sortOrder: 0,
        revision: 1,
        filename: "fixture.txt",
        mimeType: "text/plain; charset=utf-8",
        fileSize: 24,
        url: "/api/media/library-files/patterns/holly",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain(wire.endpoint);
    const path = "/api/media/library-files/patterns/holly";
    const response = await read(path);
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    const head = await read(path, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe("");
    const partial = await read(path, { headers: { range: "bytes=0-6" } });
    expect(partial.status).toBe(206);
    expect(await partial.text()).toBe("library");
    expect(
      (await read(path, { headers: { range: "bytes=99-100" } })).status,
    ).toBe(416);
  });
  it("denies guests, unpaid, expired, blocked and stale actors before storage and preserves paid access", async () => {
    await seed();
    const path = "/api/media/library-files/patterns/holly";
    const effects = wire.effects.length;
    expect((await fetch(base + path)).status).toBe(404);
    await conn.query("UPDATE users SET role='user' WHERE id=98601");
    expect((await read(path)).status).toBe(404);
    await conn.query(
      "INSERT INTO club_payments(userId,orderId,status,expiresAt) VALUES(98601,'library-paid','paid',DATE_ADD(NOW(),INTERVAL 1 DAY))",
    );
    expect((await read(path)).status).toBe(200);
    await conn.query(
      "UPDATE club_payments SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 DAY) WHERE orderId='library-paid'",
    );
    const deniedEffects = wire.effects.length;
    expect((await read(path)).status).toBe(404);
    await conn.query(
      "UPDATE users SET role='moderator',blockedAt=NOW() WHERE id=98601",
    );
    expect((await read(path)).status).toBe(404);
    await conn.query(
      "UPDATE users SET blockedAt=NULL,sessionVersion=1 WHERE id=98601",
    );
    expect((await read(path)).status).toBe(404);
    expect((await read("/api/library/materials/patterns/files")).status).toBe(
      404,
    );
    expect(wire.effects.length).toBe(deniedEffects);
    expect(effects).toBeLessThan(deniedEffects);
  });
  it("fails closed for disabled flags, unbound files, unknown keys and arbitrary query URLs", async () => {
    const asset = await seed();
    const effects = wire.effects.length;
    vi.stubEnv("PRIVATE_LIBRARY_FILES_ENABLED", "");
    expect((await read("/api/media/library-files/patterns/holly")).status).toBe(
      404,
    );
    expect((await read(`/api/media/content-files/${asset}`)).status).toBe(404);
    vi.stubEnv("PRIVATE_LIBRARY_FILES_ENABLED", "true");
    expect(
      (
        await read(
          "/api/media/library-files/patterns/holly?url=https://example.test/a",
        )
      ).status,
    ).toBe(404);
    expect((await read("/api/library/materials/unknown/files")).status).toBe(
      404,
    );
    await conn.query(
      "UPDATE library_file_bindings SET enabled=FALSE WHERE assetId=?",
      [asset],
    );
    expect((await read("/api/media/library-files/patterns/holly")).status).toBe(
      404,
    );
    expect((await read(`/api/media/content-files/${asset}`)).status).toBe(404);
    expect(wire.effects.length).toBe(effects);
  });
  it("returns the agreed display order rather than insertion order", async () => {
    await seed("holly", 10);
    await seed("star", 0);
    const response = await read("/api/library/materials/patterns/files");
    expect(
      (await response.json()).files.map(
        (file: { fileKey: string }) => file.fileKey,
      ),
    ).toEqual(["star", "holly"]);
  });
  it("allows a service-access reader to list an empty approved material without claiming a paid subscription", async () => {
    const response = await fetch(
      base + "/api/library/materials/patterns/files",
      { headers: { authorization: `Bearer ${token}` } },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ files: [], nextCursor: null });
  });
});
