import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer, request as nativeRequest } from "node:http";
import type { AddressInfo } from "node:net";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import {
  S3Client,
  GetBucketPolicyCommand,
  GetBucketVersioningCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import superjson from "superjson";
import sharp from "sharp";
import { sdk } from "../apps/backend/src/_core/sdk";
import { COOKIE_NAME } from "../packages/shared/src/const";
import { privateAttachmentProcesses } from "./helpers/private-attachment-process";
import { assertTestDatabase } from "../tooling/scripts/test-database-policy";
import { mp4Fixture } from "./helpers/media-fixtures";
import { PostSaveCoordinator } from "../apps/frontend/src/domain/post/save-post";
import {
  PostRecoveryJournal,
  type PostEditorSnapshot,
} from "../apps/frontend/src/domain/post/recovery-store";
import { serializePostDraft } from "../apps/frontend/src/domain/post/draft";
import { OperationScope } from "../apps/frontend/src/shared/browser/operation-scope";
import { setPersonalDataOwner } from "../apps/frontend/src/shared/browser/storage";
import { cancelSessionRequests } from "../apps/frontend/src/shared/api/request-lifecycle";
import { uploadAdminPrivateVideo } from "../apps/frontend/src/features/admin/media/private-video-upload";
import { journalObjectStore } from "./helpers/journal-object-store";

const current = vi.hoisted(() => ({ base: "" }));
vi.mock("../apps/frontend/src/shared/config/api", () => ({
  getApiBaseUrl: () => current.base,
}));
// Real File bytes, replacing only the browser-only FileReader boundary.
vi.mock("../apps/frontend/src/shared/media/read-attachment", () => ({
  attachmentBase64: async (file: File) =>
    Buffer.from(await file.arrayBuffer()).toString("base64"),
}));
const uri = process.env.BACKEND_TEST_DATABASE_URL;
const enabled = process.env.VU_S3_ACCEPTANCE === "true" && !!uri;
const endpoint = "https://s3.twcstorage.ru",
  Bucket = "daryadarcy-s3";
const acceptedPolicy =
  "0484dfa2cc0164225db616bc516c53e8be377aca975d32701b6a6467ce1715e8";
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const realFetch = globalThis.fetch;
const admin = 98830,
  member = 98831,
  other = 98832;

/** Actual frontend transport/coordinator → native API → fresh SQL → Timeweb S3.
 * Journal transactions are a structuredClone double, NOT browser/reload acceptance. */
describe.skipIf(!enabled)(
  "private raw video actual API/SQL/S3 acceptance",
  () => {
    let conn: Connection, storage: S3Client;
    let workers: Awaited<ReturnType<typeof privateAttachmentProcesses>>;
    let api: Awaited<ReturnType<typeof workers.start>>;
    const owner = randomUUID(),
      filename = `vu4-${owner}.mp4`;
    const tokens: Record<string, string> = {};
    let actor = admin,
      previousPuts = 0;
    const objects = new Map<string, { row: RowDataPacket; video: boolean }>();
    const rows = async (query: string, args: unknown[] = []) =>
      (await conn.query<RowDataPacket[]>(query, args))[0];
    const puts = () =>
      previousPuts +
      api.commands.filter((n) => n === "PutObjectCommand").length;
    async function rpc<T>(
      method: string,
      input: unknown,
      query = false,
      who = actor,
      base = api.base,
    ): Promise<T> {
      const encoded = superjson.stringify(input);
      const response = await fetch(
        `${base}/api/trpc/admin.${method}${query ? `?input=${encodeURIComponent(encoded)}` : ""}`,
        {
          method: query ? "GET" : "POST",
          headers: {
            "content-type": "application/json",
            cookie: `${COOKIE_NAME}=${tokens[who]}`,
          },
          ...(query ? {} : { body: encoded }),
          signal: AbortSignal.timeout(30000),
        },
      );
      const json = await response.json();
      if (!response.ok || !json.result)
        throw Object.assign(new Error(`Fixture API HTTP ${response.status}`), {
          status: response.status,
        });
      return superjson.deserialize<T>(json.result.data);
    }
    const client = () => ({
      uploadPrivateVideo: uploadAdminPrivateVideo,
      privateStatus: (value: unknown) =>
        rpc("privateAttachmentStatus", value, true),
      uploadPrivatePhoto: (value: unknown) =>
        rpc("uploadPrivateContentFile", value),
      privatePhotoStatus: (value: unknown) =>
        rpc("privateContentFileStatus", value, true),
      create: (value: unknown) => rpc<number>("createPost", value),
      update: (id: number, value: object) =>
        rpc("updatePost", { id, ...value }),
      upload: async () => {
        throw Error("Public upload forbidden");
      },
    });
    const selected = (suffix: string) => ({
      key: `vu4-${suffix}-${owner}`,
      file: new File([new Uint8Array(mp4Fixture)], filename, {
        type: "video/mp4",
        lastModified: 123,
      }),
    });
    const editor = (
      video: ReturnType<typeof selected>,
    ): PostEditorSnapshot => ({
      draft: {
        text: `vu4-${owner}`,
        photos: [],
        videos: [`local-video:${video.key}`],
        tags: [],
        target: "club",
        status: "draft",
        scheduledAt: null,
        publishedAt: new Date("2026-10-16"),
        sortOrder: 0,
      },
      attachments: [],
      removedIds: [],
      pending: [],
      privateVideos: [video],
    });
    const task = () =>
      new OperationScope().begin(
        "save",
        new AbortController().signal,
        () => actor === admin,
      )!;
    async function restart() {
      previousPuts = puts();
      const pid = api.pid;
      await api.stop();
      api = await workers.start({ contentFiles: true, privateVideos: true });
      current.base = api.base;
      expect(api.pid).not.toBe(pid);
    }
    async function dropResponse<T>(run: (base: string) => Promise<T>) {
      let status = 0;
      const proxy = createServer((req, res) => {
        const upstream = nativeRequest(
          `${api.base}${req.url}`,
          { method: req.method, headers: req.headers },
          (response) => {
            status = response.statusCode ?? 0;
            response.resume();
            response.once("end", () => res.destroy());
          },
        );
        upstream.once("error", () => res.destroy());
        req.pipe(upstream);
      });
      try {
        await new Promise<void>((resolve) =>
          proxy.listen(0, "127.0.0.1", resolve),
        );
        const base = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`;
        await expect(run(base)).rejects.toThrow();
        expect(status).toBe(200);
      } finally {
        current.base = api.base;
        proxy.closeAllConnections();
        await new Promise<void>((resolve) => proxy.close(() => resolve()));
      }
    }
    const read = (url: string, who?: number, method = "GET", range?: string) =>
      realFetch(`${api.base}${url}`, {
        method,
        headers: {
          ...(who ? { cookie: `${COOKIE_NAME}=${tokens[who]}` } : {}),
          ...(range ? { range } : {}),
        },
        signal: AbortSignal.timeout(20000),
      });
    async function denied(url: string, who?: number) {
      const count = api.commands.length;
      for (const [method, range] of [
        ["GET", undefined],
        ["HEAD", undefined],
        ["GET", "bytes=2-5"],
      ] as const) {
        const res = await read(url, who, method, range);
        expect(res.status).toBe(404);
        expect(res.headers.get("cache-control")).toBe("private, no-store");
        await res.body?.cancel();
      }
      expect(api.commands).toHaveLength(count);
    }
    async function rememberObjects() {
      for (const [table, video] of [
        ["private_attachment_uploads", true],
        ["private_content_files", false],
      ] as const) {
        for (const row of await rows(
          `SELECT * FROM ${table} WHERE actorUserId=?`,
          [admin],
        )) {
          if (
            !row.filename.startsWith(`vu4-${owner}`) ||
            !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
              row.assetId,
            ) ||
            (video ? row.type !== "video" : row.usage !== "postPhoto")
          )
            throw Error("Owned video ledger mismatch");
          objects.set(row.assetId, { row, video });
        }
      }
    }
    async function objectMeta(row: RowDataPacket) {
      const Key = `content/private-v1/${row.assetId}`;
      const meta = await storage.send(new HeadObjectCommand({ Bucket, Key }), {
        abortSignal: AbortSignal.timeout(15000),
      });
      if (
        meta.Metadata?.["asset-id"] !== row.assetId ||
        meta.Metadata?.["intent-hash"] !== row.payloadHash ||
        meta.ContentLength !== row.fileSize ||
        meta.ContentType !== row.mimeType ||
        !meta.ETag ||
        (row.etag && meta.ETag !== row.etag)
      )
        throw Error("Owned object metadata guard refused");
      return { Key, meta };
    }
    beforeAll(async () => {
      const url = assertTestDatabase(uri!),
        id = process.env.VU_S3_DATABASE_CONTAINER_ID;
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
        throw Error("Explicit owned acceptance inputs required");
      const { stdout } = await promisify(execFile)("docker", [
        "inspect",
        id,
        "--format",
        '{"id":{{json .Id}},"name":{{json .Name}},"owner":{{json (index .Config.Labels "codex.owner")}},"ports":{{json .NetworkSettings.Ports}},"tmpfs":{{json .HostConfig.Tmpfs}},"mounts":{{json .Mounts}}}',
      ]);
      const f = JSON.parse(stdout),
        ports = f.ports?.["3306/tcp"];
      if (
        f.id !== id ||
        !/^daryadarcy-fresh-video-api-[a-z0-9-]+$/.test(f.owner) ||
        f.name !== `/${f.owner}` ||
        !f.tmpfs?.["/var/lib/mysql"] ||
        f.mounts?.length !== 0 ||
        ports?.length !== 1 ||
        ports[0].HostIp !== "127.0.0.1" ||
        ports[0].HostPort !== url.port
      )
        throw Error("Unowned database refused");
      storage = new S3Client({
        endpoint,
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
      expect(
        hash(
          (await storage.send(new GetBucketPolicyCommand({ Bucket }))).Policy!,
        ),
      ).toBe(acceptedPolicy);
      expect(
        (await storage.send(new GetBucketVersioningCommand({ Bucket }))).Status,
      ).toBeUndefined();
      conn = await mysql.createConnection({ uri: uri!, timezone: "Z" });
      expect(await rows("SELECT id FROM users")).toEqual([]);
      expect(await rows("SELECT id FROM __drizzle_migrations")).toHaveLength(
        42,
      );
      for (const [id, role] of [
        [admin, "admin"],
        [member, "user"],
        [other, "admin"],
      ] as const) {
        await conn.query("INSERT INTO users(id,openId,role) VALUES(?,?,?)", [
          id,
          `vu4-${id}-${owner}`,
          role,
        ]);
        tokens[id] = await sdk.createSessionToken(`vu4-${id}-${owner}`, {
          sessionVersion: 0,
        });
      }
      await conn.query(
        "INSERT INTO club_payments(userId,orderId,status,expiresAt) VALUES(?,?,'paid',DATE_ADD(NOW(),INTERVAL 1 DAY))",
        [member, `vu4-paid-${owner}`],
      );
      workers = await privateAttachmentProcesses();
      api = await workers.start({ contentFiles: true, privateVideos: true });
      current.base = api.base;
    }, 30000);
    beforeEach(() => {
      actor = admin;
      setPersonalDataOwner(admin);
      vi.stubGlobal("indexedDB", journalObjectStore().factory);
      vi.stubGlobal("fetch", (url: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        if (
          String(url).startsWith(
            current.base + "/api/admin/private-video-uploads",
          )
        )
          headers.set("cookie", `${COOKIE_NAME}=${tokens[actor]}`);
        return realFetch(url, { ...init, headers });
      });
    });
    afterAll(async () => {
      cancelSessionRequests();
      setPersonalDataOwner(null);
      vi.unstubAllGlobals();
      await api?.stop();
      await workers?.close();
      try {
        if (conn) {
          await rememberObjects();
          expect(
            (await storage.send(new GetBucketVersioningCommand({ Bucket })))
              .Status,
          ).toBeUndefined();
          for (const { row } of objects.values()) {
            let object;
            try {
              object = await objectMeta(row);
            } catch (e) {
              if (
                (e as { $metadata?: { httpStatusCode?: number } }).$metadata
                  ?.httpStatusCode === 404 &&
                row.state === "pending"
              )
                continue;
              throw e;
            }
            await storage.send(
              new DeleteObjectCommand({
                Bucket,
                Key: object.Key,
                IfMatch: object.meta.ETag,
              }),
            );
            await expect(
              storage.send(new HeadObjectCommand({ Bucket, Key: object.Key })),
            ).rejects.toMatchObject({ $metadata: { httpStatusCode: 404 } });
          }
          expect(
            hash(
              (await storage.send(new GetBucketPolicyCommand({ Bucket })))
                .Policy!,
            ),
          ).toBe(acceptedPolicy);
          console.info(
            `[VU-S3] cleanup HEAD404; owned objects=${objects.size}; policy unchanged`,
          );
        }
      } finally {
        await conn?.end();
        storage?.destroy();
      }
    }, 60000);

    it("recovers raw upload and post ACK loss across native API restarts with one video/poster/link/post", async () => {
      const video = {
        ...selected("lost"),
        poster: {
          key: `vu4-poster-${owner}`,
          file: new File(
            [
              new Uint8Array(
                await sharp({
                  create: {
                    width: 2,
                    height: 3,
                    channels: 4,
                    background: { r: 1, g: 2, b: 3, alpha: 0.5 },
                  },
                })
                  .png()
                  .toBuffer(),
              ),
            ],
            `vu4-${owner}-cover.png`,
            { type: "image/png" },
          ),
        },
      };
      let draft = editor(video),
        c = new PostSaveCoordinator(),
        journal = new PostRecoveryJournal(admin, "vu4");
      await journal.load();
      c.setCheckpoint((state) => journal.write(draft, state));
      await journal.write(draft, c.snapshot());
      await dropResponse(async (base) => {
        current.base = base;
        return c.save(
          serializePostDraft(draft.draft),
          [],
          [],
          client(),
          task(),
          [],
          [video],
        );
      });
      expect(puts()).toBe(1);
      expect(await rows("SELECT id FROM posts")).toHaveLength(0);
      await restart();
      journal = new PostRecoveryJournal(admin, "vu4");
      const loaded = (await journal.load())!;
      draft = loaded.editor;
      c = new PostSaveCoordinator();
      c.restore(loaded.save);
      c.setCheckpoint((state) => journal.write(draft, state));
      await c.recoverUploads(client(), task());
      expect(puts()).toBe(2); // One original video PUT and one optional poster PUT.
      const baseClient = client();
      await dropResponse((base) =>
        c.save(
          serializePostDraft(draft.draft),
          [],
          [],
          {
            ...baseClient,
            create: (value) => rpc("createPost", value, false, actor, base),
          },
          task(),
          [],
          draft.privateVideos,
        ),
      );
      expect(await rows("SELECT id FROM posts")).toHaveLength(1);
      await restart();
      journal = new PostRecoveryJournal(admin, "vu4");
      const frozen = (await journal.load())!;
      draft = frozen.editor;
      c = new PostSaveCoordinator();
      c.restore(frozen.save);
      c.setCheckpoint((state) => journal.write(draft, state));
      const postId = await c.recoverCreation(client(), task());
      expect(puts()).toBe(2);
      expect(await rows("SELECT id FROM posts")).toEqual([{ id: postId }]);
      expect(
        await rows("SELECT requestKey FROM post_creation_requests"),
      ).toHaveLength(1);
      const links = await rows(
        "SELECT id,url,posterUrl FROM post_media WHERE postId=?",
        [postId],
      );
      expect(links).toHaveLength(1);
      const url = links[0].url as string,
        cover = links[0].posterUrl as string;
      expect(url).toBe(`/api/media/post-attachments/${links[0].id}`);
      expect(cover).toMatch(/^\/api\/media\/content-files\//);
      await denied(url, admin);
      await denied(cover, admin);
      await rpc("updatePost", { id: postId, status: "published" });
      await denied(url);
      await denied(cover);
      for (const path of [url, cover]) {
        const get = await read(path, member);
        expect(get.status).toBe(200);
        expect(get.headers.get("cache-control")).toBe("private, no-store");
        const bytes = Buffer.from(await get.arrayBuffer());
        if (path === url) expect(bytes).toEqual(mp4Fixture);
        else expect((await sharp(bytes).metadata()).format).toBe("webp");
        const head = await read(path, member, "HEAD");
        expect(head.status).toBe(200);
        expect(head.headers.get("content-length")).toBe(String(bytes.length));
        const range = await read(path, member, "GET", "bytes=2-5");
        expect(range.status).toBe(206);
        expect(Buffer.from(await range.arrayBuffer())).toEqual(
          bytes.subarray(2, 6),
        );
      }
      await rememberObjects();
      for (const { row } of objects.values()) {
        await objectMeta(row);
        for (const method of ["GET", "HEAD"]) {
          const res = await realFetch(
            `${endpoint}/${Bucket}/content/private-v1/${row.assetId}`,
            { method, signal: AbortSignal.timeout(15000) },
          );
          expect(res.status).toBe(403);
          await res.body?.cancel();
        }
      }
      await conn.query(
        "UPDATE club_payments SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 DAY) WHERE userId=?",
        [member],
      );
      await denied(url, member);
      await denied(cover, member);
      await conn.query(
        "UPDATE club_payments SET expiresAt=DATE_ADD(NOW(),INTERVAL 1 DAY) WHERE userId=?",
        [member],
      );
      await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=?", [member]);
      await denied(url, member);
      await denied(cover, member);
      await conn.query(
        "UPDATE users SET blockedAt=NULL,sessionVersion=1 WHERE id=?",
        [member],
      );
      await denied(url, member);
      await denied(cover, member);
      await rpc("updatePost", {
        id: postId,
        videos: [],
        removedMediaIds: [links[0].id],
      });
      await denied(url, admin);
      await denied(cover, admin);
      const assetId = draft.privateVideos![0].receipt!.assetId;
      await expect(
        rpc("updatePost", { id: postId, privateAssetIds: [assetId] }),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        await rows("SELECT id FROM post_media WHERE postId=?", [postId]),
      ).toHaveLength(0);
    }, 60000);

    it.each(["upload", "status"] as const)(
      "ignores an actual late %s reply after switching accounts, without publishing or reassigning the asset",
      async (phase) => {
        const video = selected(phase),
          draft = editor(video),
          c = new PostSaveCoordinator();
        c.setCheckpoint(async () => {}); // Journal behavior is covered above, no synthetic server.
        if (phase === "status") {
          await uploadAdminPrivateVideo(video.file, video.key);
          Object.assign(video, { attempted: true });
        }
        let entered!: () => void, release!: () => void;
        const started = new Promise<void>((resolve) => {
          entered = resolve;
        });
        const held = new Promise<void>((resolve) => {
          release = resolve;
        });
        vi.stubGlobal(
          "fetch",
          async (url: RequestInfo | URL, init?: RequestInit) => {
            const headers = new Headers(init?.headers);
            if (String(url).includes("/api/admin/private-video-uploads"))
              headers.set("cookie", `${COOKIE_NAME}=${tokens[admin]}`);
            const response = await realFetch(url, { ...init, headers });
            if (
              String(url).includes(
                phase === "upload"
                  ? "/api/admin/private-video-uploads"
                  : "/api/trpc/admin.privateAttachmentStatus",
              )
            ) {
              entered();
              await held;
            }
            return response;
          },
        );
        const before = await rows("SELECT id FROM posts");
        const pending = expect(
          c.save(
            serializePostDraft(draft.draft),
            [],
            [],
            client(),
            task(),
            [],
            [video],
          ),
        ).rejects.toThrow();
        try {
          await started;
          actor = other;
          setPersonalDataOwner(other);
          cancelSessionRequests();
          release();
          await pending;
        } finally {
          release();
        }
        expect(video).not.toHaveProperty("receipt");
        expect(
          await rpc(
            "privateAttachmentStatus",
            { idempotencyKey: video.key },
            true,
            other,
          ),
        ).toEqual({ state: "notRecorded" });
        const ready = await rpc<{
          assetId: string;
          state: string;
          type: string;
        }>(
          "privateAttachmentStatus",
          { idempotencyKey: video.key },
          true,
          admin,
        );
        expect(ready).toMatchObject({ state: "ready", type: "video" });
        expect(await rows("SELECT id FROM posts")).toEqual(before);
        expect(
          await rows(
            "SELECT assetId FROM private_attachment_uploads WHERE actorUserId=? AND assetId=?",
            [admin, ready.assetId],
          ),
        ).toHaveLength(1);
      },
      45000,
    );
  },
);
