// Прежнее append-only резервирование копирует медиа в backup-бакет без удаления исходников. Setup меняет политики; актуальность путей и восстановление проверяются отдельно.
/**
 * Append-only media backup: copy objects from source bucket to backup bucket.
 * Never deletes objects in the backup bucket (not a mirror/sync).
 *
 * Usage:
 *   node tooling/operations/s3-media-backup.mjs [--setup] [--verify]
 *
 * Env (s3-backup.env or flags):
 *   S3_ENDPOINT, SOURCE_S3_BUCKET, BACKUP_S3_BUCKET
 *   SOURCE_S3_ACCESS_KEY, SOURCE_S3_SECRET_KEY  (read source)
 *   BACKUP_S3_ACCESS_KEY, BACKUP_S3_SECRET_KEY (write backup)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CopyObjectCommand,
  CreateBucketCommand,
  GetBucketVersioningCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutBucketLifecycleConfigurationCommand,
  PutBucketPolicyCommand,
  PutBucketVersioningCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = new Set(process.argv.slice(2));
const envPath = process.env.S3_BACKUP_ENV || path.join(root, "deploy", "s3-backup.env");

function loadEnv(file) {
  // Читает закрытый операторский файл настроек без выполнения shell-подстановок.

  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
      }),
  );
}

const env = { ...loadEnv(path.join(root, ".env")), ...loadEnv(envPath) };

const endpoint = env.S3_ENDPOINT || "https://s3.twcstorage.ru";
const sourceBucket = env.SOURCE_S3_BUCKET || env.S3_BUCKET || "daryadarcy-s3";
const backupBucket = env.BACKUP_S3_BUCKET || "daryadarcy-s3-backup";
const appAccessKey = env.APP_S3_ACCESS_KEY || env.S3_ACCESS_KEY;

function client(accessKey, secretKey) {
  // Создаёт отдельный S3-клиент для выданных прав чтения источника либо записи резервного бакета.

  return new S3Client({
    endpoint,
    region: "ru-1",
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true,
  });
}

const sourceClient = client(
  env.SOURCE_S3_ACCESS_KEY || env.S3_ACCESS_KEY,
  env.SOURCE_S3_SECRET_KEY || env.S3_SECRET_KEY,
);
const backupClient = client(env.BACKUP_S3_ACCESS_KEY, env.BACKUP_S3_SECRET_KEY);

function backupBucketPolicy() {
  // Формирует запрет удаления через S3 API и требование HTTPS; это не Object Lock и не запрет смены политики владельцем.

  const statements = [
    {
      Sid: "DenyAllApiDeletes",
      Effect: "Deny",
      Principal: "*",
      Action: ["s3:DeleteObject", "s3:DeleteObjectVersion", "s3:DeleteBucket"],
      Resource: [`arn:aws:s3:::${backupBucket}`, `arn:aws:s3:::${backupBucket}/*`],
    },
    {
      Sid: "RequireHTTPS",
      Effect: "Deny",
      Principal: "*",
      Action: "s3:*",
      Resource: [`arn:aws:s3:::${backupBucket}`, `arn:aws:s3:::${backupBucket}/*`],
      Condition: { Bool: { "aws:SecureTransport": "false" } },
    },
  ];

  return JSON.stringify({ Version: "2012-10-17", Statement: statements });
}

async function bucketExists(client, bucket) {
  // Пробует HEAD бакета; исторически любая ошибка считается отсутствием, поэтому доступ нужно проверять отдельно.

  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch {
    return false;
  }
}

async function setupBackup() {
  // Создаёт/настраивает резервный бакет, версии, lifecycle и политику; это режим внешних изменений.

  if (!env.BACKUP_S3_ACCESS_KEY || !env.BACKUP_S3_SECRET_KEY) {
    throw new Error("Missing BACKUP_S3_ACCESS_KEY / BACKUP_S3_SECRET_KEY in s3-backup.env");
  }

  const exists = await bucketExists(backupClient, backupBucket);
  if (!exists) {
    console.log(`Creating bucket ${backupBucket}...`);
    const createClient = new S3Client({
      endpoint,
      region: "us-east-1",
      credentials: {
        accessKeyId: env.BACKUP_S3_ACCESS_KEY,
        secretAccessKey: env.BACKUP_S3_SECRET_KEY,
      },
      forcePathStyle: true,
    });
    try {
      await createClient.send(new CreateBucketCommand({ Bucket: backupBucket }));
    } catch (error) {
      const code = error?.Code || error?.name;
      if (code !== "BucketAlreadyExists" && code !== "BucketAlreadyOwnedByYou") {
        throw new Error(
          `CreateBucket failed (${code}). Create "${backupBucket}" in Timeweb panel (Object Storage, cold class) and rerun --setup.`,
        );
      }
    }
  } else {
    console.log(`Bucket ${backupBucket} already exists`);
  }

  await backupClient.send(
    new PutBucketVersioningCommand({
      Bucket: backupBucket,
      VersioningConfiguration: { Status: "Enabled" },
    }),
  );
  console.log("Versioning: Enabled");

  const lifecycle = JSON.parse(
    fs.readFileSync(path.join(root, "deploy", "s3-backup-lifecycle.json"), "utf8"),
  );
  await backupClient.send(
    new PutBucketLifecycleConfigurationCommand({
      Bucket: backupBucket,
      LifecycleConfiguration: lifecycle,
    }),
  );
  console.log("Lifecycle: noncurrent versions expire after 90 days");

  await backupClient.send(
    new PutBucketPolicyCommand({
      Bucket: backupBucket,
      Policy: backupBucketPolicy(),
    }),
  );
  console.log("Bucket policy: all API deletes denied (immutable backup via S3 API)");

  const ver = await backupClient.send(new GetBucketVersioningCommand({ Bucket: backupBucket }));
  console.log("Versioning status:", ver.Status);
}

async function headEtag(client, bucket, key) {
  // Получает ETag существующей копии; только 404 трактуется как отсутствие, остальные ошибки прерывают операцию.

  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return head.ETag?.replace(/"/g, "") ?? null;
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
}

async function runBackup() {
  // Постранично копирует отличающиеся объекты без удаления; ETag — признак совпадения, а не универсальный SHA-256.

  const started = Date.now();
  let listed = 0;
  let copied = 0;
  let skipped = 0;
  let bytes = 0;
  let token;

  do {
    const page = await sourceClient.send(
      new ListObjectsV2Command({
        Bucket: sourceBucket,
        ContinuationToken: token,
        MaxKeys: 500,
      }),
    );

    for (const obj of page.Contents ?? []) {
      if (!obj.Key) continue;
      listed += 1;
      const size = obj.Size ?? 0;

      const sourceEtag = obj.ETag?.replace(/"/g, "") ?? null;
      const backupEtag = await headEtag(backupClient, backupBucket, obj.Key);
      if (sourceEtag && backupEtag && sourceEtag === backupEtag) {
        skipped += 1;
        continue;
      }

      const copySource = `${sourceBucket}/${obj.Key.split("/").map(encodeURIComponent).join("/")}`;
      await backupClient.send(
        new CopyObjectCommand({
          Bucket: backupBucket,
          Key: obj.Key,
          CopySource: copySource,
          MetadataDirective: "COPY",
        }),
      );
      copied += 1;
      bytes += size;

      if (listed % 200 === 0) {
        console.log(`progress listed=${listed} copied=${copied} skipped=${skipped}`);
      }
    }

    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);

  const report = {
    ok: true,
    finished_at: new Date().toISOString(),
    source_bucket: sourceBucket,
    backup_bucket: backupBucket,
    objects_listed: listed,
    objects_copied: copied,
    objects_skipped_unchanged: skipped,
    bytes_copied: bytes,
    bytes_copied_mb: +(bytes / 1024 / 1024).toFixed(1),
    duration_sec: +((Date.now() - started) / 1000).toFixed(1),
    mode: "append-only copy (no deletes in backup bucket)",
    versioning: "enabled",
    noncurrent_retention_days: 90,
  };

  const reportPath = path.join(root, "deploy", "s3-backup-last-run.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  return report;
}

async function verifyBackup() {
  // Сравнивает общие числа объектов и байтов; полный контроль содержимого или восстановление этим не подтверждаются.

  let sourceCount = 0;
  let sourceBytes = 0;
  let token;

  do {
    const page = await sourceClient.send(
      new ListObjectsV2Command({ Bucket: sourceBucket, ContinuationToken: token, MaxKeys: 1000 }),
    );
    for (const obj of page.Contents ?? []) {
      sourceCount += 1;
      sourceBytes += obj.Size ?? 0;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);

  let backupCount = 0;
  let backupBytes = 0;
  token = undefined;
  do {
    const page = await backupClient.send(
      new ListObjectsV2Command({ Bucket: backupBucket, ContinuationToken: token, MaxKeys: 1000 }),
    );
    for (const obj of page.Contents ?? []) {
      backupCount += 1;
      backupBytes += obj.Size ?? 0;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);

  const report = {
    source_bucket: sourceBucket,
    backup_bucket: backupBucket,
    source_objects: sourceCount,
    source_bytes: sourceBytes,
    source_gb: +(sourceBytes / 1024 / 1024 / 1024).toFixed(2),
    backup_objects: backupCount,
    backup_bytes: backupBytes,
    backup_gb: +(backupBytes / 1024 / 1024 / 1024).toFixed(2),
    coverage_objects_pct: sourceCount ? +((backupCount / sourceCount) * 100).toFixed(1) : 0,
  };
  console.log(JSON.stringify(report, null, 2));
  return report;
}

if (args.has("--setup")) {
  await setupBackup();
} else if (args.has("--verify")) {
  await verifyBackup();
} else {
  await runBackup();
}
