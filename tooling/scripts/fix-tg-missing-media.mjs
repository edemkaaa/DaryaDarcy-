/**
 * Backfill missing photos/video/audio for imported Telegram posts.
 * Handles export rows where file paths were omitted but files exist on Yandex Disk.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { buildAlbumGroups } from "../../apps/frontend/lib/telegram-albums.mjs";

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
const FILE_NOT_INCLUDED = /not included/i;

const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: "ru-1",
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  forcePathStyle: true,
});
const S3_PUBLIC = `${env.S3_ENDPOINT}/${env.S3_BUCKET}/`;

function guessContentType(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".mp4") || lower.endsWith(".m4v")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "application/octet-stream";
}

async function listDiskFiles(folder) {
  const names = [];
  let offset = 0;
  while (true) {
    const url =
      "https://cloud-api.yandex.net/v1/disk/public/resources?public_key=" +
      encodeURIComponent(YANDEX_PUBLIC) +
      "&path=" +
      encodeURIComponent(folder) +
      "&limit=500&offset=" +
      offset;
    const json = await fetch(url).then((r) => r.json());
    const items = json._embedded?.items || [];
    for (const item of items) {
      if (item.type === "file") names.push({ folder, name: item.name });
    }
    offset += items.length;
    if (offset >= (json._embedded?.total || 0) || items.length === 0) break;
  }
  return names;
}

async function yandexDownload(diskPath) {
  const url =
    "https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=" +
    encodeURIComponent(YANDEX_PUBLIC) +
    "&path=" +
    encodeURIComponent(diskPath);
  const meta = await fetch(url).then((r) => r.json());
  if (!meta.href) throw new Error(`Yandex download missing: ${diskPath}`);
  const res = await fetch(meta.href);
  if (!res.ok) throw new Error(`Download failed ${diskPath}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function getCachedOrDownload(diskPath) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const safe = diskPath.replace(/[^\w@.\-]+/g, "_");
  const cacheFile = path.join(CACHE_DIR, safe);
  if (fs.existsSync(cacheFile)) return fs.readFileSync(cacheFile);
  const buf = await yandexDownload(diskPath);
  fs.writeFileSync(cacheFile, buf);
  return buf;
}

async function uploadS3(key, body, contentType) {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: "public-read",
    }),
  );
  return S3_PUBLIC + key;
}

function diskPathForFile(folder, name) {
  return `${folder}/${name}`;
}

function resolveMediaPaths(msg) {
  const paths = [];
  if (msg.file_name && !FILE_NOT_INCLUDED.test(String(msg.file_name))) {
    const base = path.basename(String(msg.file_name));
    const lower = base.toLowerCase();
    if (lower.endsWith(".m4a") || msg.media_type === "voice_message") {
      paths.push(diskPathForFile("/подкасты", base));
    } else if (/\.(mov|m4v|mp4)$/i.test(lower) || msg.media_type === "video_file") {
      paths.push(diskPathForFile("/видео из клуба", base));
    } else if (/\.(docx?|pdf)$/i.test(lower)) {
      paths.push(diskPathForFile("/документы из клуба", base));
      paths.push(diskPathForFile("", base));
    }
  }
  return paths;
}

function resolvePhotoPaths(msg, photoIndex, albumCount = 1) {
  const paths = [];
  if (msg.photo && !FILE_NOT_INCLUDED.test(String(msg.photo))) {
    const base = path.basename(String(msg.photo).replace(/\\/g, "/"));
    paths.push(diskPathForFile("/фото из клуба", base));
  }
  const exact = expectedPhotoName(msg);
  const match = photoIndex.find((f) => f.name === exact);
  if (match) {
    paths.push(diskPathForFile(match.folder, match.name));
    return paths;
  }

  const suffix = dateSuffix(msg);
  const bySuffix = photoIndex
    .filter((f) => f.name.startsWith("photo_") && f.name.includes(suffix))
    .sort((a, b) => {
      const idA = Number(a.name.match(/^photo_(\d+)@/)?.[1] || 0);
      const idB = Number(b.name.match(/^photo_(\d+)@/)?.[1] || 0);
      return idA - idB;
    });
  if (bySuffix.length === albumCount || (albumCount === 1 && bySuffix.length === 1)) {
    for (const item of bySuffix) paths.push(diskPathForFile(item.folder, item.name));
  }
  return paths;
}

function dateSuffix(msg) {
  const d = new Date(Number(msg.date_unixtime) * 1000);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `@${dd}-${mm}-${yyyy}_${hh}-${mi}-${ss}`;
}

function expectedPhotoName(msg) {
  return `photo_${msg.id}${dateSuffix(msg)}.jpg`;
}

function resolveThumbPath(videoName) {
  return diskPathForFile("/видео из клуба", `${videoName}_thumb.jpg`);
}

async function main() {
  console.log("Loading disk indexes...");
  const photoFiles = await listDiskFiles("/фото из клуба");
  const videoNames = new Set((await listDiskFiles("/видео из клуба")).map((f) => f.name));

  const data = JSON.parse(fs.readFileSync(RESULT_JSON, "utf8"));
  const messages = data.messages.filter((m) => m.type === "message");
  const byId = new Map(messages.map((m) => [m.id, m]));
  const { albumPhotos } = buildAlbumGroups(messages);

  const conn = await mysql.createConnection(env.DATABASE_URL);
  const [rows] = await conn.query(`
    SELECT p.id, p.instagramId, p.photos,
      (SELECT COUNT(*) FROM post_media pm WHERE pm.postId = p.id) AS mediaCount
    FROM posts p
    WHERE p.source = 'telegram'
  `);

  let photoUpdated = 0;
  let mediaUpdated = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    const msgId = Number(String(row.instagramId).replace("tg-", ""));
    const msg = byId.get(msgId);
    if (!msg) continue;

    const photos = typeof row.photos === "string" ? JSON.parse(row.photos) : row.photos || [];
    const hasPhotos = photos.length > 0;
    const hasMedia = Number(row.mediaCount) > 0;

    try {
      const newPhotos = [...photos];
      let changedPhotos = false;

      const isPhotoPost =
        Boolean(msg.photo) ||
        Boolean(msg.width && msg.height && !msg.media_type) ||
        (albumPhotos.get(msgId)?.length ?? 0) > 0;
      const isMediaOnlyPost =
        msg.media_type === "voice_message" ||
        (msg.file_name && !msg.photo && !msg.width);

      if (!hasPhotos && isPhotoPost && !isMediaOnlyPost) {
        const album = albumPhotos.get(msgId) || [];
        const uniquePaths = new Set();
        if (album.length) {
          for (const diskPath of resolvePhotoPaths(msg, photoFiles, album.length)) {
            uniquePaths.add(diskPath);
          }
        } else {
          for (const diskPath of resolvePhotoPaths(msg, photoFiles, 1)) {
            uniquePaths.add(diskPath);
          }
        }

        for (const diskPath of uniquePaths) {
          try {
            const name = path.basename(diskPath);
            const body = await getCachedOrDownload(diskPath);
            const url = await uploadS3(`club/tg/${msgId}/${name}`, body, guessContentType(name));
            newPhotos.push(url);
            changedPhotos = true;
          } catch {
            // try next candidate
          }
        }
      }

      if (!hasMedia) {
        for (const diskPath of resolveMediaPaths(msg)) {
          if (!videoNames.has(path.basename(diskPath)) && !diskPath.includes("/подкасты/")) {
            // still try download — videoNames may be incomplete page; download validates
          }
          try {
            const name = path.basename(diskPath);
            const body = await getCachedOrDownload(diskPath);
            const mime = msg.mime_type || guessContentType(name);
            const url = await uploadS3(`club/tg/${msgId}/${name}`, body, mime);
            const duration = msg.duration_seconds ? Number(msg.duration_seconds) : null;

            let type = "document";
            if (mime.startsWith("video/") || msg.media_type === "video_file") type = "video";
            else if (mime.startsWith("audio/") || msg.media_type === "voice_message" || name.endsWith(".m4a")) {
              type = "audio";
            }

            if (type === "video") {
              const thumbPath = resolveThumbPath(name);
              if (videoNames.has(`${name}_thumb.jpg`)) {
                try {
                  const thumbName = `${name}_thumb.jpg`;
                  const thumbBody = await getCachedOrDownload(thumbPath);
                  const thumbUrl = await uploadS3(
                    `club/tg/${msgId}/${thumbName}`,
                    thumbBody,
                    "image/jpeg",
                  );
                  if (!newPhotos.includes(thumbUrl)) {
                    newPhotos.unshift(thumbUrl);
                    changedPhotos = true;
                  }
                } catch {
                  // optional thumbnail
                }
              }
            }

            await conn.query(
              `INSERT INTO post_media (postId, type, url, filename, mimeType, duration, sortOrder)
               VALUES (?, ?, ?, ?, ?, ?, 0)`,
              [row.id, type, url, name, mime, duration],
            );
            mediaUpdated += 1;
            console.log("media", row.instagramId, type, name);
            break;
          } catch (error) {
            // try next path
          }
        }
      }

      if (changedPhotos) {
        await conn.query("UPDATE posts SET photos = ? WHERE id = ?", [JSON.stringify(newPhotos), row.id]);
        photoUpdated += 1;
        console.log("photos", row.instagramId, newPhotos.length);
      }

      if (!changedPhotos && !hasMedia && resolveMediaPaths(msg).length === 0 && !hasPhotos) {
        skipped += 1;
      }
    } catch (error) {
      errors += 1;
      console.error("fail", row.instagramId, error.message);
    }
  }

  await conn.end();
  console.log(JSON.stringify({ photoUpdated, mediaUpdated, skipped, errors }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
