import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AddressInfo } from "node:net";
import type { INestApplication } from "@nestjs/common";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import sharp from "sharp";
import {
  S3Client,
  GetBucketPolicyCommand,
  GetBucketVersioningCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { assertTestDatabase } from "../tooling/scripts/test-database-policy";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { sdk } from "../apps/backend/src/_core/sdk";
import { getDb } from "../apps/backend/src/db";
import { rollbackLibraryMigration } from "../apps/backend/src/content/library-file-migration";

const uri = process.env.BACKEND_TEST_DATABASE_URL;
const enabled = process.env.LB_S3_ACCEPTANCE === "true" && !!uri;
const endpoint = "https://s3.twcstorage.ru",
  Bucket = "daryadarcy-s3";
const acceptedPolicyHash =
  "0484dfa2cc0164225db616bc516c53e8be377aca975d32701b6a6467ce1715e8";
/** Вычисляет SHA-256 точных байтов и текста политики для проверки идентичности. */
const hash = (bytes: Buffer | string) =>
  createHash("sha256").update(bytes).digest("hex");
type Manifest = {
  materialKey: string;
  idempotencyKey: string;
  files: {
    fileKey: string;
    filename: string;
    mimeType: string;
    sha256: string;
    bytes: Buffer;
    sortOrder: number;
    expectedRevision: number;
  }[];
};
type ImportReport = {
  result?: { state: string; bindings: unknown[] };
  errorCode?: string;
  commands: string[];
  exit: number;
};

// Opt-in only: six new synthetic objects, native SQL/API, no frontend or policy writes.
/** Опциональная приёмка проверяет импорт шести новых синтетических файлов и выдачу через настоящий S3 и отдельную SQL-базу. */
describe.skipIf(!enabled)("library importer and delivery with real S3", () => {
  let conn: Connection, storage: S3Client, app: INestApplication, base: string;
  const owner = randomUUID(),
    actor = { id: 98781, sessionVersion: 0 };
  const manifests: Manifest[] = [],
    tokens: Record<string, string> = {};
  const knownFiles = new Set<string>();
  const assets = new Map<string, RowDataPacket>();
  const urls: string[] = [];
  /** Читает контрольные строки импорта и привязок собственной базы. */
  const rows = async (query: string, values: unknown[] = []) =>
    (await conn.query<RowDataPacket[]>(query, values))[0];
  /** Выполняет GET, HEAD либо Range через локальный API с выбранной синтетической ролью. */
  const read = (path: string, who = "member", method = "GET", range?: string) =>
    fetch(base + path, {
      method,
      headers: {
        ...(tokens[who] ? { authorization: `Bearer ${tokens[who]}` } : {}),
        ...(range ? { range } : {}),
      },
      signal: AbortSignal.timeout(20000),
    });
  /** Проверяет неизменную принятую bucket policy и отсутствие версионирования до операций с собственными объектами. */
  async function policy() {
    expect(
      hash(
        (
          await storage.send(new GetBucketPolicyCommand({ Bucket }), {
            abortSignal: AbortSignal.timeout(15000),
          })
        ).Policy!,
      ),
    ).toBe(acceptedPolicyHash);
    expect(
      (
        await storage.send(new GetBucketVersioningCommand({ Bucket }), {
          abortSignal: AbortSignal.timeout(15000),
        })
      ).Status,
    ).toBeUndefined();
  }
  /** Собирает durable-квитанции только своих файлов и проверяет UUID и разрешённые имена перед очисткой. */
  async function remember() {
    for (const row of await rows(
      "SELECT * FROM private_content_files WHERE actorUserId=?",
      [actor.id],
    )) {
      if (
        !knownFiles.has(row.filename) ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
          row.assetId,
        )
      )
        throw new Error("Owned library receipt mismatch");
      assets.set(row.assetId, row);
    }
  }
  /** Проверяет metadata, размер, MIME и ETag объекта против его собственной durable-квитанции. */
  async function ownedObject(row: RowDataPacket) {
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
      throw new Error("Owned library object mismatch");
    return { Key, meta };
  }
  /** Запускает отдельный импортёр с контролируемой потерей PUT либо commit-ответа и возвращает безопасный отчёт команд без секретов. */
  async function imported(
    manifest: Manifest,
    options: { dropPutReply?: boolean; dropCommitReply?: boolean } = {},
  ): Promise<ImportReport> {
    const serialized = JSON.stringify({
      ...manifest,
      files: manifest.files.map((file) => ({
        ...file,
        bytes: file.bytes.toString("base64"),
      })),
    });
    const script = `
      const {S3Client}=require('@aws-sdk/client-s3');
      const send=S3Client.prototype.send; const commands=[],storageErrors=[];let dropped=false;
      S3Client.prototype.send=async function(...args){const command=args[0].constructor.name;commands.push(command);let result;
        try{result=await Reflect.apply(send,this,args);}catch(e){storageErrors.push({command,name:/^[A-Za-z0-9]+$/.test(e.name||'')?e.name:'StorageError',status:e.$metadata?.httpStatusCode});throw e;}
        if(${!!options.dropPutReply}&&!dropped&&args[0].constructor.name==='PutObjectCommand'){dropped=true;throw new Error('synthetic lost storage acknowledgement');}return result;};
      const {applyLibraryMigration}=require('./apps/backend/src/content/library-file-migration');const {getDb}=require('./apps/backend/src/db');
      async function main(){try{const input=${serialized};input.files=input.files.map(f=>({...f,bytes:Buffer.from(f.bytes,'base64')}));
        const result=await applyLibraryMigration(${JSON.stringify(actor)},input);console.log(JSON.stringify({${options.dropCommitReply ? "" : "result,"}commands,storageErrors}));${options.dropCommitReply ? "process.exitCode=23;" : ""}
      }catch(e){console.log(JSON.stringify({errorCode:/^[A-Z_]+$/.test(e.code||'')?e.code:'IMPORT_FAILED',commands,storageErrors}));}
      finally{await (await getDb())?.$client.end();}}main();`;
    const env: Record<string, string> = {
      PATH: process.env.PATH!,
      NODE_ENV: "test",
      DATABASE_URL: uri!,
      PRIVATE_LIBRARY_FILES_ENABLED: "true",
      PRIVATE_CONTENT_FILES_ENABLED: "true",
    };
    for (const key of [
      "S3_ENDPOINT",
      "S3_BUCKET",
      "S3_ACCESS_KEY",
      "S3_SECRET_KEY",
    ])
      env[key] = process.env[key]!;
    let stdout: string,
      exit = 0;
    try {
      ({ stdout } = await promisify(execFile)(
        process.execPath,
        ["--require", "tsx/cjs", "--eval", script],
        { cwd: new URL("../", import.meta.url), env, timeout: 60000 },
      ));
    } catch (error) {
      const result = error as { code?: number; stdout?: string };
      if (result.code !== 23 || !options.dropCommitReply)
        throw new Error("Owned importer process failed; details withheld");
      stdout = result.stdout ?? "";
      exit = 23;
    }
    const line = stdout
      .trim()
      .split("\n")
      .reverse()
      .find((value) => value.startsWith("{"));
    expect(line).toBeDefined();
    return { ...JSON.parse(line!), exit };
  }
  /** Проверяет явный opt-in и владение пустым tmpfs-контейнером; создаёт синтетические роли и манифесты шести файлов. */
  beforeAll(async () => {
    const url = assertTestDatabase(uri!);
    const id = process.env.LB_S3_DATABASE_CONTAINER_ID;
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
      throw new Error("Explicit owned acceptance inputs required");
    const { stdout } = await promisify(execFile)("docker", [
      "inspect",
      id,
      "--format",
      '{"id":{{json .Id}},"name":{{json .Name}},"owner":{{json (index .Config.Labels "codex.owner")}},"ports":{{json .NetworkSettings.Ports}},"tmpfs":{{json .HostConfig.Tmpfs}},"mounts":{{json .Mounts}}}',
    ]);
    const fixture = JSON.parse(stdout),
      ports = fixture.ports?.["3306/tcp"];
    if (
      fixture.id !== id ||
      !/^daryadarcy-fresh-library-s3-[a-z0-9-]+$/.test(fixture.owner) ||
      fixture.name !== `/${fixture.owner}` ||
      !fixture.tmpfs?.["/var/lib/mysql"] ||
      fixture.mounts?.length !== 0 ||
      ports?.length !== 1 ||
      ports[0].HostIp !== "127.0.0.1" ||
      ports[0].HostPort !== url.port
    )
      throw new Error("Unowned database refused");
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
    await policy();
    conn = await mysql.createConnection({ uri: uri!, timezone: "Z" });
    expect(await rows("SELECT id FROM users")).toEqual([]);
    expect(await rows("SELECT id FROM __drizzle_migrations")).toHaveLength(42);
    expect(await rows("SELECT id FROM library_file_bindings")).toEqual([]);
    for (const [name, id, role] of [
      ["admin", actor.id, "admin"],
      ["other", 98782, "admin"],
      ["member", 98783, "user"],
      ["moderator", 98784, "moderator"],
    ] as const) {
      await conn.query("INSERT INTO users(id,openId,role) VALUES(?,?,?)", [
        id,
        `lb-${name}-${owner}`,
        role,
      ]);
      tokens[name] = await sdk.createSessionToken(`lb-${name}-${owner}`, {
        sessionVersion: 0,
      });
    }
    await conn.query(
      "INSERT INTO club_payments(userId,orderId,status,expiresAt) VALUES(98783,?,'paid',DATE_ADD(NOW(),INTERVAL 1 DAY))",
      [`lb-paid-${owner}`],
    );
    vi.stubEnv("PRIVATE_LIBRARY_FILES_ENABLED", "true");
    vi.stubEnv("PRIVATE_CONTENT_FILES_ENABLED", "true");
    const photo = await sharp({
      create: {
        width: 3,
        height: 4,
        channels: 4,
        background: { r: 1, g: 2, b: 3, alpha: 0.5 },
      },
    })
      .webp({ lossless: true })
      .toBuffer();
    for (const materialKey of ["recipes", "peterburg", "patterns"]) {
      const files = [Buffer.from("0123456789"), photo].map((bytes, index) => ({
        fileKey: index ? "photo" : "document",
        filename: `lb-s3-${owner}-${materialKey}.${index ? "webp" : "txt"}`,
        mimeType: index ? "image/webp" : "text/plain",
        bytes,
        sha256: hash(bytes),
        sortOrder: index,
        expectedRevision: 0,
      }));
      files.forEach((file) => knownFiles.add(file.filename));
      manifests.push({
        materialKey,
        idempotencyKey: `lb-${materialKey}-${owner}`,
        files,
      });
    }
    app = await createBackendApplication();
    await app.listen(0, "127.0.0.1");
    base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
  }, 30000);
  /** Удаляет только подтверждённые собственные объекты с If-Match, повторно проверяет политику и закрывает локальные ресурсы. */
  afterAll(async () => {
    if (app) {
      await app.close();
      await (
        (await getDb()) as unknown as {
          $client: { end(): Promise<void> };
        } | null
      )?.$client.end();
    }
    try {
      if (conn && storage) {
        await remember();
        await policy();
        for (const row of assets.values()) {
          let object;
          try {
            object = await ownedObject(row);
          } catch (error) {
            if (
              (error as { $metadata?: { httpStatusCode?: number } }).$metadata
                ?.httpStatusCode === 404 &&
              row.state === "pending"
            )
              continue;
            throw error;
          }
          await storage.send(
            new DeleteObjectCommand({
              Bucket,
              Key: object.Key,
              IfMatch: object.meta.ETag,
            }),
            { abortSignal: AbortSignal.timeout(15000) },
          );
          await expect(
            storage.send(new HeadObjectCommand({ Bucket, Key: object.Key }), {
              abortSignal: AbortSignal.timeout(15000),
            }),
          ).rejects.toMatchObject({ $metadata: { httpStatusCode: 404 } });
        }
        await policy();
        console.info(
          `[LB-S3] owned synthetic objects removed: ${assets.size}; HEAD404; policy unchanged`,
        );
      }
    } finally {
      await conn?.end();
      storage?.destroy();
      vi.unstubAllEnvs();
    }
  }, 60000);
  /** Проверяет восстановление после потери S3 и commit-ответов между процессами без повторных объектов и привязок. */
  it("recovers lost S3 and committed-import replies across fresh processes without duplicate copies", async () => {
    const request = manifests[0];
    const lost = await imported(request, { dropPutReply: true });
    expect(lost.errorCode).toBe("SERVICE_UNAVAILABLE");
    expect(
      lost.commands.filter((name) => name === "PutObjectCommand"),
    ).toHaveLength(1);
    expect(await rows("SELECT state FROM library_file_migrations")).toEqual([
      { state: "pending" },
    ]);
    expect(await rows("SELECT state FROM private_content_files")).toEqual([
      { state: "pending" },
    ]);
    expect(
      await (await read("/api/library/materials/recipes/files")).json(),
    ).toEqual({ files: [], nextCursor: null });
    const discarded = await imported(request, { dropCommitReply: true });
    expect(discarded.exit).toBe(23);
    expect(discarded.result).toBeUndefined();
    expect(
      discarded.commands.filter((name) => name === "PutObjectCommand"),
    ).toHaveLength(1);
    const repeated = await Promise.all([imported(request), imported(request)]);
    expect(repeated[0].result?.state).toBe("committed");
    expect(repeated[1].result).toEqual(repeated[0].result);
    for (const report of repeated) expect(report.commands).toEqual([]);
    expect(await rows("SELECT id FROM library_file_bindings")).toHaveLength(2);
    expect(
      await rows("SELECT assetId FROM private_content_files"),
    ).toHaveLength(2);
    expect(
      await rows("SELECT requestKey FROM library_file_migrations"),
    ).toHaveLength(1);
    const conflict = await imported({
      ...request,
      files: request.files.map((file) => ({
        ...file,
        filename: "changed.txt",
      })),
    });
    expect(conflict.errorCode).toBe("CONFLICT");
    expect(conflict.commands).toEqual([]);
  }, 90000);
  /** Проверяет точные байты всех шести файлов, безопасные заголовки и Range, пока анонимный S3-доступ закрыт. */
  it("serves all six byte-exact files through live club API while anonymous S3 stays closed", async () => {
    for (const manifest of manifests.slice(1))
      expect(await imported(manifest)).toMatchObject({
        result: { state: "committed" },
      });
    await remember();
    expect(assets.size).toBe(6);
    for (const manifest of manifests) {
      const list = await read(
        `/api/library/materials/${manifest.materialKey}/files`,
      );
      expect(list.status).toBe(200);
      const payload = await list.json();
      expect(payload.nextCursor).toBeNull();
      expect(payload.files).toHaveLength(2);
      expect(JSON.stringify(payload)).not.toMatch(
        /assetId|content\/private-v1|twcstorage/,
      );
      for (const file of manifest.files) {
        const item = payload.files.find(
          (entry: { fileKey: string }) => entry.fileKey === file.fileKey,
        );
        expect(item.url).toBe(
          `/api/media/library-files/${manifest.materialKey}/${file.fileKey}`,
        );
        urls.push(item.url);
        const row = [...assets.values()].find(
          (asset) => asset.filename === file.filename,
        )!;
        const object = await ownedObject(row);
        for (const options of [
          { method: "GET" },
          { method: "HEAD" },
          { method: "GET", headers: { range: "bytes=2-5" } },
        ]) {
          const anonymous = await fetch(`${endpoint}/${Bucket}/${object.Key}`, {
            ...options,
            redirect: "error",
            signal: AbortSignal.timeout(15000),
          });
          expect(anonymous.status).toBe(403);
          await anonymous.body?.cancel();
        }
        const response = await read(item.url);
        expect(response.status).toBe(200);
        expect(Buffer.from(await response.arrayBuffer())).toEqual(file.bytes);
        expect(response.headers.get("cache-control")).toBe("private, no-store");
        expect(response.headers.get("x-content-type-options")).toBe("nosniff");
        expect(response.headers.get("content-disposition")).toMatch(
          file.fileKey === "photo" ? /^inline;/ : /^attachment;/,
        );
        const head = await read(item.url, "member", "HEAD");
        expect(head.status).toBe(200);
        expect(head.headers.get("content-length")).toBe(
          String(file.bytes.length),
        );
        const range = await read(item.url, "member", "GET", "bytes=2-5");
        expect(range.status).toBe(206);
        expect(Buffer.from(await range.arrayBuffer())).toEqual(
          file.bytes.subarray(2, 6),
        );
      }
    }
  }, 120000);
  /** Проверяет отзыв доступа по сроку, эпохе и блокировке, а также staff-доступ без выдачи оплаты модератору. */
  it("revokes paid reads on expiry, session change and blocking without granting payment to moderators", async () => {
    const path = urls[0];
    expect(path).toBeDefined();
    expect((await read(path, "guest")).status).toBe(404);
    expect(
      (await read("/api/library/materials/recipes/files", "guest")).status,
    ).toBe(404);
    const staff = await read(path, "moderator");
    expect(staff.status).toBe(200);
    await staff.body?.cancel();
    expect(
      await rows("SELECT id FROM club_payments WHERE userId=98784"),
    ).toEqual([]);
    await conn.query(
      "UPDATE club_payments SET expiresAt=DATE_SUB(NOW(),INTERVAL 1 SECOND) WHERE userId=98783",
    );
    for (const [method, range] of [
      ["GET", undefined],
      ["HEAD", undefined],
      ["GET", "bytes=2-5"],
    ] as const)
      expect((await read(path, "member", method, range)).status).toBe(404);
    expect((await read("/api/library/materials/recipes/files")).status).toBe(
      404,
    );
    await conn.query(
      "UPDATE club_payments SET expiresAt=DATE_ADD(NOW(),INTERVAL 1 DAY) WHERE userId=98783",
    );
    await conn.query("UPDATE users SET sessionVersion=1 WHERE id=98783");
    expect((await read(path)).status).toBe(404);
    tokens.member = await sdk.createSessionToken(`lb-member-${owner}`, {
      sessionVersion: 1,
    });
    const restored = await read(path);
    expect(restored.status).toBe(200);
    await restored.body?.cancel();
    await conn.query("UPDATE users SET blockedAt=NOW() WHERE id=98783");
    expect((await read(path)).status).toBe(404);
    await expect(
      rollbackLibraryMigration(
        { id: 98782, sessionVersion: 0 },
        manifests[0].idempotencyKey,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      await rows("SELECT id FROM library_file_bindings WHERE enabled=1"),
    ).toHaveLength(6);
  }, 45000);
  /** Проверяет откат только одного материала, запрет возобновления отменённого импорта и сохранность объектов других материалов. */
  it("rolls back only its material and never revives the cancelled operation or a public URL", async () => {
    const result = await rollbackLibraryMigration(
      actor,
      manifests[0].idempotencyKey,
    );
    expect(result.state).toBe("rolledBack");
    expect(
      await rollbackLibraryMigration(actor, manifests[0].idempotencyKey),
    ).toEqual(result);
    expect(
      await (
        await read("/api/library/materials/recipes/files", "moderator")
      ).json(),
    ).toEqual({ files: [], nextCursor: null });
    for (const file of manifests[0].files)
      expect(
        (
          await read(
            `/api/media/library-files/recipes/${file.fileKey}`,
            "moderator",
          )
        ).status,
      ).toBe(404);
    expect((await imported(manifests[0])).errorCode).toBe("CONFLICT");
    expect(
      await rows("SELECT assetId FROM private_content_files"),
    ).toHaveLength(6);
    expect(
      await rows("SELECT id FROM library_file_bindings WHERE enabled=1"),
    ).toHaveLength(4);
  }, 45000);
});
