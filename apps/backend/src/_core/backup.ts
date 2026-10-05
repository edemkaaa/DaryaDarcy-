import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { ENV } from "./env";

/** Local VPS copies — align with nginx/PM2 log retention (~14 days). */
export const LOCAL_BACKUP_RETAIN_MS = 14 * 24 * 60 * 60_000;
/** S3 copies — long-term off-site retention for recovery. */
export const S3_BACKUP_RETAIN_MS = 90 * 24 * 60 * 60_000;

let lastBackupAt = 0;
let activeBackup: Promise<void> | undefined;

function parseDatabaseUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "mysql:") throw new Error();
    const cfg = {
      host: parsed.hostname,
      port: parsed.port || "3306",
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database:
        decodeURIComponent(parsed.pathname.replace(/^\//, "")) || "daryadarcy",
    };
    if (Object.values(cfg).some((value) => value.includes("\0")))
      throw new Error();
    return cfg;
  } catch {
    // URL/decoding errors can carry the original credential-bearing input.
    throw new Error("MySQL backup configuration is invalid");
  }
}

function optionFilePassword(password: string): string {
  if (password.includes("\0"))
    throw new Error("MySQL backup configuration is invalid");
  const escapes: Record<string, string> = {
    "\\": "\\\\",
    '"': '\\"',
    "\n": "\\n",
    "\r": "\\r",
    "\t": "\\t",
    "\b": "\\b",
  };
  return `[client]\npassword="${password.replace(/[\\"\n\r\t\x08]/g, (char) => escapes[char])}"\n`;
}

async function writeMysqlDump(
  cfg: ReturnType<typeof parseDatabaseUrl>,
  filePath: string,
): Promise<void> {
  const options = optionFilePassword(cfg.password);
  const credentialsDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "daryadarcy-mysql-"),
  );
  const configPath = path.join(credentialsDir, "client.cnf");
  const partialPath = `${filePath}.partial`;
  let ownsPartial = false;
  try {
    fs.writeFileSync(configPath, options, { flag: "wx", mode: 0o600 });
    const dump = spawn(
      "mysqldump",
      [
        `--defaults-extra-file=${configPath}`, // MySQL requires this option first.
        `-h${cfg.host}`,
        `-P${cfg.port}`,
        `-u${cfg.user}`,
        "--single-transaction",
        "--quick",
        "--",
        cfg.database,
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, DATABASE_URL: undefined, MYSQL_PWD: undefined },
      },
    );
    // Drain diagnostics without retaining or logging data from the DB tool.
    dump.stderr.resume();
    const closed = new Promise<void>((resolve, reject) => {
      dump.once("error", () =>
        reject(new Error("MySQL backup dump could not start")),
      );
      dump.once("close", (code, signal) => {
        if (code === 0) resolve();
        else
          reject(
            new Error(`MySQL backup dump failed (exit ${code ?? signal})`),
          );
      });
    });
    let streamed: Promise<void> | undefined;
    try {
      const fd = fs.openSync(partialPath, "wx", 0o600);
      ownsPartial = true;
      const out = fs.createWriteStream(partialPath, { fd });
      streamed = pipeline(dump.stdout, createGzip(), out);
      await Promise.all([closed, streamed]);
    } catch {
      if (dump.exitCode === null && dump.signalCode === null)
        dump.kill("SIGKILL");
      await Promise.allSettled([closed, streamed]);
      throw new Error("MySQL backup dump or output failed");
    }
    fs.renameSync(partialPath, filePath);
    ownsPartial = false;
  } catch {
    // Do not attach raw spawn/stream errors as causes; callers log this error.
    throw new Error("MySQL backup dump or output failed");
  } finally {
    // Only exact files created for this invocation; never a broad recursive delete.
    let cleanupFailed = false;
    for (const target of [
      ownsPartial ? partialPath : undefined,
      configPath,
      credentialsDir,
    ]) {
      if (!target) continue;
      try {
        if (target === credentialsDir) fs.rmdirSync(target);
        else fs.rmSync(target, { force: true });
      } catch {
        cleanupFailed = true;
      }
    }
    if (cleanupFailed)
      throw new Error("MySQL backup temporary-file cleanup failed");
  }
}

async function uploadBackup(filePath: string): Promise<void> {
  const client = s3Client();
  if (!client || !ENV.s3Bucket) {
    console.warn("[backup] S3 not configured, keeping local file only");
    return;
  }
  const key = `backups/mysql/${path.basename(filePath)}`;
  const body = fs.readFileSync(filePath);
  await client.send(
    new PutObjectCommand({
      Bucket: ENV.s3Bucket,
      Key: key,
      Body: body,
      ContentType: "application/gzip",
    }),
  );
  console.log(`[backup] uploaded ${key} (${body.length} bytes)`);
}

function s3Client(): S3Client | null {
  if (!ENV.s3Endpoint || !ENV.s3AccessKey || !ENV.s3SecretKey || !ENV.s3Bucket)
    return null;
  return new S3Client({
    region: "ru-1",
    endpoint: ENV.s3Endpoint,
    credentials: {
      accessKeyId: ENV.s3AccessKey,
      secretAccessKey: ENV.s3SecretKey,
    },
    forcePathStyle: true,
  });
}

/** Remove local .sql.gz older than LOCAL_BACKUP_RETAIN_MS. */
export function pruneLocalBackups(
  dir = path.join(process.cwd(), "backups"),
  retainMs = LOCAL_BACKUP_RETAIN_MS,
): number {
  if (!fs.existsSync(dir)) return 0;
  const cutoff = Date.now() - retainMs;
  let removed = 0;
  for (const name of fs.readdirSync(dir)) {
    if (!name.startsWith("daryadarcy-") || !name.endsWith(".sql.gz")) continue;
    const full = path.join(dir, name);
    try {
      const stat = fs.statSync(full);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(full);
        removed += 1;
        console.log(`[backup] pruned local ${name}`);
      }
    } catch (error) {
      console.warn(`[backup] prune skip ${name}:`, error);
    }
  }
  return removed;
}

/** Remove S3 backups/mysql/* older than S3_BACKUP_RETAIN_MS. */
export async function pruneS3Backups(
  retainMs = S3_BACKUP_RETAIN_MS,
): Promise<number> {
  const client = s3Client();
  if (!client || !ENV.s3Bucket) return 0;
  const cutoff = Date.now() - retainMs;
  let removed = 0;
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({
        Bucket: ENV.s3Bucket,
        Prefix: "backups/mysql/",
        ContinuationToken: token,
      }),
    );
    for (const obj of page.Contents ?? []) {
      if (!obj.Key?.endsWith(".sql.gz") || !obj.LastModified) continue;
      if (obj.LastModified.getTime() >= cutoff) continue;
      await client.send(
        new DeleteObjectCommand({ Bucket: ENV.s3Bucket, Key: obj.Key }),
      );
      removed += 1;
      console.log(`[backup] pruned s3 ${obj.Key}`);
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return removed;
}

export async function runMysqlBackupIfDue(
  minIntervalMs = 24 * 60 * 60_000,
): Promise<void> {
  if (activeBackup) return activeBackup;
  const dbUrl = ENV.databaseUrl;
  if (!dbUrl) return;
  if (Date.now() - lastBackupAt < minIntervalMs) return;
  activeBackup = runMysqlBackup(dbUrl);
  try {
    await activeBackup;
  } finally {
    activeBackup = undefined;
  }
}

async function runMysqlBackup(dbUrl: string): Promise<void> {
  const cfg = parseDatabaseUrl(dbUrl);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(process.cwd(), "backups");
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const filePath = path.join(dir, `daryadarcy-${stamp}-${randomUUID()}.sql.gz`);
  await writeMysqlDump(cfg, filePath);
  lastBackupAt = Date.now();

  try {
    await uploadBackup(filePath);
  } catch (error) {
    console.warn("[backup] upload failed:", error);
  }

  pruneLocalBackups(dir);
  try {
    await pruneS3Backups();
  } catch (error) {
    console.warn("[backup] s3 prune failed:", error);
  }
}
