import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
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

function parseDatabaseUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port || "3306",
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, "").split("?")[0] || "daryadarcy",
  };
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
  if (!ENV.s3Endpoint || !ENV.s3AccessKey || !ENV.s3SecretKey || !ENV.s3Bucket) return null;
  return new S3Client({
    region: "ru-1",
    endpoint: ENV.s3Endpoint,
    credentials: { accessKeyId: ENV.s3AccessKey, secretAccessKey: ENV.s3SecretKey },
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
export async function pruneS3Backups(retainMs = S3_BACKUP_RETAIN_MS): Promise<number> {
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

export async function runMysqlBackupIfDue(minIntervalMs = 24 * 60 * 60_000): Promise<void> {
  const dbUrl = ENV.databaseUrl;
  if (!dbUrl) return;
  const now = Date.now();
  if (now - lastBackupAt < minIntervalMs) return;
  lastBackupAt = now;

  const cfg = parseDatabaseUrl(dbUrl);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = path.join(process.cwd(), "backups");
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `daryadarcy-${stamp}.sql.gz`);

  await new Promise<void>((resolve, reject) => {
    const args = [
      `-h${cfg.host}`,
      `-P${cfg.port}`,
      `-u${cfg.user}`,
      `--password=${cfg.password}`,
      "--single-transaction",
      "--quick",
      cfg.database,
    ];
    const dump = spawn("mysqldump", args, { stdio: ["ignore", "pipe", "pipe"] });
    const gzip = spawn("gzip", ["-c"], { stdio: ["pipe", "pipe", "pipe"] });
    const out = fs.createWriteStream(filePath);
    dump.stdout.pipe(gzip.stdin);
    gzip.stdout.pipe(out);
    let err = "";
    dump.stderr.on("data", (chunk) => {
      err += String(chunk);
    });
    gzip.stderr.on("data", (chunk) => {
      err += String(chunk);
    });
    out.on("close", () => {
      if (dump.exitCode && dump.exitCode !== 0) {
        reject(new Error(err || `mysqldump exit ${dump.exitCode}`));
        return;
      }
      resolve();
    });
    dump.on("error", reject);
    gzip.on("error", reject);
  });

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
