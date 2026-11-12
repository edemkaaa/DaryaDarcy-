/** Проверяем сроки и память бэкапа: настоящие процессы/файлы и SDK, но без подключения к БД и S3. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { Readable } from "node:stream";
import type { ChildProcess } from "node:child_process";
import { IntervalJobs } from "../apps/backend/src/workers/interval-jobs";

type S3Handle =
  import("@aws-sdk/client-s3").S3ClientResolvedConfig["requestHandler"]["handle"];

const fixture = vi.hoisted(() => ({
  sqlPath: "",
  hangDump: false,
  hangTransport: "",
  endlessPages: false,
  failUpload: false,
  children: [] as ChildProcess[],
  requests: [] as Array<{
    method: string;
    headers: Record<string, string>;
    body: unknown;
  }>,
  uploaded: [] as Buffer[],
  rejectTransport: [] as Array<(error: Error) => void>,
}));

// Меняем только исполняемый инструмент: native spawn сам применяет переданные timeout/killSignal.
vi.mock("node:child_process", async (original) => {
  const native = await original<typeof import("node:child_process")>();
  return {
    ...native,
    spawn(
      command: string,
      args: string[],
      options: import("node:child_process").SpawnOptions,
    ) {
      if (command !== "mysqldump")
        throw new Error("Unexpected external process");
      const script = fixture.hangDump
        ? 'process.on("SIGTERM", () => {}); process.stdout.write("-- pending dump\\n"); setInterval(() => {}, 1000);'
        : `require("node:fs").createReadStream(${JSON.stringify(fixture.sqlPath)}).pipe(process.stdout);`;
      const child = native.spawn(process.execPath, ["-e", script], {
        ...options,
        // Ускоряем только уже заданный production timeout; отсутствие срока тест не исправляет.
        ...(fixture.hangDump && options.timeout ? { timeout: 150 } : {}),
      });
      fixture.children.push(child);
      return child;
    },
  };
});

// Настоящий SDK сериализует запросы, но HTTP handler принимает их в памяти: сети и бакета нет.
vi.mock("@aws-sdk/client-s3", async (original) => {
  const sdk = await original<typeof import("@aws-sdk/client-s3")>();
  const { Readable } = await import("node:stream");
  return {
    ...sdk,
    S3Client: class extends sdk.S3Client {
      constructor(config: import("@aws-sdk/client-s3").S3ClientConfig) {
        super({
          ...config,
          requestHandler: {
            async handle(
              request: Parameters<S3Handle>[0],
              options?: { abortSignal?: AbortSignal },
            ) {
              fixture.requests.push({
                method: request.method,
                headers: request.headers,
                body: request.body,
              });
              const stage =
                request.method === "PUT"
                  ? "upload"
                  : request.method === "GET"
                    ? "list"
                    : "delete";
              if (fixture.hangTransport === stage) {
                await new Promise<never>((_resolve, reject) => {
                  const abort = () =>
                    reject(
                      Object.assign(new Error("Synthetic aborted transport"), {
                        name: "AbortError",
                      }),
                    );
                  fixture.rejectTransport.push(reject);
                  if (options?.abortSignal?.aborted) abort();
                  else
                    options?.abortSignal?.addEventListener?.("abort", abort, {
                      once: true,
                    });
                });
              }
              if (stage === "upload" && fixture.failUpload)
                throw Object.assign(
                  new Error("Synthetic signed request PRIVATE_BACKUP_MARKER"),
                  { name: "AbortError" },
                );
              if (stage === "list" && fixture.endlessPages)
                await new Promise((resolve) => setTimeout(resolve, 40));
              if (stage === "upload") {
                if (request.body instanceof Readable) {
                  for await (const chunk of request.body)
                    fixture.uploaded.push(Buffer.from(chunk));
                } else fixture.uploaded.push(Buffer.from(request.body));
              }
              const contents =
                fixture.hangTransport === "delete"
                  ? "<Contents><Key>backups/mysql/daryadarcy-fixture-old.sql.gz</Key><LastModified>2020-01-01T00:00:00Z</LastModified></Contents>"
                  : "";
              return {
                response: {
                  statusCode: 200,
                  headers: {},
                  body: Readable.from(
                    stage === "list"
                      ? [
                          `<ListBucketResult><IsTruncated>${fixture.endlessPages}</IsTruncated>${fixture.endlessPages ? `<NextContinuationToken>page-${fixture.requests.length}</NextContinuationToken>` : ""}${contents}</ListBucketResult>`,
                        ]
                      : [],
                  ),
                },
              };
            },
            destroy() {},
          },
        });
      }
    },
  };
});

let directory: string;
let sql: string;
let backup: typeof import("../apps/backend/src/_core/backup");
let pending: Promise<void>[];
let jobs: IntervalJobs | undefined;

/** Собственная SQL-фикстура достаточно велика для нескольких ограниченных чанков gzip. */
beforeEach(async () => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "darcy-backup-bounds-"));
  sql =
    "CREATE TABLE synthetic_backup (id INT, value TEXT);\n" +
    Array.from(
      { length: 4096 },
      (_, id) =>
        `INSERT INTO synthetic_backup VALUES (${id}, '${createHash("sha256").update(String(id)).digest("hex")}');\n`,
    ).join("");
  fixture.sqlPath = path.join(directory, "input.sql");
  fs.writeFileSync(fixture.sqlPath, sql);
  fixture.hangDump = false;
  fixture.hangTransport = "";
  fixture.endlessPages = false;
  fixture.failUpload = false;
  fixture.children = [];
  fixture.requests = [];
  fixture.uploaded = [];
  fixture.rejectTransport = [];
  pending = [];
  jobs = undefined;
  vi.spyOn(process, "cwd").mockReturnValue(directory);
  vi.spyOn(os, "tmpdir").mockReturnValue(directory);
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.stubEnv(
    "DATABASE_URL",
    "mysql://fixture:synthetic@127.0.0.1:33317/backend_test",
  );
  vi.stubEnv("S3_ENDPOINT", "https://backup.example.invalid");
  vi.stubEnv("S3_ACCESS_KEY", "synthetic-access");
  vi.stubEnv("S3_SECRET_KEY", "synthetic-secret");
  vi.stubEnv("S3_BUCKET", "synthetic-backups");
  vi.resetModules();
  backup = await import("../apps/backend/src/_core/backup");
});

/** Даже RED-прогон закрывает только свои процессы, незавершённые операции и временный каталог. */
afterEach(async () => {
  jobs?.stop();
  fixture.hangTransport = "";
  fixture.endlessPages = false;
  for (const reject of fixture.rejectTransport)
    reject(Object.assign(new Error("Fixture cleanup"), { name: "AbortError" }));
  await Promise.all(
    fixture.children.map(async (child) => {
      if (child.exitCode !== null || child.signalCode !== null) return;
      await new Promise<void>((resolve) => {
        child.once("close", resolve);
        child.kill("SIGKILL");
      });
    }),
  );
  await Promise.allSettled(pending);
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  fs.rmSync(directory, { recursive: true, force: true });
});

/** Сохраняем Promise до ожидания, чтобы cleanup дожидался и намеренно зависшей RED-операции. */
function start() {
  const work = backup.runMysqlBackupIfDue(0);
  pending.push(work);
  return work;
}

/** Watchdog даёт явный результат отсутствия deadline, не оставляя тест висеть до общего timeout. */
async function outcome(work: Promise<void>) {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      work.then(
        () => "resolved",
        () => "rejected",
      ),
      new Promise<"waiting">((resolve) => {
        timer = setTimeout(() => resolve("waiting"), 1500);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}

it("streams the exact gzip with fixed Content-Length instead of allocating the whole archive", async () => {
  const readFile = fs.readFileSync;
  vi.spyOn(fs, "readFileSync").mockImplementation(((file, ...args) => {
    if (String(file).endsWith(".sql.gz"))
      throw new Error("Whole archive read is forbidden");
    return readFile(file, ...args);
  }) as typeof fs.readFileSync);
  await start();
  const [request] = fixture.requests;
  expect(request?.method).toBe("PUT");
  expect(request.body).toBeInstanceOf(fs.ReadStream);
  expect(fixture.uploaded.length).toBeGreaterThan(1);
  expect(
    Math.max(...fixture.uploaded.map((chunk) => chunk.length)),
  ).toBeLessThanOrEqual(64 * 1024);
  const uploaded = Buffer.concat(fixture.uploaded);
  expect(request.headers["content-length"]).toBe(String(uploaded.length));
  expect(request.headers["content-md5"]).toBe(
    createHash("md5").update(uploaded).digest("base64"),
  );
  expect(request.headers["transfer-encoding"]).toBeUndefined();
  expect(request.headers["x-amz-trailer"]).toBeUndefined();
  expect(gunzipSync(uploaded).toString()).toBe(sql);
  expect((request.body as fs.ReadStream).closed).toBe(true);
});

it("kills a stuck dump and removes its partial/credentials before permitting the next attempt", async () => {
  fixture.hangDump = true;
  expect(await outcome(start())).toBe("rejected");
  expect(fixture.children[0].signalCode).toBe("SIGKILL");
  expect(fs.readdirSync(path.join(directory, "backups"))).toEqual([]);
  expect(fs.readdirSync(directory).sort()).toEqual(["backups", "input.sql"]);
  fixture.hangDump = false;
  await start();
  expect(fixture.children).toHaveLength(2);
  expect(fs.readdirSync(path.join(directory, "backups"))).toHaveLength(1);
});

it.each(["upload", "list", "delete"])(
  "releases a stalled %s and retains the complete local copy",
  async (stage) => {
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) =>
      timeout(Math.min(ms, 150)),
    );
    fixture.hangTransport = stage;
    expect(await outcome(start())).toBe("resolved");
    const files = fs.readdirSync(path.join(directory, "backups"));
    expect(files).toHaveLength(1);
    expect(
      gunzipSync(
        fs.readFileSync(path.join(directory, "backups", files[0])),
      ).toString(),
    ).toBe(sql);
    const put = fixture.requests.find((request) => request.method === "PUT");
    expect(put?.body).toBeInstanceOf(fs.ReadStream);
    expect((put?.body as fs.ReadStream).closed).toBe(true);
    fixture.hangTransport = "";
    await start();
    expect(fixture.children).toHaveLength(2);
    expect(fs.readdirSync(path.join(directory, "backups"))).toHaveLength(2);
  },
);

it("closes the unread archive on a failed send without leaking the SDK error", async () => {
  fixture.failUpload = true;
  await start();
  const request = fixture.requests.find((request) => request.method === "PUT");
  expect(request?.body).toBeInstanceOf(fs.ReadStream);
  expect((request?.body as fs.ReadStream).closed).toBe(true);
  const [file] = fs.readdirSync(path.join(directory, "backups"));
  expect(
    gunzipSync(
      fs.readFileSync(path.join(directory, "backups", file)),
    ).toString(),
  ).toBe(sql);
  const warnings = vi.mocked(console.warn).mock.calls.flat().join(" ");
  expect(warnings).toContain("[backup] upload failed");
  expect(warnings).not.toContain("PRIVATE_BACKUP_MARKER");
});

it("bounds the whole retention scan even when each individual page completes", async () => {
  const timeout = AbortSignal.timeout.bind(AbortSignal);
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) =>
    timeout(Math.min(ms, 150)),
  );
  fixture.endlessPages = true;
  expect(await outcome(start())).toBe("resolved");
  expect(
    fixture.requests.filter((request) => request.method === "GET").length,
  ).toBeGreaterThan(1);
  expect(fs.readdirSync(path.join(directory, "backups"))).toHaveLength(1);
  expect(vi.mocked(console.warn).mock.calls.flat().join(" ")).toContain(
    "[backup] s3 prune failed",
  );
});

it("allows the scheduler to run backup again after the timed-out dump", async () => {
  fixture.hangDump = true;
  jobs = new IntervalJobs([{ name: "backup", intervalMs: 40, run: start }]);
  jobs.start();
  await vi.waitFor(() => {
    expect(fixture.children[0]).toBeDefined();
  });
  fixture.children[0].once("close", () => {
    fixture.hangDump = false;
  });
  await vi.waitFor(
    () => {
      expect(fixture.children.length).toBeGreaterThanOrEqual(2);
      expect(
        fs
          .readdirSync(path.join(directory, "backups"))
          .some((name) => name.endsWith(".sql.gz")),
      ).toBe(true);
    },
    { timeout: 1500 },
  );
  jobs.stop();
  await Promise.allSettled(pending);
});
