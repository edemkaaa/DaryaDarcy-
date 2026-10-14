import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Connection, RowDataPacket } from "mysql2/promise";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import superjson from "superjson";
import sharp from "sharp";
import { openContentTestDatabase } from "./helpers/content-mysql";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openPrivateUploadWire } from "./helpers/private-upload-wire";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb } from "../apps/backend/src/db";

describe.skipIf(!testDatabaseUrl)("new private content files on native HTTP/SQL and loopback SDK wire", () => {
  let conn: Connection, app: INestApplication, base: string;
  let wire: Awaited<ReturnType<typeof openPrivateUploadWire>>;
  const tokens: Record<string, string> = {};
  const input = { idempotencyKey: "content-upload-intent-0001", usage: "articleDocument", filename: "article.txt", mimeType: "text/plain", base64: Buffer.from("private article document").toString("base64") };
  async function rows(query: string, args: unknown[] = []) { return (await conn.query<RowDataPacket[]>(query, args))[0]; }
  async function call(method: string, data: unknown = input, who = "admin", query = false) {
    const encoded = superjson.stringify(data);
    const response = await fetch(`${base}/api/trpc/${method}${query ? `?input=${encodeURIComponent(encoded)}` : ""}`, {
      method: query ? "GET" : "POST", headers: { "content-type": "application/json", ...(tokens[who] ? { authorization: `Bearer ${tokens[who]}` } : {}) },
      ...(query ? {} : { body: encoded }), signal: AbortSignal.timeout(20000),
    });
    const json = await response.json();
    return { status: response.status, data: json.result ? superjson.deserialize<Record<string, unknown>>(json.result.data) : null, wire: JSON.stringify(json) };
  }
  const upload = (value: unknown = input, who = "admin") => call("admin.uploadPrivateContentFile", value, who);
  const status = (who = "admin") => call("admin.privateContentFileStatus", { idempotencyKey: input.idempotencyKey }, who, true);
  beforeAll(async () => {
    conn = await openContentTestDatabase();
    wire = await openPrivateUploadWire({ content: true });
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    vi.stubEnv("JWT_SECRET", "content-fixture-jwt-secret-32-characters");
    vi.stubEnv("S3_ENDPOINT", wire.endpoint); vi.stubEnv("S3_BUCKET", wire.bucket);
    vi.stubEnv("S3_ACCESS_KEY", "content-fixture-access"); vi.stubEnv("S3_SECRET_KEY", "content-fixture-secret");
    await conn.query("INSERT INTO users(id,openId,role) VALUES(98150,'cf-admin','admin'),(98151,'cf-other','admin'),(98152,'cf-member','user')");
    app = await createBackendApplication(); await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    for (const name of ["admin", "other", "member"]) tokens[name] = await sdk.createSessionToken(`cf-${name}`, { sessionVersion: 0 });
  });
  beforeEach(async () => {
    if ((await rows("SHOW TABLES LIKE 'private_content_files'")).length) await conn.query("DELETE FROM private_content_files WHERE actorUserId IN (98150,98151,98152)");
    await conn.query("UPDATE users SET role='admin',sessionVersion=0,blockedAt=NULL,accountDeletionRequestedAt=NULL WHERE id=98150");
    vi.stubEnv("PRIVATE_CONTENT_FILES_ENABLED", "true"); vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "false");
    vi.stubEnv("S3_BUCKET", wire.bucket); wire.objects.clear(); wire.effects.length = 0; wire.rejectPolicy(false);
  });
  afterAll(async () => {
    await app?.close();
    if (conn) {
      if ((await rows("SHOW TABLES LIKE 'private_content_files'")).length) await conn.query("DELETE FROM private_content_files WHERE actorUserId IN (98150,98151,98152)");
      await conn.query("DELETE FROM users WHERE id IN (98150,98151,98152)"); await conn.end();
    }
    if (app) await ((await getDb()) as unknown as { $client: { end(): Promise<void> } })?.$client.end();
    await wire?.close(); vi.unstubAllEnvs();
  });
  it("records a ready receipt and returns only an application URL", async () => {
    const result = await upload(); expect(result.status).toBe(200);
    expect(result.data).toMatchObject({ state: "ready", usage: "articleDocument", mimeType: "text/plain; charset=utf-8", fileSize: 24 });
    expect(result.data!.url).toMatch(/^\/api\/media\/content-files\/[a-f0-9-]{36}$/);
    expect(result.wire).not.toContain(wire.endpoint); expect(result.wire).not.toContain("content/private-v1");
    expect(await rows("SELECT state,parentId FROM private_content_files WHERE actorUserId=98150")).toEqual([{ state: "ready", parentId: null }]);
    expect((await status()).data).toEqual(result.data);
  });
  it("reconciles lost storage ACK without creating another object", async () => {
    wire.dropPutAck(); expect((await upload()).status).toBe(503);
    expect((await status()).data).toMatchObject({ state: "pending" });
    expect((await upload()).data).toMatchObject({ state: "ready" });
    expect(wire.objects.size).toBe(1); expect(wire.effects.filter(value => value.startsWith("PUT "))).toHaveLength(1);
  });
  it("serializes concurrent same-intent uploads and rejects a changed payload", async () => {
    const results = await Promise.all(Array.from({ length: 4 }, () => upload()));
    expect(results.map(value => value.status)).toEqual([200,200,200,200]);
    expect(new Set(results.map(value => value.data!.assetId)).size).toBe(1);
    expect((await upload({ ...input, filename: "different.txt" })).status).toBe(409);
    expect((await upload({ ...input, base64: Buffer.from("different").toString("base64") })).status).toBe(409);
    expect(wire.objects.size).toBe(1);
    expect((await status("other")).data).toEqual({ state: "notRecorded" });
  });
  it("does not write storage for disabled, unauthenticated or non-admin uploads", async () => {
    vi.stubEnv("PRIVATE_CONTENT_FILES_ENABLED", "false"); expect((await upload()).status).toBe(404);
    vi.stubEnv("PRIVATE_CONTENT_FILES_ENABLED", "true"); expect((await upload(input, "guest")).status).toBe(401);
    expect((await upload(input, "member")).status).toBe(403); expect(wire.objects.size).toBe(0);
  });
  it("retains pending evidence on policy refusal and can resume the same intent", async () => {
    wire.rejectPolicy(true); expect((await upload()).status).toBe(503); expect(wire.objects.size).toBe(0);
    expect((await status()).data).toMatchObject({ state: "pending" });
    wire.rejectPolicy(false); expect((await upload()).data).toMatchObject({ state: "ready" });
  });
  it("refuses stale sessions, pending account deletion and expired recovery", async () => {
    await conn.query("UPDATE users SET sessionVersion=1 WHERE id=98150"); expect((await upload()).status).toBe(401);
    await conn.query("UPDATE users SET sessionVersion=0,accountDeletionRequestedAt=NOW() WHERE id=98150"); expect((await upload()).status).toBe(403);
    await conn.query("UPDATE users SET accountDeletionRequestedAt=NULL WHERE id=98150"); expect((await upload()).status).toBe(200);
    await conn.query("UPDATE private_content_files SET createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=98150");
    vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "true"); expect((await upload()).status).toBe(409); expect((await status()).status).toBe(409);
  });
  it("normalizes genuine photo bytes and refuses active content without creating a ledger entry", async () => {
    const png = await sharp({ create: { width: 2, height: 3, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 0.5 } } }).png().toBuffer();
    const photo = { ...input, usage: "postPhoto", filename: "photo.png", mimeType: "image/png", base64: png.toString("base64") };
    expect((await upload(photo)).data).toMatchObject({ state: "ready", mimeType: "image/webp" });
    const stored = [...wire.objects.values()][0]; expect(await sharp(stored.bytes).metadata()).toMatchObject({ format: "webp", hasAlpha: true });
    expect((await upload({ ...photo, idempotencyKey: "content-invalid-photo-001", base64: Buffer.from("<svg/>").toString("base64") })).status).toBe(400);
    expect(await rows("SELECT assetId FROM private_content_files WHERE actorUserId=98150")).toHaveLength(1);
  });
});
