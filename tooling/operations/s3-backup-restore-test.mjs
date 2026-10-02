/**
 * Test restore: copy 2–3 files from backup bucket to restore-test/ prefix and verify.
 * Usage: S3_BACKUP_ENV=/etc/daryadarcy/s3-backup.env node tooling/operations/s3-backup-restore-test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CopyObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const envPath = process.env.S3_BACKUP_ENV || path.join(root, "deploy", "s3-backup.env");

function loadEnv(file) {
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
const backupBucket = env.BACKUP_S3_BUCKET || "daryadarcy-s3-backup";
const testPrefix = `restore-test/${new Date().toISOString().slice(0, 10)}/`;

const client = new S3Client({
  endpoint,
  region: "ru-1",
  credentials: {
    accessKeyId: env.BACKUP_S3_ACCESS_KEY || env.S3_ACCESS_KEY,
    secretAccessKey: env.BACKUP_S3_SECRET_KEY || env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

const sampleKeys = [
  "app-assets/home/hero_header.jpg",
  "avatars/",
  "feed/",
];

async function pickSampleKeys() {
  const picked = [];
  for (const prefix of sampleKeys) {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: backupBucket, Prefix: prefix, MaxKeys: 5 }),
    );
    for (const obj of res.Contents ?? []) {
      if (!obj.Key || obj.Key.endsWith("/")) continue;
      if (obj.Size && obj.Size > 500) {
        picked.push({ key: obj.Key, size: obj.Size });
        break;
      }
    }
    if (picked.length >= 3) break;
  }

  if (picked.length < 3) {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: backupBucket, Prefix: "app-assets/", MaxKeys: 20 }),
    );
    for (const obj of res.Contents ?? []) {
      if (!obj.Key || obj.Key.endsWith("/")) continue;
      if (picked.some((p) => p.key === obj.Key)) continue;
      picked.push({ key: obj.Key, size: obj.Size ?? 0 });
      if (picked.length >= 3) break;
    }
  }

  return picked.slice(0, 3);
}

function copySource(bucket, key) {
  return `${bucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function publicUrl(key) {
  return `${endpoint}/${backupBucket}/${key.split("/").map(encodeURIComponent).join("/")}`;
}

async function verifyObject(key, expectedSize) {
  const head = await client.send(new HeadObjectCommand({ Bucket: backupBucket, Key: key }));
  const body = await client.send(new GetObjectCommand({ Bucket: backupBucket, Key: key }));
  const chunks = [];
  for await (const chunk of body.Body) chunks.push(chunk);
  const buf = Buffer.concat(chunks);
  const ext = path.extname(key).toLowerCase();
  const imageExts = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
  const okSize = buf.length === (head.ContentLength ?? expectedSize);
  const okMagic =
    ext === ".jpg" || ext === ".jpeg"
      ? buf[0] === 0xff && buf[1] === 0xd8
      : ext === ".png"
        ? buf[0] === 0x89 && buf[1] === 0x50
        : ext === ".webp"
          ? buf.slice(0, 4).toString("ascii") === "RIFF"
          : buf.length > 0;

  return {
    key,
    bytes: buf.length,
    content_type: head.ContentType ?? null,
    size_ok: okSize,
    readable: imageExts.has(ext) ? okMagic : buf.length > 0,
    public_url: publicUrl(key),
  };
}

const samples = await pickSampleKeys();
if (samples.length === 0) throw new Error("No sample files found in backup bucket");

const restored = [];
for (const sample of samples) {
  const destKey = `${testPrefix}${sample.key.split("/").pop()}`;
  await client.send(
    new CopyObjectCommand({
      Bucket: backupBucket,
      Key: destKey,
      CopySource: copySource(backupBucket, sample.key),
      MetadataDirective: "COPY",
    }),
  );
  const check = await verifyObject(destKey, sample.size);
  restored.push({
    source_key: sample.key,
    restored_key: destKey,
    ...check,
  });
}

const report = {
  ok: restored.every((r) => r.size_ok && r.readable),
  backup_bucket: backupBucket,
  test_prefix: testPrefix,
  files: restored,
  note: "Test files copied inside backup bucket only; production bucket untouched.",
};

const out = path.join(root, "deploy", "s3-backup-restore-test.json");
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
