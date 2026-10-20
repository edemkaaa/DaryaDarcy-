import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { crc32 } from "node:zlib";
import { createServer, request as nativeRequest } from "node:http";
import type { AddressInfo } from "node:net";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { S3Client, GetBucketPolicyCommand, GetBucketVersioningCommand, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import superjson from "superjson";
import sharp from "sharp";
import { sdk } from "../apps/backend/src/_core/sdk";
import { privateAttachmentProcesses } from "./helpers/private-attachment-process";
import { assertTestDatabase } from "../tooling/scripts/test-database-policy";

const uri = process.env.BACKEND_TEST_DATABASE_URL;
const enabled = process.env.CF_S3_ACCEPTANCE === "true" && !!uri;
const endpoint = "https://s3.twcstorage.ru", Bucket = "daryadarcy-s3";
const acceptedPolicyHash = "0484dfa2cc0164225db616bc516c53e8be377aca975d32701b6a6467ce1715e8";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

// Opt-in real provider acceptance. No policy writes, working DB, production boot or frontend.
describe.skipIf(!enabled)("private content API with real S3 and a migrated disposable database", () => {
  let conn: Connection, storage: S3Client;
  let workers: Awaited<ReturnType<typeof privateAttachmentProcesses>>;
  let api: Awaited<ReturnType<typeof workers.start>>;
  const owner = randomUUID(), source = `cf-api-${owner.slice(0, 8)}`;
  const tokens: Record<string, string> = {};
  const objects = new Map<string, RowDataPacket>();
  const document = { idempotencyKey: `cf-doc-${owner}`, usage: "articleDocument", filename: `cf-api-${owner}.txt`, mimeType: "text/plain", base64: Buffer.from("0123456789").toString("base64") };
  const rows = async (query: string, args: unknown[] = []) => (await conn.query<RowDataPacket[]>(query, args))[0];
  async function call(method: string, input: unknown, who = "admin", query = false, base = api.base) {
    const encoded = superjson.stringify(input);
    const response = await fetch(`${base}/api/trpc/${method}${query ? `?input=${encodeURIComponent(encoded)}` : ""}`, {
      method: query ? "GET" : "POST", headers: { "content-type": "application/json", ...(tokens[who] ? { authorization: `Bearer ${tokens[who]}` } : {}) },
      ...(query ? {} : { body: encoded }), signal: AbortSignal.timeout(30000),
    });
    const json = await response.json();
    return { status: response.status, data: json.result ? superjson.deserialize<any>(json.result.data) : null };
  }
  async function dropped(method: string, input: unknown, who = "admin") {
    let upstreamStatus = 0;
    const proxy = createServer((req, res) => {
      const upstream = nativeRequest(`${api.base}/api/trpc/${method}`, { method: "POST", headers: req.headers }, response => {
        upstreamStatus = response.statusCode ?? 0; response.resume(); response.once("end", () => res.destroy());
      });
      upstream.once("error", () => res.destroy()); req.pipe(upstream);
    });
    try {
      await new Promise<void>(resolve => proxy.listen(0, "127.0.0.1", resolve));
      await expect(call(method, input, who, false, `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`)).rejects.toThrow();
      expect(upstreamStatus).toBe(200);
    } finally { proxy.closeAllConnections(); await new Promise<void>(resolve => proxy.close(() => resolve())); }
  }
  async function restart(contentFiles = true) {
    const previous = api.pid; await api.stop(); api = await workers.start({ contentFiles }); expect(api.pid).not.toBe(previous);
  }
  const read = (url: string, who = "member", method = "GET", range?: string) => fetch(`${api.base}${url}`, {
    method, headers: { ...(tokens[who] ? { authorization: `Bearer ${tokens[who]}` } : {}), ...(range ? { range } : {}) }, signal: AbortSignal.timeout(20000),
  });
  async function denied(url: string, who = "guest") {
    const count = api.commands.length;
    for (const [method, range] of [["GET", undefined], ["HEAD", undefined], ["GET", "bytes=2-5"]] as const) {
      const response = await read(url, who, method, range); expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("private, no-store"); await response.body?.cancel();
    }
    expect(api.commands.length).toBe(count);
  }
  async function rememberObjects() {
    for (const row of await rows("SELECT * FROM private_content_files WHERE actorUserId IN (98770,98771,98772)")) {
      if (!row.filename.startsWith(`cf-api-${owner}`) || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(row.assetId)) throw new Error("Owned content ledger mismatch");
      objects.set(row.assetId, row);
    }
  }
  async function checkObject(row: RowDataPacket) {
    const Key = `content/private-v1/${row.assetId}`;
    const meta = await storage.send(new HeadObjectCommand({ Bucket, Key }), { abortSignal: AbortSignal.timeout(20000) });
    if (meta.Metadata?.["asset-id"] !== row.assetId || meta.Metadata?.["intent-hash"] !== row.payloadHash || meta.ContentLength !== row.fileSize || meta.ContentType !== row.mimeType || !meta.ETag || (row.etag && meta.ETag !== row.etag)) throw new Error("Owned content storage guard refused");
    return { Key, meta };
  }
  async function directDenial(assetId: string) {
    await rememberObjects(); const row = objects.get(assetId); expect(row).toBeDefined(); await checkObject(row!);
    for (const spec of [{ method: "GET" }, { method: "HEAD" }, { method: "GET", headers: { range: "bytes=2-5" } }]) {
      const response = await fetch(`${endpoint}/${Bucket}/content/private-v1/${assetId}`, { ...spec, redirect: "error", signal: AbortSignal.timeout(20000) });
      expect(response.status).toBe(403); await response.body?.cancel();
    }
  }
  async function photoInput(usage: "postPhoto" | "articlePhoto" | "commentPhoto") {
    const bytes = await sharp({ create: { width: 2, height: 3, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 0.5 } } }).withExif({ IFD0: { Artist: "synthetic private author" } }).png().toBuffer();
    return { idempotencyKey: `cf-${usage}-${owner}`, usage, filename: `cf-api-${owner}-${usage}.png`, mimeType: "image/png", base64: bytes.toString("base64") };
  }
  async function photoBytes(url: string, who = "member") {
    const response = await read(url, who); expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("content-disposition")).toMatch(/^inline;/);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    const bytes = Buffer.from(await response.arrayBuffer()); const meta = await sharp(bytes).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 2, height: 3, hasAlpha: true }); expect(meta.exif).toBeUndefined();
    const range = await read(url, who, "GET", "bytes=2-5"); expect(range.status).toBe(206);
    expect(Buffer.from(await range.arrayBuffer())).toEqual(bytes.subarray(2, 6));
    const head = await read(url, who, "HEAD"); expect(head.status).toBe(200); expect(head.headers.get("content-length")).toBe(String(bytes.length));
    return bytes;
  }
  async function maximumPhoto(size: number) {
    const png = Buffer.from((await photoInput("postPhoto")).base64, "base64");
    // A valid ancillary text chunk pads the source, not the encoded image pixels.
    // Sharp must still decode/re-encode the image and discard this metadata.
    const chunk = Buffer.alloc(size - png.length, 0x61);
    chunk.writeUInt32BE(chunk.length - 12, 0);
    chunk.write("tEXt", 4);
    chunk.write("Comment\0", 8, "ascii");
    chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4);
    return Buffer.concat([png.subarray(0, -12), chunk, png.subarray(-12)]);
  }
  beforeAll(async () => {
    const url = assertTestDatabase(uri!); const id = process.env.CF_S3_DATABASE_CONTAINER_ID;
    if (!id || !/^[a-f0-9]{64}$/.test(id) || url.hostname !== "127.0.0.1" || !url.port || process.env.DATABASE_URL !== uri || process.env.S3_ENDPOINT !== endpoint || process.env.S3_BUCKET !== Bucket || !process.env.S3_ACCESS_KEY || !process.env.S3_SECRET_KEY) throw new Error("Explicit owned acceptance inputs required");
    const { stdout } = await promisify(execFile)("docker", ["inspect", id, "--format", '{"id":{{json .Id}},"name":{{json .Name}},"owner":{{json (index .Config.Labels "codex.owner")}},"ports":{{json .NetworkSettings.Ports}},"tmpfs":{{json .HostConfig.Tmpfs}},"mounts":{{json .Mounts}}}']);
    const fixture = JSON.parse(stdout), bindings = fixture.ports?.["3306/tcp"];
    if (fixture.id !== id || !/^daryadarcy-fresh-content-api-[a-z0-9-]+$/.test(fixture.owner) || fixture.name !== `/${fixture.owner}` || !fixture.tmpfs?.["/var/lib/mysql"] || fixture.mounts?.length !== 0 || bindings?.length !== 1 || bindings[0].HostIp !== "127.0.0.1" || bindings[0].HostPort !== url.port) throw new Error("Unowned database refused");
    storage = new S3Client({ endpoint, region: "ru-1", forcePathStyle: true, maxAttempts: 1, credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY }, requestHandler: { connectionTimeout: 5000, requestTimeout: 10000, throwOnRequestTimeout: true } });
    console.info("[CF-S3] preflight: GetBucketPolicyCommand");
    const policy = await storage.send(new GetBucketPolicyCommand({ Bucket }));
    expect(hash(policy.Policy!)).toBe(acceptedPolicyHash);
    console.info("[CF-S3] preflight: GetBucketVersioningCommand");
    expect((await storage.send(new GetBucketVersioningCommand({ Bucket }))).Status).toBeUndefined();
    conn = await mysql.createConnection({ uri: uri!, timezone: "Z" });
    expect(await rows("SELECT id FROM users")).toEqual([]);
    expect(await rows("SELECT id FROM __drizzle_migrations")).toHaveLength(42);
    for (const [name, id, role] of [["admin", 98770, "admin"], ["member", 98771, "user"], ["other", 98772, "admin"]] as const) {
      await conn.query("INSERT INTO users(id,openId,role) VALUES(?,?,?)", [id, `cf-api-${name}-${owner}`, role]);
      tokens[name] = await sdk.createSessionToken(`cf-api-${name}-${owner}`, { sessionVersion: 0 });
    }
    await conn.query("INSERT INTO club_payments(userId,orderId,status,expiresAt) VALUES(98771,?,'paid',DATE_ADD(NOW(),INTERVAL 1 DAY))", [`cf-api-paid-${owner}`]);
    workers = await privateAttachmentProcesses(); api = await workers.start();
    expect((await call("admin.uploadPrivateContentFile", document)).status).toBe(404);
    expect(api.commands).toEqual([]); await restart();
  }, 30000);
  beforeEach(async () => {
    if (!conn) return;
    await conn.query("UPDATE users SET blockedAt=NULL,sessionVersion=0,role=IF(id=98771,'user','admin') WHERE id IN (98770,98771,98772)");
    await conn.query("UPDATE club_payments SET expiresAt=DATE_ADD(NOW(),INTERVAL 1 DAY) WHERE orderId=?", [`cf-api-paid-${owner}`]);
  });
  afterAll(async () => {
    await api?.stop(); await workers?.close();
    try {
      if (conn) {
        await rememberObjects();
        expect((await storage.send(new GetBucketVersioningCommand({ Bucket }))).Status).toBeUndefined();
        for (const row of objects.values()) {
          let object;
          try { object = await checkObject(row); } catch (error) {
            if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404 && row.state === "pending") continue;
            throw error;
          }
          await storage.send(new DeleteObjectCommand({ Bucket, Key: object.Key, IfMatch: object.meta.ETag }));
          await expect(storage.send(new HeadObjectCommand({ Bucket, Key: object.Key }))).rejects.toMatchObject({ $metadata: { httpStatusCode: 404 } });
        }
        expect(hash((await storage.send(new GetBucketPolicyCommand({ Bucket }))).Policy!)).toBe(acceptedPolicyHash);
        console.info(`[CF-S3] owner fixtures removed: ${objects.size}; HEAD404; policy unchanged`);
      }
    } finally { await conn?.end(); storage?.destroy(); }
  }, 30000);
  it.each(["postPhoto", "articlePhoto", "commentPhoto"] as const)("accepts maximum 4 MiB %s through native API/S3 and rejects one extra byte", async usage => {
    const post = await call("admin.createPost", { text: "Maximum photo fixture", source, photos: [], tags: ["community"], target: "club", status: "published", idempotencyKey: `max-photo-post-${usage}-${owner}` });
    expect(post.status).toBe(200);
    const who = usage === "commentPhoto" ? "member" : "admin";
    const method = usage === "commentPhoto" ? "club.uploadPrivateCommentPhoto" : "admin.uploadPrivateContentFile";
    const input = { idempotencyKey: `max-${usage}-${owner}`, usage, filename: `cf-api-${owner}-${usage}-maximum.png`, mimeType: "image/png", ...(usage === "commentPhoto" ? { postId: post.data } : {}) };
    const before = await rows("SELECT assetId FROM private_content_files");
    const commands = api.commands.length;
    const oversized = await maximumPhoto(4 * 1024 * 1024 + 1);
    expect(oversized.length).toBe(4194305);
    expect((await call(method, { ...input, base64: oversized.toString("base64") }, who)).status).toBe(413);
    expect(await rows("SELECT assetId FROM private_content_files")).toEqual(before);
    expect(api.commands.length).toBe(commands);
    const bytes = await maximumPhoto(4 * 1024 * 1024);
    expect(bytes.length).toBe(4194304);
    expect(await sharp(bytes).metadata()).toMatchObject({ format: "png", width: 2, height: 3 });
    const payload = { ...input, base64: bytes.toString("base64") };
    const uploaded = await call(method, payload, who);
    expect(uploaded.status).toBe(200);
    expect(uploaded.data).toMatchObject({ state: "ready", usage, mimeType: "image/webp" });
    const puts = api.commands.filter(name => name === "PutObjectCommand").length;
    expect(await call(method, payload, who)).toEqual(uploaded);
    expect(api.commands.filter(name => name === "PutObjectCommand").length).toBe(puts);
    expect((await rows("SELECT assetId FROM private_content_files")).length).toBe(before.length + 1);
    if (usage === "commentPhoto") {
      expect((await call("club.addComment", { postId: post.data, text: "Maximum photo", photos: [uploaded.data.url], idempotencyKey: `max-comment-${owner}` }, who)).status).toBe(200);
    } else if (usage === "articlePhoto") {
      expect((await call("admin.createArticle", { title: `cf-api-${owner}-maximum`, access: "club", published: true, idempotencyKey: randomUUID(), sections: [{ type: "png", url: uploaded.data.url }] })).status).toBe(200);
    } else {
      expect((await call("admin.updatePost", { id: post.data, photos: [uploaded.data.url] })).status).toBe(200);
    }
    const output = await photoBytes(uploaded.data.url);
    expect(output.length).toBe(uploaded.data.fileSize);
    await directDenial(uploaded.data.assetId);
    await denied(uploaded.data.url);
    console.info(`[MAX-S3] ${usage}: source=4194304 stored=${output.length}; extra-byte413; replay/read/HEAD/Range/private GREEN`);
  }, 60000);
  it("recovers lost upload and article responses in fresh API processes without another file or article", async () => {
    await dropped("admin.uploadPrivateContentFile", document);
    expect(api.commands.filter(name => name === "PutObjectCommand")).toHaveLength(1);
    const recorded = await rows("SELECT * FROM private_content_files WHERE actorUserId=98770"); expect(recorded).toHaveLength(1); expect(recorded[0].state).toBe("ready");
    await restart();
    const recovered = await call("admin.privateContentFileStatus", { idempotencyKey: document.idempotencyKey }, "admin", true);
    expect(recovered.status).toBe(200); expect(recovered.data.assetId).toBe(recorded[0].assetId);
    expect(recovered.data.url).toBe(`/api/media/content-files/${recorded[0].assetId}`);
    expect((await call("admin.privateContentFileStatus", { idempotencyKey: document.idempotencyKey }, "other", true)).data).toEqual({ state: "notRecorded" });
    for (const replay of await Promise.all([call("admin.uploadPrivateContentFile", document), call("admin.uploadPrivateContentFile", document)])) expect(replay).toEqual(recovered);
    expect(api.commands.filter(name => name === "PutObjectCommand")).toHaveLength(0);
    expect((await call("admin.uploadPrivateContentFile", { ...document, filename: "changed.txt" })).status).toBe(409);
    const article = { title: `cf-api-${owner}`, access: "club", published: false, idempotencyKey: randomUUID(), sections: [{ type: "link", url: recovered.data.url, label: "Fixture" }] };
    await dropped("admin.createArticle", article);
    const saved = await call("admin.createArticle", article); expect(saved.status).toBe(200);
    expect(await rows("SELECT id FROM articles WHERE title=?", [article.title])).toEqual([{ id: saved.data }]);
    expect(await rows("SELECT id FROM posts WHERE source=?", [`article:${saved.data}`])).toHaveLength(0);
    await denied(recovered.data.url, "member");
    expect((await call("admin.updateArticle", { id: saved.data, published: true })).status).toBe(200);
    expect(await rows("SELECT id FROM posts WHERE source=?", [`article:${saved.data}`])).toHaveLength(1);
    const full = await read(recovered.data.url); expect(full.status).toBe(200); expect(await full.text()).toBe("0123456789");
    expect(full.headers.get("cache-control")).toBe("private, no-store"); expect(full.headers.get("content-disposition")).toMatch(/^attachment;/);
    const head = await read(recovered.data.url, "member", "HEAD"); expect(head.status).toBe(200); expect(head.headers.get("content-length")).toBe("10");
    const range = await read(recovered.data.url, "member", "GET", "bytes=2-5"); expect(range.status).toBe(206); expect(await range.text()).toBe("2345");
    await directDenial(recovered.data.assetId); await denied(recovered.data.url);
    expect((await call("admin.updateArticle", { id: saved.data, sections: [{ type: "text", text: "Removed" }] })).status).toBe(200);
    await denied(recovered.data.url, "member");
    expect((await call("admin.updateArticle", { id: saved.data, sections: article.sections })).status).toBe(409);
  }, 45000);
  it("binds post photos once and rechecks paid, blocked, staff and session access before S3", async () => {
    const input = await photoInput("postPhoto"); const asset = await call("admin.uploadPrivateContentFile", input); expect(asset.status).toBe(200);
    const post = { text: "CF actual post photo", source, photos: [asset.data.url], tags: [], target: "club", status: "published", idempotencyKey: `cf-post-${owner}` };
    expect((await call("admin.createPost", post, "other")).status).toBe(409);
    await dropped("admin.createPost", post); const saved = await call("admin.createPost", post); expect(saved.status).toBe(200);
    expect(await rows("SELECT id FROM posts WHERE source=?", [source])).toEqual([{ id: saved.data }]);
    await photoBytes(asset.data.url); await directDenial(asset.data.assetId); await denied(asset.data.url);
    await conn.query("UPDATE club_payments SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 DAY) WHERE orderId=?", [`cf-api-paid-${owner}`]);
    await denied(asset.data.url, "member");
    await conn.query("UPDATE club_payments SET expiresAt=DATE_ADD(NOW(),INTERVAL 1 DAY) WHERE orderId=?", [`cf-api-paid-${owner}`]);
    await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=98771"); await denied(asset.data.url, "member");
    await conn.query("UPDATE users SET blockedAt=NULL,sessionVersion=1 WHERE id=98771"); await denied(asset.data.url, "member");
    await photoBytes(asset.data.url, "other");
    await conn.query("UPDATE users SET role='user' WHERE id=98772"); await denied(asset.data.url, "other");
    expect((await call("admin.updatePost", { id: saved.data, status: "draft" })).status).toBe(200); await denied(asset.data.url, "admin");
    expect((await call("admin.updatePost", { id: saved.data, status: "published", photos: [] })).status).toBe(200); await denied(asset.data.url, "admin");
    expect((await call("admin.updatePost", { id: saved.data, photos: post.photos })).status).toBe(409);
  }, 45000);
  it("keeps article images behind their current publication/access and never treats them as public covers", async () => {
    const asset = await call("admin.uploadPrivateContentFile", await photoInput("articlePhoto")); expect(asset.status).toBe(200);
    const article = { title: `cf-api-${owner}-photo`, access: "public", published: true, idempotencyKey: randomUUID(), sections: [{ type: "png", url: asset.data.url }, { type: "carousel", urls: [asset.data.url] }] };
    expect((await call("admin.createArticle", { ...article, coverUrl: asset.data.url })).status).toBe(400);
    const saved = await call("admin.createArticle", article); expect(saved.status).toBe(200);
    await photoBytes(asset.data.url, "guest"); await directDenial(asset.data.assetId);
    expect((await call("admin.updateArticle", { id: saved.data, access: "club" })).status).toBe(200); await denied(asset.data.url);
    await photoBytes(asset.data.url);
    expect((await call("admin.updateArticle", { id: saved.data, published: false })).status).toBe(200); await denied(asset.data.url, "admin");
    expect((await call("admin.updateArticle", { id: saved.data, published: true })).status).toBe(200);
    await restart(false); await denied(asset.data.url, "member");
    expect((await call("admin.uploadPrivateContentFile", document)).status).toBe(404); expect(api.commands).toEqual([]);
    await restart(); await photoBytes(asset.data.url);
  }, 45000);
  it("recovers comment upload/save losses across restarts and isolates account changes and revocation", async () => {
    const post = await call("admin.createPost", { text: "CF actual comment photo", source, photos: [], tags: ["community"], target: "feed", status: "published", idempotencyKey: `cf-comments-post-${owner}` }); expect(post.status).toBe(200);
    const input = { ...await photoInput("commentPhoto"), postId: post.data }; const puts = api.commands.filter(name => name === "PutObjectCommand").length;
    await dropped("club.uploadPrivateCommentPhoto", input, "member");
    expect(api.commands.filter(name => name === "PutObjectCommand")).toHaveLength(puts + 1);
    const recorded = await rows("SELECT assetId FROM private_content_files WHERE actorUserId=98771"); expect(recorded).toHaveLength(1);
    await restart();
    const recovered = await call("club.privateCommentPhotoStatus", { idempotencyKey: input.idempotencyKey }, "member", true); expect(recovered.status).toBe(200); expect(recovered.data.assetId).toBe(recorded[0].assetId);
    expect((await call("club.privateCommentPhotoStatus", { idempotencyKey: input.idempotencyKey }, "other", true)).data).toEqual({ state: "notRecorded" });
    for (const replay of await Promise.all([call("club.uploadPrivateCommentPhoto", input, "member"), call("club.uploadPrivateCommentPhoto", input, "member")])) expect(replay).toEqual(recovered);
    expect(api.commands.filter(name => name === "PutObjectCommand")).toHaveLength(0);
    const comment = { postId: post.data, text: "Only one committed comment", photos: [recovered.data.url], idempotencyKey: `cf-comment-save-${owner}` };
    await dropped("club.addComment", comment, "member"); await restart();
    const results = await Promise.all([call("club.addComment", comment, "member"), call("club.addComment", comment, "member")]);
    expect(results.map(result => result.status)).toEqual([200, 200]); expect(results[0].data).toEqual(results[1].data);
    expect(await rows("SELECT id FROM post_comments WHERE postId=?", [post.data])).toEqual([{ id: results[0].data.id }]);
    expect((await call("club.comments", { postId: post.data }, "member", true)).data).toMatchObject([{ id: results[0].data.id, text: comment.text, photos: comment.photos }]);
    expect((await call("club.addComment", comment, "other")).status).toBe(409);
    expect((await call("club.addComment", { ...comment, photos: [] }, "member")).status).toBe(409);
    expect((await call("club.addComment", { ...comment, text: "Different" }, "member")).status).toBe(409);
    await photoBytes(recovered.data.url); await directDenial(recovered.data.assetId); await denied(recovered.data.url);
    expect((await call("admin.updatePost", { id: post.data, target: "club" })).status).toBe(200);
    await conn.query("UPDATE club_payments SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 DAY) WHERE orderId=?", [`cf-api-paid-${owner}`]); await denied(recovered.data.url, "member");
    const before = api.commands.length; expect((await call("club.uploadPrivateCommentPhoto", input, "member")).status).toBe(403); expect(api.commands.length).toBe(before);
    await conn.query("UPDATE club_payments SET expiresAt=DATE_ADD(NOW(),INTERVAL 1 DAY) WHERE orderId=?", [`cf-api-paid-${owner}`]);
    await conn.query("UPDATE users SET sessionVersion=1 WHERE id=98771"); await denied(recovered.data.url, "member");
    expect((await call("club.privateCommentPhotoStatus", { idempotencyKey: input.idempotencyKey }, "member", true)).status).toBe(401);
    tokens.member = await sdk.createSessionToken(`cf-api-member-${owner}`, { sessionVersion: 1 }); await photoBytes(recovered.data.url);
    expect((await call("club.deleteComment", { id: results[0].data.id }, "member")).status).toBe(200); await denied(recovered.data.url, "member");
    expect((await call("club.addComment", comment, "member")).status).toBe(409);
    expect(api.commands.filter(name => name === "PutObjectCommand")).toHaveLength(0);
  }, 45000);
});
