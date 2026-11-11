// Восстанавливает обложки импортированных Telegram-видео, скачивая исходники и создавая объекты S3. Требует отдельного плана и резервной копии привязок.
/**
 * Backfill video thumbnails for already-imported Telegram club posts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
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

async function uploadS3(key, body) {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: "image/jpeg",
      ACL: "public-read",
    }),
  );
  return S3_PUBLIC + key;
}

async function main() {
  const data = JSON.parse(fs.readFileSync(RESULT_JSON, "utf8"));
  const byId = new Map(data.messages.filter((m) => m.type === "message").map((m) => [m.id, m]));
  const conn = await mysql.createConnection(env.DATABASE_URL);
  const [posts] = await conn.query(
    "SELECT id, instagramId, photos FROM posts WHERE target = 'club' AND instagramId LIKE 'tg-%'",
  );

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const post of posts) {
    const msgId = Number(String(post.instagramId).replace("tg-", ""));
    const msg = byId.get(msgId);
    if (!msg?.thumbnail) {
      skipped += 1;
      continue;
    }

    let photos = [];
    try {
      photos = JSON.parse(post.photos || "[]");
    } catch {
      photos = [];
    }
    if (photos.length > 0) {
      skipped += 1;
      continue;
    }

    try {
      const diskPath = yandexDiskPath(msg.thumbnail);
      if (!diskPath) {
        skipped += 1;
        continue;
      }
      const name = path.basename(msg.thumbnail);
      const body = await getCachedOrDownload(diskPath);
      const url = await uploadS3(`club/tg/${msgId}/${name}`, body);
      await conn.query("UPDATE posts SET photos = ? WHERE id = ?", [JSON.stringify([url]), post.id]);

      if (msg.duration_seconds) {
        await conn.query(
          "UPDATE post_media SET duration = ? WHERE postId = ? AND type = 'video' AND duration IS NULL",
          [Number(msg.duration_seconds), post.id],
        );
      }

      updated += 1;
      if (updated % 5 === 0) console.log("updated", updated, post.instagramId);
    } catch (error) {
      errors += 1;
      console.error("fail", post.instagramId, error.message);
    }
  }

  await conn.end();
  console.log(JSON.stringify({ total: posts.length, updated, skipped, errors }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
