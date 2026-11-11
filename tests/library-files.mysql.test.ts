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

/** Проверяет защищённую выдачу файлов Библиотеки через native HTTP, JWT и SQL с loopback object storage. */
describe.skipIf(!testDatabaseUrl)("library files native HTTP/JWT/SQL", () => {
  let conn: Connection, app: INestApplication, base: string, token: string;
  let wire: Awaited<ReturnType<typeof openPrivateUploadWire>>;
  const made: string[] = [];
  const bytes = Buffer.from("library fixture document");
  /** Создаёт synthetic private-объект с digest и ready-evidence и привязывает его к устойчивому library fileKey. */
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
  /** Отправляет HTTP-запрос с сессией собственного library-reader, сохраняя дополнительные заголовки. */
  const read = (path: string, options: RequestInit = {}) =>
    fetch(base + path, {
      ...options,
      headers: { authorization: `Bearer ${token}`, ...options.headers },
    });
  /** Открывает одноразовую схему, локальный storage-wire и Nest API с включёнными private-флагами. */
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
  /** Удаляет только созданные assetId, сбрасывает wire и возвращает reader и library-флаг. */
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
  /** Закрывает API, удаляет свои bindings/files/период и reader, закрывает пул и wire. */
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
  /** Выдаёт точные байты, HEAD, один Range и 416 через stable URL с no-store и nosniff без storage-address. */
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
  /** Гость, неоплаченный, expired, blocked и stale epoch не достигают storage; действующая paid-подписка читает файл. */
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
  /** Выключенные флаги, отключённая binding, неизвестный материал и URL-параметры не обходят защищённый маршрут. */
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
  /** Список следует sortOrder привязки, а не порядку импортированных объектов. */
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
  /** Сломанная включённая binding даёт 503 авторизованному reader, не успешную пустоту; disabled запись исключается. */
  it("reports a broken enabled binding as unavailable instead of a successful empty list", async () => {
    const asset = await seed();
    await conn.query("DELETE FROM private_content_files WHERE assetId=?", [
      asset,
    ]);
    const effects = wire.effects.length;
    const response = await read("/api/library/materials/patterns/files");
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      error: "Файл временно недоступен.",
    });
    expect(
      (await fetch(base + "/api/library/materials/patterns/files")).status,
    ).toBe(404);
    await conn.query(
      "UPDATE library_file_bindings SET enabled=FALSE WHERE assetId=?",
      [asset],
    );
    expect(
      await (await read("/api/library/materials/patterns/files")).json(),
    ).toEqual({ files: [], nextCursor: null });
    expect(wire.effects.length).toBe(effects);
  });
  /** 52 файла с равным sortOrder обходятся без пропусков; поломка следующей страницы не маскируется пустым успехом. */
  it("pages over equal display orders without gaps or duplicates and does not hide a broken next-page binding", async () => {
    const hidden = await seed("hidden");
    await conn.query(
      "UPDATE library_file_bindings SET enabled=FALSE WHERE assetId=?",
      [hidden],
    );
    const assets: string[] = [];
    const expected = Array.from(
      { length: 52 },
      (_, index) => `file-${String(index).padStart(2, "0")}`,
    );
    for (const [index, key] of expected.entries())
      assets.push(await seed(key, index === 51 ? 1 : 0));
    const effects = wire.effects.length;
    const firstResponse = await read("/api/library/materials/patterns/files");
    expect(firstResponse.status).toBe(200);
    const first = await firstResponse.json();
    expect(
      first.files.map((file: { fileKey: string }) => file.fileKey),
    ).toEqual(expected.slice(0, 50));
    expect(first.nextCursor).toMatch(/^0:[1-9]\d*$/);
    const next = `/api/library/materials/patterns/files?cursor=${encodeURIComponent(first.nextCursor)}`;
    const secondResponse = await read(next);
    expect(secondResponse.status).toBe(200);
    const second = await secondResponse.json();
    expect(
      second.files.map((file: { fileKey: string }) => file.fileKey),
    ).toEqual(["file-50", "file-51"]);
    expect(second.nextCursor).toBeNull();
    await conn.query("DELETE FROM private_content_files WHERE assetId=?", [
      assets[50],
    ]);
    expect((await read(next)).status).toBe(503);
    await conn.query("UPDATE users SET sessionVersion=1 WHERE id=98601");
    expect((await read(next)).status).toBe(404);
    expect(wire.effects.length).toBe(effects);
  });
  /** Некорректные, повторные cursor и неподдерживаемые параметры дают 404 без storage. */
  it("rejects malformed cursors without storage requests", async () => {
    for (const query of [
      "cursor=0",
      "cursor=-1:1",
      "cursor=0:0",
      "cursor=0:2147483648",
      "cursor=0:1&cursor=0:2",
      "url=https://example.test",
    ]) {
      expect(
        (await read(`/api/library/materials/patterns/files?${query}`)).status,
      ).toBe(404);
    }
    expect(wire.effects).toEqual([]);
  });
  /** Staff service-доступ читает пустой согласованный материал, не изображая paid-подписку. */
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
