/**
 * Import Telegram club posts from result.json + Yandex Disk media.
 *
 * Usage:
 *   node tooling/data/import-telegram-club.mjs --dry-run --limit=5
 *   node tooling/data/import-telegram-club.mjs --filter=tagged
 *   node tooling/data/import-telegram-club.mjs --filter=all
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { buildTelegramPostContent, isTaggedClubMessage } from "../../apps/frontend/lib/telegram-post-tags.mjs";
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
const PROGRESS_FILE = path.join(root, ".tmp-telegram-import.json");
const CACHE_DIR = path.join(root, ".tmp-telegram-media");

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [k, v] = arg.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);

const DRY_RUN = args["dry-run"] === "true";
const LIMIT = args.limit ? Number(args.limit) : Infinity;
const FILTER = args.filter || "tagged"; // tagged | all

const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: "ru-1",
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  forcePathStyle: true,
});
const S3_PUBLIC = `${env.S3_ENDPOINT}/${env.S3_BUCKET}/`;

function loadProgress() {
  if (!fs.existsSync(PROGRESS_FILE)) return { importedIds: [] };
  return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function plainFromMessage(msg) {
  return buildTelegramPostContent(msg).text;
}

function matchesFilter(msg) {
  if (FILTER === "all") return true;
  return isTaggedClubMessage(msg);
}

const FILE_NOT_INCLUDED = /not included/i;

function isMissingExportFile(value) {
  return !value || FILE_NOT_INCLUDED.test(String(value));
}

function yandexDiskPath(relativePath) {
  const base = path.basename(relativePath.replace(/\\/g, "/"));
  const rel = relativePath.replace(/\\/g, "/");
  if (rel.startsWith("photos/")) return `/фото из клуба/${base}`;
  if (rel.startsWith("video_files/")) return `/видео из клуба/${base}`;
  if (rel.startsWith("voice_messages/")) return `/подкасты/${base}`;
  if (rel.startsWith("files/") && base.endsWith(".m4a")) return `/подкасты/${base}`;
  return null;
}

/** When TG export omits file paths, map file_name to Yandex Disk folders. */
function yandexDiskPathFromFileName(fileName, msg) {
  const base = path.basename(String(fileName).replace(/\\/g, "/"));
  const lower = base.toLowerCase();
  if (lower.endsWith(".m4a") || lower.endsWith(".mp3") || msg.media_type === "voice_message") {
    return `/подкасты/${base}`;
  }
  if (/\.(mov|m4v|mp4|webm)$/i.test(lower) || msg.media_type === "video_file") {
    return `/видео из клуба/${base}`;
  }
  if (/\.(docx?|pdf)$/i.test(lower)) return `/документы из клуба/${base}`;
  return null;
}

const ALT_DISK_PATHS = {
  "билеты.docx": [
    "/документы из клуба/билеты.docx",
    "/билеты.docx",
    "/документы из клуба/2025-05-28 11-37-27.docx",
    "/2025-05-28 11-37-27.docx",
  ],
};

function localMediaCandidates(fileName) {
  const base = path.basename(String(fileName).replace(/\\/g, "/"));
  return [
    path.join(root, ".tmp-media", base),
    path.join(root, ".tmp-media", "билеты.docx"),
  ];
}

async function loadMediaBody(diskPath, fileName) {
  for (const localPath of localMediaCandidates(fileName)) {
    if (fs.existsSync(localPath)) {
      console.log("local file", localPath);
      return fs.readFileSync(localPath);
    }
  }
  const altPaths = ALT_DISK_PATHS[path.basename(String(fileName))] || [];
  const paths = [diskPath, ...altPaths].filter(Boolean);
  let lastError;
  for (const candidate of paths) {
    try {
      return await getCachedOrDownload(candidate);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`Media missing: ${fileName}`);
}

function resolveMediaFile(msg) {
  if (!isMissingExportFile(msg.file)) {
    return {
      name: path.basename(msg.file.replace(/\\/g, "/")),
      diskPath: yandexDiskPath(msg.file),
    };
  }
  if (msg.file_name && !isMissingExportFile(msg.file_name)) {
    const name = path.basename(String(msg.file_name).replace(/\\/g, "/"));
    return {
      name,
      diskPath: yandexDiskPathFromFileName(msg.file_name, msg),
    };
  }
  return null;
}

function resolveThumbnailFile(msg, mediaFileName) {
  if (!isMissingExportFile(msg.thumbnail)) {
    return {
      name: path.basename(msg.thumbnail.replace(/\\/g, "/")),
      diskPath: yandexDiskPath(msg.thumbnail),
    };
  }
  if (!mediaFileName) return null;
  const name = `${mediaFileName}_thumb.jpg`;
  return { name, diskPath: `/видео из клуба/${name}` };
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
  if (DRY_RUN) return S3_PUBLIC + key;
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

function guessContentType(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".mp4") || lower.endsWith(".m4v")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".m4a")) return "audio/mp4";
  return "application/octet-stream";
}

async function importThumbnail(msg, photos, mediaFileName) {
  const thumb = resolveThumbnailFile(msg, mediaFileName);
  if (!thumb?.diskPath) return;
  const body = await getCachedOrDownload(thumb.diskPath);
  const url = await uploadS3(`club/tg/${msg.id}/${thumb.name}`, body, guessContentType(thumb.name));
  photos.unshift(url);
}

async function importPhotoPath(msgId, photoPath) {
  const diskPath = yandexDiskPath(photoPath);
  if (!diskPath) return null;
  const name = path.basename(photoPath);
  const body = await getCachedOrDownload(diskPath);
  const url = await uploadS3(`club/tg/${msgId}/${name}`, body, guessContentType(name));
  return url;
}

async function importMedia(msg, albumPhotoPaths = []) {
  const photos = [];
  const media = [];
  const paths = albumPhotoPaths.length ? albumPhotoPaths : msg.photo ? [msg.photo] : [];

  for (const photoPath of paths) {
    const url = await importPhotoPath(msg.id, photoPath);
    if (url) photos.push(url);
  }

  const mediaFile = resolveMediaFile(msg);
  if (mediaFile?.diskPath || mediaFile?.name) {
    const { name, diskPath } = mediaFile;
    const mime = msg.mime_type || guessContentType(name);
    const body = await loadMediaBody(diskPath, name);
    const url = await uploadS3(`club/tg/${msg.id}/${name}`, body, mime);
    const duration = msg.duration_seconds ? Number(msg.duration_seconds) : null;
    if (mime.startsWith("video/") || msg.media_type === "video_file") {
      try {
        await importThumbnail(msg, photos, name);
      } catch (error) {
        console.warn("thumbnail skip", msg.id, error.message);
      }
      media.push({ type: "video", url, filename: name, mimeType: mime, duration });
    } else if (mime.startsWith("audio/") || msg.media_type === "audio_file" || name.endsWith(".m4a")) {
      media.push({ type: "audio", url, filename: name, mimeType: mime, duration });
    } else {
      media.push({ type: "document", url, filename: name, mimeType: mime, duration });
    }
  }

  return { photos, media };
}

async function main() {
  console.log("Reading", RESULT_JSON);
  const data = JSON.parse(fs.readFileSync(RESULT_JSON, "utf8"));
  const messages = data.messages.filter((m) => m.type === "message");
  const { absorbedBy, albumPhotos } = buildAlbumGroups(messages);
  const progress = loadProgress();
  const done = new Set(progress.importedIds);
  const conn = DRY_RUN ? null : await mysql.createConnection(env.DATABASE_URL);

  let scanned = 0;
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const msg of messages) {
    if (imported >= LIMIT) break;
    scanned += 1;
    const tgId = `tg-${msg.id}`;
    if (done.has(msg.id)) {
      skipped += 1;
      continue;
    }
    if (absorbedBy.has(msg.id)) {
      skipped += 1;
      continue;
    }

    const rawText = msg.text_entities?.length
      ? msg.text_entities.map((p) => p.text || "").join("")
      : typeof msg.text === "string"
        ? msg.text
        : plainFromMessage(msg);
    if (!matchesFilter(msg)) continue;

    const { text, richText, tags } = buildTelegramPostContent(msg);
    if (!isTaggedClubMessage(msg) && FILTER === "tagged") continue;
    if (!text && !msg.photo && !resolveMediaFile(msg)) continue;

    try {
      const { photos, media } = await importMedia(msg, albumPhotos.get(msg.id) || []);
      if (!text && photos.length === 0 && media.length === 0) {
        skipped += 1;
        continue;
      }

      const publishedAt = new Date(Number(msg.date_unixtime) * 1000);
      const sortOrder = Number(msg.date_unixtime);

      if (DRY_RUN) {
        console.log("DRY", tgId, tags.join(","), text.slice(0, 80), photos.length, media.length);
        imported += 1;
        continue;
      }

      const [existing] = await conn.query(
        "SELECT id FROM posts WHERE instagramId = ? LIMIT 1",
        [tgId],
      );
      if (existing.length) {
        done.add(msg.id);
        skipped += 1;
        continue;
      }

      const [result] = await conn.query(
        `INSERT INTO posts (text, photos, tags, source, instagramId, sortOrder, published, status, target, publishedAt, richText)
         VALUES (?, ?, ?, 'telegram', ?, ?, 1, 'published', 'club', ?, ?)`,
        [
          text,
          JSON.stringify(photos),
          JSON.stringify(tags),
          tgId,
          sortOrder,
          publishedAt,
          richText ? JSON.stringify(richText) : null,
        ],
      );
      const postId = result.insertId;

      for (let i = 0; i < media.length; i++) {
        const item = media[i];
        await conn.query(
          `INSERT INTO post_media (postId, type, url, filename, mimeType, duration, sortOrder)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [postId, item.type, item.url, item.filename, item.mimeType, item.duration ?? null, i],
        );
      }

      done.add(msg.id);
      progress.importedIds.push(msg.id);
      if (progress.importedIds.length % 10 === 0) saveProgress(progress);
      imported += 1;
      if (imported % 5 === 0) {
        console.log("imported", imported, tgId, tags.join(","));
      }
    } catch (error) {
      errors += 1;
      console.error("fail", msg.id, error.message);
      if (errors > 20 && FILTER !== "all") break;
    }
  }

  saveProgress(progress);
  if (conn) await conn.end();
  console.log(JSON.stringify({ scanned, imported, skipped, errors, filter: FILTER, dryRun: DRY_RUN }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
