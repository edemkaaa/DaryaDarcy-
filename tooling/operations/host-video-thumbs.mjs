// Переносит обложки старого YouTube-каталога в S3 и меняет thumbnailUrl. Для VK используется отдельный механизм метаданных.
/**
 * Download YouTube thumbnails on the VPS (YouTube is reachable there),
 * store them on Timeweb S3, and point videos.thumbnailUrl at S3.
 * Fallback: https://daryadarcy.com/media/yt-thumb/{id}/hqdefault.jpg
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const env = {};
for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

const SIZES = ["hqdefault.jpg", "sddefault.jpg", "mqdefault.jpg", "0.jpg"];
const PROXY = "https://daryadarcy.com/media/yt-thumb";

function s3Client() {
  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: "ru-1",
    credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
    forcePathStyle: true,
  });
}

async function fetchThumb(youtubeId) {
  for (const file of SIZES) {
    const url = `https://i.ytimg.com/vi/${youtubeId}/${file}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) continue;
    return buf;
  }
  return null;
}

async function main() {
  const conn = await mysql.createConnection(env.DATABASE_URL.replace(/\r/g, "").trim());
  const [rows] = await conn.query("SELECT id, youtubeId, thumbnailUrl FROM videos");
  const client = s3Client();
  let uploaded = 0;
  let proxied = 0;
  let skipped = 0;

  for (const row of rows) {
    const alreadyS3 = typeof row.thumbnailUrl === "string" && row.thumbnailUrl.includes("s3.twcstorage.ru");
    if (alreadyS3) {
      skipped++;
      continue;
    }
    const key = `videos/thumbs/${row.youtubeId}.jpg`;
    let publicUrl = `${PROXY}/${row.youtubeId}/hqdefault.jpg`;
    try {
      const buf = await fetchThumb(row.youtubeId);
      if (buf) {
        await client.send(
          new PutObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: key,
            Body: buf,
            ContentType: "image/jpeg",
            ACL: "public-read",
          }),
        );
        publicUrl = `${env.S3_ENDPOINT.replace(/\/$/, "")}/${env.S3_BUCKET}/${key}`;
        uploaded++;
      } else {
        proxied++;
      }
    } catch (err) {
      proxied++;
      console.error("thumb fail", row.youtubeId, err.message);
    }
    await conn.query("UPDATE videos SET thumbnailUrl = ? WHERE id = ?", [publicUrl, row.id]);
  }

  await conn.end();
  console.log(JSON.stringify({ total: rows.length, uploaded, proxied, skipped }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
