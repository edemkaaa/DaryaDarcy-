import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Connection, RowDataPacket } from "mysql2/promise";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { users } from "../packages/database/src/schema";
import { retireContentRecovery } from "../apps/backend/src/content/recovery-retirement";
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
  const madePosts = new Set<number>();
  const madeArticles = new Set<number>();
  const madeFiles = new Set<string>();
  const input = { idempotencyKey: "content-upload-intent-0001", usage: "articleDocument", filename: "article.txt", mimeType: "text/plain", base64: Buffer.from("private article document").toString("base64") };
  async function rows(query: string, args: unknown[] = []) { return (await conn.query<RowDataPacket[]>(query, args))[0]; }
  async function call(method: string, data: unknown = input, who = "admin", query = false, signal = AbortSignal.timeout(20000)) {
    const encoded = superjson.stringify(data);
    const response = await fetch(`${base}/api/trpc/${method}${query ? `?input=${encodeURIComponent(encoded)}` : ""}`, {
      method: query ? "GET" : "POST", headers: { "content-type": "application/json", ...(tokens[who] ? { authorization: `Bearer ${tokens[who]}` } : {}) },
      ...(query ? {} : { body: encoded }), signal,
    });
    const json = await response.json();
    return { status: response.status, data: json.result ? superjson.deserialize<Record<string, unknown>>(json.result.data) : null, wire: JSON.stringify(json) };
  }
  async function upload(value: unknown = input, who = "admin") {
    const result = await call("admin.uploadPrivateContentFile", value, who);
    if (result.data?.assetId) madeFiles.add(String(result.data.assetId)); return result;
  }
  const status = (who = "admin") => call("admin.privateContentFileStatus", { idempotencyKey: input.idempotencyKey }, who, true);
  async function photo(usage = "postPhoto", key = "content-photo-intent-0001") {
    const png = await sharp({ create: { width: 2, height: 3, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 0.5 } } }).png().toBuffer();
    const result = await upload({ ...input, idempotencyKey: key, usage, filename: "photo.png", mimeType: "image/png", base64: png.toString("base64") });
    expect(result.status).toBe(200); return result.data!;
  }
  const postInput = (url: string) => ({ text: "Private content post", source: "cf-photos", tags: [], photos: [url], target: "club", status: "draft", idempotencyKey: "content-post-create-0001" });
  async function makePost(data: unknown, who = "admin") {
    const result = await call("admin.createPost", data, who);
    if (result.status === 200) madePosts.add(Number(result.data)); return result;
  }
  async function makeArticle(data: unknown, who = "admin") {
    const result = await call("admin.createArticle", data, who);
    if (result.status === 200) madeArticles.add(Number(result.data)); return result;
  }
  async function clearArticles() {
    for (const id of madeArticles) { await conn.query("DELETE FROM posts WHERE source=?", [`article:${id}`]); await conn.query("DELETE FROM articles WHERE id=?", [id]); }
    madeArticles.clear(); await conn.query("DELETE FROM article_creation_requests WHERE actorUserId IN (98150,98151)");
  }
  async function commentPhoto(postId: number, idempotencyKey = input.idempotencyKey) {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
    const result = await call("club.uploadPrivateCommentPhoto", { ...input, idempotencyKey, usage: "commentPhoto", postId, filename: "photo.png", mimeType: "image/png", base64: png.toString("base64") }, "member");
    if (result.data?.assetId) madeFiles.add(String(result.data.assetId)); return result;
  }
  async function readFile(url: string, who = "guest", method = "GET", range?: string) {
    return fetch(`${base}${url}`, { method, headers: { ...(tokens[who] ? { authorization: `Bearer ${tokens[who]}` } : {}), ...(range ? { range } : {}) } });
  }
  beforeAll(async () => {
    conn = await openContentTestDatabase();
    await conn.query("CREATE TABLE IF NOT EXISTS articles(id INT AUTO_INCREMENT PRIMARY KEY,title VARCHAR(255) NOT NULL,coverUrl TEXT,access ENUM('public','club') NOT NULL DEFAULT 'public',published BOOLEAN NOT NULL DEFAULT TRUE,sortOrder INT NOT NULL DEFAULT 0,sections JSON NOT NULL,createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB");
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
    for (const id of madeFiles) await conn.query("DELETE FROM private_content_files WHERE assetId=?", [id]); madeFiles.clear();
    await clearArticles();
    for (const id of madePosts) { await conn.query("DELETE FROM post_comments WHERE postId=?", [id]); await conn.query("DELETE FROM posts WHERE id=?", [id]); } madePosts.clear();
    if ((await rows("SHOW TABLES LIKE 'comment_creation_requests'")).length) await conn.query("DELETE FROM comment_creation_requests WHERE actorUserId=98152");
    await conn.query("UPDATE users SET blockedAt=NULL,sessionVersion=0,accountDeletionRequestedAt=NULL WHERE id=98152");
    await conn.query("DELETE FROM club_payments WHERE orderId='cf-paid-reader'");
    await conn.query("DELETE FROM post_creation_requests WHERE actorUserId IN (98150,98151)");
    if ((await rows("SHOW TABLES LIKE 'private_content_files'")).length) await conn.query("DELETE FROM private_content_files WHERE actorUserId IN (98150,98151,98152)");
    await conn.query("UPDATE users SET role='admin',sessionVersion=0,blockedAt=NULL,accountDeletionRequestedAt=NULL WHERE id=98150");
    await conn.query("UPDATE users SET role='admin',sessionVersion=0,blockedAt=NULL WHERE id=98151");
    vi.stubEnv("PRIVATE_CONTENT_FILES_ENABLED", "true"); vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "false");
    vi.stubEnv("S3_BUCKET", wire.bucket); wire.objects.clear(); wire.effects.length = 0; wire.rejectPolicy(false);
  });
  afterAll(async () => {
    await app?.close();
    if (conn) {
      for (const id of madeFiles) await conn.query("DELETE FROM private_content_files WHERE assetId=?", [id]);
      await clearArticles();
      for (const id of madePosts) { await conn.query("DELETE FROM post_comments WHERE postId=?", [id]); await conn.query("DELETE FROM posts WHERE id=?", [id]); }
      if ((await rows("SHOW TABLES LIKE 'comment_creation_requests'")).length) await conn.query("DELETE FROM comment_creation_requests WHERE actorUserId=98152");
      await conn.query("DELETE FROM club_payments WHERE orderId='cf-paid-reader'");
      await conn.query("DELETE FROM post_creation_requests WHERE actorUserId IN (98150,98151)");
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
  it("cancels storage on HTTP disconnect and recovers the same object on retry", async () => {
    const gate = wire.pausePut();
    const browser = new AbortController();
    const request = call("admin.uploadPrivateContentFile", input, "admin", false, browser.signal);
    const aborted = expect(request).rejects.toMatchObject({ name: "AbortError" });
    try {
      await gate.entered;
      browser.abort();
      await aborted;
      await vi.waitFor(() => expect(gate.isDisconnected()).toBe(true), {
        timeout: 2000,
      });
      expect((await status()).data).toMatchObject({ state: "pending" });
    } finally {
      browser.abort();
      gate.release();
    }

    // Хранилище могло принять все байты до разрыва. Повтор сверяет уже записанный объект.
    await vi.waitFor(() => expect(wire.objects.size).toBe(1));
    const result = await upload();
    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({ state: "ready" });
    expect((await status()).data).toEqual(result.data);
    expect(wire.effects.filter(effect => effect.startsWith("PUT "))).toHaveLength(1);
  });
  it("does not hold the comment actor or post lock across storage and rechecks post visibility", async () => {
    const post = await makePost({ ...postInput(""), photos: [], target: "feed", status: "published", tags: ["community"] });
    expect(post.status).toBe(200);
    const postId = Number(post.data), gate = wire.pausePut();
    const pending = commentPhoto(postId);
    try {
      await gate.entered;
      await conn.query("SET SESSION innodb_lock_wait_timeout=1");
      await conn.query("UPDATE users SET name='changed while storage waits' WHERE id=98152");
      await conn.query("UPDATE posts SET published=0,status='draft' WHERE id=?", [postId]);
    } finally { gate.release(); }
    expect((await pending).status).toBe(404);
    expect(await rows("SELECT state,etag FROM private_content_files WHERE actorUserId=98152")).toEqual([{ state: "pending", etag: null }]);
    expect(wire.objects.size).toBe(1);
  });
  it("accepts a full 32 MiB document over Base64 HTTP and replays one stored asset", async () => {
    const bytes = Buffer.alloc(32 * 1024 * 1024, 0x61);
    const value = { ...input, base64: bytes.toString("base64") };
    const result = await upload(value);
    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({ state: "ready", usage: "articleDocument", fileSize: bytes.length });
    expect((await upload(value)).data).toEqual(result.data);
    expect(wire.objects.size).toBe(1);
    expect([...wire.objects.values()][0].bytes.equals(bytes)).toBe(true);
    expect(wire.effects.filter(effect => effect.startsWith("PUT "))).toHaveLength(1);
    expect(await rows("SELECT state,fileSize FROM private_content_files WHERE actorUserId=98150"))
      .toEqual([{ state: "ready", fileSize: bytes.length }]);
  });
  it.each(["postPhoto", "articlePhoto", "commentPhoto"])("accepts a real %s photo above the ordinary JSON limit", async usage => {
    const png = await sharp(randomBytes(512 * 512 * 3), { raw: { width: 512, height: 512, channels: 3 } }).png().toBuffer();
    expect(png.length).toBeGreaterThan(256 * 1024);
    const value = { ...input, usage, filename: "photo.png", mimeType: "image/png", base64: png.toString("base64") };
    let result;
    if (usage === "commentPhoto") {
      const saved = await makePost({ ...postInput(""), photos: [], target: "feed", status: "published", tags: ["community"] });
      expect(saved.status).toBe(200);
      result = await call("club.uploadPrivateCommentPhoto", { ...value, postId: Number(saved.data) }, "member");
      if (result.data?.assetId) madeFiles.add(String(result.data.assetId));
    } else result = await upload(value);
    expect(result.status).toBe(200);
    expect(result.data).toMatchObject({ state: "ready", usage, mimeType: "image/webp" });
    expect(wire.objects.size).toBe(1);
    const meta = await sharp([...wire.objects.values()][0].bytes).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 512, height: 512 });
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
  it("binds a post photo atomically, inherits live visibility and never exposes a draft or detached photo", async () => {
    const asset = await photo(); const url = String(asset.url);
    expect((await readFile(url, "admin")).status).toBe(404);
    const saved = await makePost(postInput(url)); expect(saved.status).toBe(200); const id = Number(saved.data);
    expect((await readFile(url, "admin")).status).toBe(404);
    expect((await makePost(postInput(url))).data).toBe(id);
    expect(await rows("SELECT parentKind,parentId FROM private_content_files WHERE actorUserId=98150")).toEqual([{ parentKind: "post", parentId: id }]);
    expect((await call("admin.updatePost", { id, status: "published" })).status).toBe(200);
    const effects = wire.effects.length;
    expect((await readFile(url)).status).toBe(404); expect((await readFile(url, "member")).status).toBe(404); expect(wire.effects).toHaveLength(effects);
    const delivered = await readFile(url, "admin"); expect(delivered.status).toBe(200);
    expect(delivered.headers.get("cache-control")).toBe("private, no-store");
    expect(delivered.headers.get("content-disposition")).toMatch(/^inline;/);
    expect(Buffer.from(await delivered.arrayBuffer())).toEqual([...wire.objects.values()][0].bytes);
    expect((await readFile(url, "admin", "HEAD")).status).toBe(200);
    expect((await call("admin.updatePost", { id, target: "feed" })).status).toBe(200);
    expect((await readFile(url)).status).toBe(200);
    expect((await call("admin.updatePost", { id, photos: [] })).status).toBe(200);
    expect((await readFile(url, "admin")).status).toBe(404);
    expect((await call("admin.updatePost", { id, photos: [url] })).status).toBe(409);
    expect(wire.objects.size).toBe(1);
  });
  it("rejects foreign, wrong-usage and raw private storage references before post commit", async () => {
    const asset = await photo(); const url = String(asset.url);
    expect((await makePost(postInput(url), "other")).status).toBe(409);
    const { idempotencyKey: omitted, ...withoutKey } = postInput(url);
    expect((await makePost(withoutKey)).status).toBe(400);
    const doc = await upload(); expect((await makePost(postInput(String(doc.data!.url)))).status).toBe(400);
    expect((await makePost(postInput(`${wire.endpoint}/${wire.bucket}/content/private-v1/${asset.assetId}`))).status).toBe(400);
    expect((await makePost(postInput(`https://other.example.test${url}`))).status).toBe(400);
    expect(await rows("SELECT id FROM posts WHERE source='cf-photos'")).toEqual([]);
  });
  it("atomically binds article image, ordered carousel and document, then follows publication and access changes", async () => {
    const image = await photo("articlePhoto"), second = await photo("articlePhoto", "article-second-photo-0001");
    const doc = (await upload()).data!;
    const data = { title: "Private file article", coverUrl: "https://public.example.test/cover.webp", access: "club", published: true, idempotencyKey: "33221100-4455-4677-8899-aabbccddeeff",
      sections: [{ type: "png", url: image.url }, { type: "carousel", urls: [second.url, image.url] }, { type: "link", url: doc.url, label: "Download" }] };
    const saved = await makeArticle(data); expect(saved.status).toBe(200); const id = Number(saved.data);
    expect((await makeArticle(data)).data).toBe(id);
    expect(await rows("SELECT DISTINCT parentKind,parentId FROM private_content_files WHERE actorUserId=98150")).toEqual([{ parentKind: "article", parentId: id }]);
    const locked = await call("articles.getById", { id }, "guest", true); expect(locked.data).toMatchObject({ locked: true, sections: [] });
    const effects = wire.effects.length; expect((await readFile(String(doc.url))).status).toBe(404); expect(wire.effects).toHaveLength(effects);
    const stream = await readFile(String(doc.url), "admin", "GET", "bytes=0-6"); expect(stream.status).toBe(206); expect(await stream.text()).toBe("private");
    expect(stream.headers.get("content-disposition")).toMatch(/^attachment;/);
    const full = await call("articles.getById", { id }, "admin", true);
    expect((full.data!.sections as { urls?: string[] }[])[1].urls).toEqual([second.url, image.url]);
    expect((await call("admin.updateArticle", { id, access: "public" })).status).toBe(200);
    expect((await readFile(String(image.url))).status).toBe(200);
    expect((await call("admin.updateArticle", { id, published: false })).status).toBe(200);
    expect((await readFile(String(doc.url), "admin")).status).toBe(404);
    expect((await call("admin.updateArticle", { id, published: true, sections: [{ type: "text", text: "No files" }] })).status).toBe(200);
    expect((await readFile(String(doc.url), "admin")).status).toBe(404);
    expect((await call("admin.updateArticle", { id, sections: data.sections })).status).toBe(409);
  });
  it("refuses private covers, foreign article files and creation without an intent before article/teaser commit", async () => {
    const doc = (await upload()).data!;
    const data = { title: "Invalid private article", published: true, idempotencyKey: "33221100-4455-4677-8899-aabbccddeef1", sections: [{ type: "link", url: doc.url }] };
    expect((await makeArticle(data, "other")).status).toBe(409);
    const { idempotencyKey: omitted, ...withoutKey } = data;
    expect((await makeArticle(withoutKey)).status).toBe(400);
    expect((await makeArticle({ ...data, coverUrl: doc.url })).status).toBe(400);
    expect(await rows("SELECT id FROM articles WHERE title='Invalid private article'")).toEqual([]);
    expect(await rows("SELECT id FROM posts WHERE text='Invalid private article'")).toEqual([]);
  });
  it("keeps comment photos private, retries one comment without duplicates, and follows current discussion access", async () => {
    const saved = await makePost({ ...postInput(""), photos: [], target: "feed", status: "published", tags: ["community"] });
    const postId = Number(saved.data); const uploaded = await commentPhoto(postId); expect(uploaded.status).toBe(200);
    const url = String(uploaded.data!.url); expect((await readFile(url, "member")).status).toBe(404);
    expect((await call("club.privateCommentPhotoStatus", { idempotencyKey: input.idempotencyKey }, "member", true)).data).toEqual(uploaded.data);
    const payload = { postId, text: "New private comment", photos: [url], idempotencyKey: "private-comment-create-0001" };
    const results = await Promise.all([call("club.addComment", payload, "member"), call("club.addComment", payload, "member")]);
    expect(results.map(result => result.status)).toEqual([200,200]);
    const id = Number(results[0].data!.id); expect(results[1].data!.id).toBe(id);
    expect(await rows("SELECT id FROM post_comments WHERE postId=?", [postId])).toEqual([{ id }]);
    expect((await call("club.addComment", { ...payload, text: "Changed intent" }, "member")).status).toBe(409);
    expect((await call("club.addComment", { ...payload, photos: [] }, "member")).status).toBe(409);
    expect((await readFile(url)).status).toBe(404); expect((await readFile(url, "member")).status).toBe(200);
    await call("admin.updatePost", { id: postId, target: "club" });
    const effects = wire.effects.length; expect((await readFile(url, "member")).status).toBe(404); expect(wire.effects).toHaveLength(effects);
    await conn.query("INSERT INTO club_payments(userId,orderId,status,paidAt,expiresAt) VALUES(98152,'cf-paid-reader','paid',NOW(),DATE_ADD(NOW(),INTERVAL 1 DAY))");
    expect((await readFile(url, "member")).status).toBe(200);
    await conn.query("UPDATE club_payments SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 DAY) WHERE orderId='cf-paid-reader'");
    const expiredEffects = wire.effects.length;
    for (const [method, range] of [["GET", undefined], ["HEAD", undefined], ["GET", "bytes=0-3"]] as const) {
      const denied = await readFile(url, "member", method, range);
      expect(denied.status).toBe(404); expect(denied.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(wire.effects).toHaveLength(expiredEffects);
    await conn.query("UPDATE club_payments SET expiresAt=DATE_ADD(NOW(),INTERVAL 1 DAY) WHERE orderId='cf-paid-reader'");
    await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=98152"); expect((await readFile(url, "member")).status).toBe(404);
    await conn.query("UPDATE users SET blockedAt=NULL WHERE id=98152");
    expect((await readFile(url, "other")).status).toBe(200);
    await conn.query("UPDATE users SET role='user' WHERE id=98151"); expect((await readFile(url, "other")).status).toBe(404);
    await conn.query("UPDATE users SET sessionVersion=1 WHERE id=98152"); expect((await readFile(url, "member")).status).toBe(404);
    await conn.query("UPDATE users SET sessionVersion=0 WHERE id=98152");
    expect((await call("club.deleteComment", { id }, "admin")).status).toBe(200);
    expect((await readFile(url, "member")).status).toBe(404);
    expect((await call("club.addComment", payload, "member")).status).toBe(409);
  });
  it("authorizes comment uploads before storage and refuses attaching them to another post", async () => {
    const saved = await makePost({ ...postInput(""), photos: [], target: "club", status: "published", tags: ["community"] }); const postId = Number(saved.data);
    expect((await commentPhoto(postId)).status).toBe(403); expect(wire.objects.size).toBe(0);
    await call("admin.updatePost", { id: postId, target: "feed" });
    const asset = await commentPhoto(postId); expect(asset.status).toBe(200);
    const another = await makePost({ ...postInput(""), photos: [], target: "feed", status: "published", tags: ["community"], idempotencyKey: "another-comment-post-0001" });
    expect((await call("club.addComment", { postId: Number(another.data), text: "Wrong parent", photos: [asset.data!.url], idempotencyKey: "wrong-comment-post-0001" }, "member")).status).toBe(409);
    await conn.query("UPDATE posts SET publishedAt=DATE_SUB(NOW(),INTERVAL 3 DAY) WHERE id=?", [postId]);
    expect((await commentPhoto(postId)).status).toBe(400);
    expect(await rows("SELECT id FROM post_comments WHERE userId=98152")).toEqual([]);
  });
  it("recovers comment photo storage loss without leaking an intent to another account", async () => {
    const saved = await makePost({ ...postInput(""), photos: [], target: "feed", status: "published", tags: ["community"] }); const postId = Number(saved.data);
    wire.dropPutAck(); expect((await commentPhoto(postId)).status).toBe(503);
    expect((await call("club.privateCommentPhotoStatus", { idempotencyKey: input.idempotencyKey }, "other", true)).data).toEqual({ state: "notRecorded" });
    expect((await call("club.privateCommentPhotoStatus", { idempotencyKey: input.idempotencyKey }, "member", true)).data).toMatchObject({ state: "pending" });
    const asset = await commentPhoto(postId); expect(asset.status).toBe(200);
    const changedAccount = await call("club.addComment", { postId, text: "Stolen file", photos: [asset.data!.url], idempotencyKey: "another-account-comment-001" }, "other");
    expect(changedAccount.status).toBe(409); expect(await rows("SELECT id FROM post_comments WHERE postId=?", [postId])).toEqual([]);
    expect((await readFile(String(asset.data!.url), "other")).status).toBe(404);
    expect(wire.objects.size).toBe(1); expect(wire.effects.filter(value => value.startsWith("PUT "))).toHaveLength(1);
  });
  it("retries the same committed comment after a real downstream HTTP response drop without another row", async () => {
    const saved = await makePost({ ...postInput(""), photos: [], target: "feed", status: "published", tags: ["community"] }); const postId = Number(saved.data);
    const asset = await commentPhoto(postId); expect(asset.status).toBe(200);
    const payload = { postId, text: "Lost HTTP reply", photos: [asset.data!.url], idempotencyKey: "comment-lost-http-response-001" };
    let upstreamStatus = 0;
    const proxy = createServer(async (req) => {
      const chunks: Buffer[] = []; for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const upstream = await fetch(`${base}/api/trpc/club.addComment`, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${tokens.member}` }, body: Buffer.concat(chunks) });
      upstreamStatus = upstream.status; await upstream.arrayBuffer(); req.socket.destroy();
    });
    try {
      await new Promise<void>(resolve => proxy.listen(0, "127.0.0.1", resolve));
      await expect(fetch(`http://127.0.0.1:${(proxy.address() as AddressInfo).port}/lost-reply`, { method: "POST", body: superjson.stringify(payload) })).rejects.toThrow();
      expect(upstreamStatus).toBe(200);
      const committed = await rows("SELECT id FROM post_comments WHERE postId=?", [postId]); expect(committed).toHaveLength(1);
      expect((await call("club.addComment", payload, "other")).status).toBe(409);
      expect((await call("club.privateCommentPhotoStatus", { idempotencyKey: input.idempotencyKey }, "other", true)).data).toEqual({ state: "notRecorded" });
      const replay = await call("club.addComment", payload, "member"); expect(replay.status).toBe(200); expect(replay.data!.id).toBe(committed[0].id);
      expect(await rows("SELECT id FROM post_comments WHERE postId=?", [postId])).toEqual(committed);
      const listed = await call("club.comments", { postId }, "member", true);
      expect(listed.data).toMatchObject([{ id: committed[0].id, text: "Lost HTTP reply", photos: [asset.data!.url] }]);
    } finally { proxy.closeAllConnections(); await new Promise<void>(resolve => proxy.close(() => resolve())); }
  });
  it("keeps ingress denial private and never contacts storage", async () => {
    const asset = await photo(); const effects = wire.effects.length;
    const response = await fetch(`${base}${asset.url}`, { headers: { Origin: "https://untrusted.example.test" } });
    expect(response.status).toBe(403); expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(wire.effects).toHaveLength(effects);
  });
  it("exports only own content recovery metadata without file URLs, names or storage capabilities", async () => {
    vi.stubEnv("CONTENT_RECOVERY_EXPORT_ENABLED", "true"); const uploaded = await upload(); expect(uploaded.status, uploaded.wire).toBe(200); const asset = uploaded.data!;
    expect((await upload({ ...input, idempotencyKey: "another-export-content-0001" })).status).toBe(200);
    const result = await call("profileExtras.recoveryExport", { kind: "private_content", limit: 1 }, "admin", true);
    expect(result.status).toBe(200); expect(result.data).toMatchObject({ items: [{ status: "ready" }], nextCursor: expect.stringMatching(/^[a-f0-9]{64}$/) });
    const next = await call("profileExtras.recoveryExport", { kind: "private_content", limit: 1, afterKey: result.data!.nextCursor }, "admin", true);
    expect(next.data).toMatchObject({ items: [{ status: "ready" }], nextCursor: null });
    expect((next.data!.items as { requestId: string }[])[0].requestId).not.toBe((result.data!.items as { requestId: string }[])[0].requestId);
    expect(result.wire).not.toContain(String(asset.assetId)); expect(result.wire).not.toContain("article.txt"); expect(result.wire).not.toContain(wire.endpoint);
    expect((await call("profileExtras.recoveryExport", { kind: "private_content" }, "other", true)).data).toMatchObject({ items: [] });
  });
  it("retires new comment/file recovery links atomically and fences the old actor without touching storage", async () => {
    vi.stubEnv("CONTENT_RECOVERY_RETIREMENT_ENABLED", "true"); vi.stubEnv("CONTENT_RECOVERY_EXPORT_ENABLED", "true");
    const post = await makePost({ ...postInput(""), photos: [], target: "feed", status: "published", tags: ["community"] }); expect(post.status, post.wire).toBe(200); const postId = Number(post.data);
    const uploaded = await commentPhoto(postId); expect(uploaded.status, uploaded.wire).toBe(200); const asset = uploaded.data!;
    expect((await call("club.addComment", { postId, text: "Retired request", photos: [asset.url], idempotencyKey: "retired-comment-intent-001" }, "member")).status).toBe(200);
    expect((await call("profileExtras.recoveryExport", { kind: "comment" }, "member", true)).data).toMatchObject({ items: [{ status: "created" }] });
    const orphan = await commentPhoto(postId, "unbound-comment-photo-0001"); expect(orphan.status).toBe(200);
    const effects = wire.effects.length; vi.stubEnv("PRIVATE_CONTENT_FILES_ENABLED", "false");
    await drizzle(conn).transaction(async tx => {
      await tx.select().from(users).where(eq(users.id, 98152)).for("update");
      await retireContentRecovery(tx, 98152);
      await tx.update(users).set({ sessionVersion: 1 }).where(eq(users.id, 98152));
    });
    expect(await rows("SELECT requestKey FROM comment_creation_requests WHERE actorUserId=98152")).toEqual([]);
    expect(await rows("SELECT actorUserId,filename FROM private_content_files WHERE assetId=?", [asset.assetId])).toEqual([{ actorUserId: null, filename: "" }]);
    expect((await rows("SELECT actorUserId,filename,retiredAt FROM private_content_files WHERE assetId=?", [orphan.data!.assetId]))[0]).toMatchObject({ actorUserId: null, filename: "", retiredAt: expect.any(Date) });
    expect(wire.effects).toHaveLength(effects);
    vi.stubEnv("PRIVATE_CONTENT_FILES_ENABLED", "true");
    expect((await readFile(String(asset.url), "member")).status).toBe(404);
    expect((await readFile(String(asset.url), "other")).status).toBe(200);
    expect((await call("club.privateCommentPhotoStatus", { idempotencyKey: input.idempotencyKey }, "member", true)).status).toBe(401);
  });
  it("refuses finishing a pending comment-photo upload after the session or account is revoked", async () => {
    const post = await makePost({ ...postInput(""), photos: [], target: "feed", status: "published", tags: ["community"] }); const postId = Number(post.data);
    wire.dropPutAck(); expect((await commentPhoto(postId)).status).toBe(503); const effects = wire.effects.length;
    await conn.query("UPDATE users SET sessionVersion=1 WHERE id=98152");
    expect((await commentPhoto(postId)).status).toBe(401);
    await conn.query("UPDATE users SET sessionVersion=0,blockedAt=NOW() WHERE id=98152");
    // Existing session authentication treats a blocked account as unauthenticated.
    expect((await commentPhoto(postId)).status).toBe(401);
    await conn.query("UPDATE users SET blockedAt=NULL,accountDeletionRequestedAt=NOW() WHERE id=98152");
    expect((await commentPhoto(postId)).status).toBe(403);
    expect(wire.effects).toHaveLength(effects);
    expect(await rows("SELECT state,parentId FROM private_content_files WHERE actorUserId=98152")).toEqual([{ state: "pending", parentId: null }]);
    expect(await rows("SELECT id FROM post_comments WHERE postId=?", [postId])).toEqual([]);
  });
  it("rolls retirement back when the comment ledger migration is missing", async () => {
    vi.stubEnv("CONTENT_RECOVERY_RETIREMENT_ENABLED", "true"); const uploaded = await upload(); expect(uploaded.status).toBe(200);
    await conn.query("RENAME TABLE comment_creation_requests TO cf_owned_comment_ledger_missing");
    try {
      await expect(drizzle(conn).transaction(async tx => {
        await tx.select().from(users).where(eq(users.id, 98150)).for("update");
        await tx.update(users).set({ sessionVersion: 1 }).where(eq(users.id, 98150));
        await retireContentRecovery(tx, 98150);
      })).rejects.toThrow();
      expect(await rows("SELECT sessionVersion FROM users WHERE id=98150")).toEqual([{ sessionVersion: 0 }]);
      expect(await rows("SELECT actorUserId,filename FROM private_content_files WHERE assetId=?", [uploaded.data!.assetId])).toEqual([{ actorUserId: 98150, filename: "article.txt" }]);
    } finally { await conn.query("RENAME TABLE cf_owned_comment_ledger_missing TO comment_creation_requests"); }
  });
  it("expires comment recovery without expiring the committed comment photo or creating a replacement", async () => {
    const saved = await makePost({ ...postInput(""), photos: [], target: "feed", status: "published", tags: ["community"] }); const postId = Number(saved.data);
    const asset = await commentPhoto(postId); expect(asset.status).toBe(200);
    const payload = { postId, text: "Expired recovery, live comment", photos: [asset.data!.url], idempotencyKey: "expired-comment-recovery-0001" };
    const created = await call("club.addComment", payload, "member"); expect(created.status).toBe(200);
    await conn.query("UPDATE private_content_files SET createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=98152");
    await conn.query("UPDATE comment_creation_requests SET createdAt=DATE_SUB(NOW(),INTERVAL 31 DAY) WHERE actorUserId=98152");
    vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "true");
    expect((await call("club.privateCommentPhotoStatus", { idempotencyKey: input.idempotencyKey }, "member", true)).status).toBe(409);
    expect((await call("club.addComment", payload, "member")).status).toBe(409);
    expect(await rows("SELECT id FROM post_comments WHERE postId=?", [postId])).toEqual([{ id: Number(created.data!.id) }]);
    expect((await readFile(String(asset.data!.url), "member")).status).toBe(200);
  });
});
