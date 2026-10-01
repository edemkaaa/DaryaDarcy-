/**
 * Backfill multi-photo albums for imported Telegram club posts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { buildAlbumGroups } from "../lib/telegram-albums.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const YANDEX_PUBLIC = "https://disk.yandex.ru/d/zW0PCeuErNdIAg";
const RESULT_JSON = process.env.TG_RESULT_JSON || "C:/Users/Иван/Downloads/result 2.json";
const CACHE_DIR = path.join(root, ".tmp-telegram-media");

const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: "ru-1",
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  forcePathStyle: true,
});
const S3_PUBLIC = `${env.S3_ENDPOINT}/${env.S3_BUCKET}/`;

function yandexDiskPath(relativePath) {
  const base = path.basename(relativePath.replace(/\\/g, "/"));
  const rel = relativePath.replace(/\\/g, "/");
  if (rel.startsWith("photos/")) return `/фото из клуба/${base}`;
  if (rel.startsWith("video_files/")) return `/видео из клуба/${base}`;
  return null;
}

async function getCachedOrDownload(diskPath) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const safe = diskPath.replace(/[^\w@.\-]+/g, "_");
  const cacheFile = path.join(CACHE_DIR, safe);
  if (fs.existsSync(cacheFile)) return fs.readFileSync(cacheFile);
  const url =
    "https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=" +
    encodeURIComponent(YANDEX_PUBLIC) +
    "&path=" +
    encodeURIComponent(diskPath);
  const meta = await fetch(url).then((r) => r.json());
  if (!meta.href) throw new Error(`Yandex download missing: ${diskPath}`);
  const res = await fetch(meta.href);
  if (!res.ok) throw new Error(`Download failed ${diskPath}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(cacheFile, buf);
  return buf;
}

async function uploadPhoto(msgId, photoPath) {
  const diskPath = yandexDiskPath(photoPath);
  if (!diskPath) return null;
  const name = path.basename(photoPath);
  const body = await getCachedOrDownload(diskPath);
  const key = `club/tg/${msgId}/${name}`;
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg",
      ACL: "public-read",
    }),
  );
  return S3_PUBLIC + key;
}

async function main() {
  const data = JSON.parse(fs.readFileSync(RESULT_JSON, "utf8"));
  const messages = data.messages.filter((m) => m.type === "message");
  const { albumPhotos } = buildAlbumGroups(messages);
  const conn = await mysql.createConnection(env.DATABASE_URL);
  const [posts] = await conn.query(
    "SELECT id, instagramId, photos FROM posts WHERE target = 'club' AND instagramId LIKE 'tg-%'",
  );

  let updated = 0;
  let skipped = 0;

  for (const post of posts) {
    const msgId = Number(String(post.instagramId).replace("tg-", ""));
    const paths = albumPhotos.get(msgId);
    if (!paths || paths.length <= 1) {
      skipped += 1;
      continue;
    }

    const current = Array.isArray(post.photos) ? post.photos : JSON.parse(post.photos || "[]");
    if (current.length >= paths.length) {
      skipped += 1;
      continue;
    }

    const urls = [];
    for (const photoPath of paths) {
      const url = await uploadPhoto(msgId, photoPath);
      if (url) urls.push(url);
    }
    if (urls.length <= current.length) {
      skipped += 1;
      continue;
    }

    await conn.query("UPDATE posts SET photos = ? WHERE id = ?", [JSON.stringify(urls), post.id]);
    updated += 1;
    console.log("updated", post.instagramId, urls.length, "photos");
  }

  await conn.end();
  console.log(JSON.stringify({ total: posts.length, updated, skipped, albums: albumPhotos.size }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
