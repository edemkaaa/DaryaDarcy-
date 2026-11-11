// Сопоставляет Telegram-фотографии по точному имени с датой, чтобы не прикрепить другой файл с тем же числовым ID.
/**
 * Re-attach correct Telegram photos using exact filename match (id + date from export).
 * Fixes backfill that matched photo_{id}@* without verifying the date suffix.
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
const DRY_RUN = process.argv.includes("--dry-run");
const ONLY = process.argv.find((a) => a.startsWith("--tag="))?.slice(6);

const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: "ru-1",
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  forcePathStyle: true,
});
const S3_PUBLIC = `${env.S3_ENDPOINT}/${env.S3_BUCKET}/`;

function dateSuffix(msg) {
  // Формирует суффикс имени по локальному часовому поясу процесса; окружение должно совпадать с экспортом.

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
  // Восстанавливает ожидаемое имя экспортированного фото из идентификатора и даты сообщения.

  return `photo_${msg.id}${dateSuffix(msg)}.jpg`;
}

function resolveDiskPhotoNames(diskPhotos, msg, albumPhotos) {
  // Возвращает точное сопоставление фото либо проверенный по количеству набор с суффиксом даты.

  const exact = expectedPhotoName(msg);
  if (diskPhotos.has(exact)) return [exact];

  const album = albumPhotos.get(msg.id);
  const count = album?.length || (msg.photo ? 1 : 0);
  if (!count) return [];

  const suffix = dateSuffix(msg);
  const bySuffix = [...diskPhotos]
    .filter((name) => name.startsWith("photo_") && name.includes(suffix))
    .sort((a, b) => {
      const idA = Number(a.match(/^photo_(\d+)@/)?.[1] || 0);
      const idB = Number(b.match(/^photo_(\d+)@/)?.[1] || 0);
      return idA - idB;
    });

  if (bySuffix.length === count) return bySuffix;
  if (count === 1 && bySuffix.length === 1) return bySuffix;
  return [];
}

function guessContentType(name) {
  // Выводит MIME по расширению исходника; содержимое файла эта историческая эвристика не проверяет.

  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

async function listDiskFiles(folder) {
  // Читает полный список файлов публичного Диска страницами, чтобы сопоставлять имена из экспорта.

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
      if (item.type === "file") names.push(item.name);
    }
    offset += items.length;
    if (offset >= (json._embedded?.total || 0) || items.length === 0) break;
  }
  return new Set(names);
}

async function yandexDownload(diskPath) {
  // Запрашивает временную ссылку скачивания конкретного файла публичного Диска.

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
  // Переиспользует локальную копию или скачивает исходник в кэш; этот исторический путь может обращаться к сети и в dry-run.

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const safe = diskPath.replace(/[^\w@.\-]+/g, "_");
  const cacheFile = path.join(CACHE_DIR, safe);
  if (fs.existsSync(cacheFile)) return fs.readFileSync(cacheFile);
  const buf = await yandexDownload(diskPath);
  fs.writeFileSync(cacheFile, buf);
  return buf;
}

async function uploadS3(key, body, contentType) {
  // Историческая загрузка создаёт публичный объект public-read; не использовать как замену нынешнему защищённому переносу.

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

function albumSiblingMessages(messages, anchor) {
  // Собирает соседние сообщения одного альбома, сохраняя исходный порядок фотографий.

  return messages
    .filter((m) => m.type === "message" && m.date_unixtime === anchor.date_unixtime && m.photo)
    .sort((a, b) => a.id - b.id);
}

function expectedPhotoNamesForPost(messages, msg, albumPhotos, diskPhotos) {
  // Восстанавливает весь список фото поста вместе с сообщениями альбома.

  const fromDisk = resolveDiskPhotoNames(diskPhotos, msg, albumPhotos);
  if (fromDisk.length) return fromDisk;

  const album = albumPhotos.get(msg.id);
  if (album?.length) {
    const siblings = albumSiblingMessages(messages, msg);
    return siblings.map((s) => expectedPhotoName(s));
  }
  if (msg.photo) return [expectedPhotoName(msg)];
  return [];
}

function urlBasename(url) {
  // Сравнивает имя последнего сегмента URL без параметров; это сопоставление имени, а не проверка байтов.

  return decodeURIComponent(url.split("/").pop()?.split("?")[0] || "");
}

function photosMatch(expected, current) {
  // Проверяет совпадение текущих URL и ожидаемых имён перед потенциальной перезаписью массива photos.

  if (expected.length !== current.length) return false;
  return expected.every((name, i) => urlBasename(current[i]) === name);
}

async function main() {
  // Пересопоставляет фото старого импорта; при отсутствии источника возможно очищение photos, поэтому нужен ручной план и бэкап.

  console.log("Loading disk photo index...");
  const diskPhotos = await listDiskFiles("/фото из клуба");
  const videoFiles = await listDiskFiles("/видео из клуба");

  const data = JSON.parse(fs.readFileSync(RESULT_JSON, "utf8"));
  const messages = data.messages.filter((m) => m.type === "message");
  const byId = new Map(messages.map((m) => [m.id, m]));
  const { albumPhotos } = buildAlbumGroups(messages);

  const conn = await mysql.createConnection(env.DATABASE_URL);
  const [rows] = await conn.query(`
    SELECT p.id, p.instagramId, p.photos, p.tags,
      (SELECT COUNT(*) FROM post_media pm WHERE pm.postId = p.id AND pm.type = 'video') AS videoCount
    FROM posts p
    WHERE p.source = 'telegram'
  `);

  let updated = 0;
  let cleared = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    const msgId = Number(String(row.instagramId).replace("tg-", ""));
    const msg = byId.get(msgId);
    if (!msg) continue;

    const tags = typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags || [];
    if (ONLY && !tags.includes(ONLY)) continue;

    const currentPhotos =
      typeof row.photos === "string" ? JSON.parse(row.photos) : row.photos || [];
    const hasVideo = Number(row.videoCount) > 0;

    if (hasVideo) {
      const [mediaRows] = await conn.query(
        "SELECT filename FROM post_media WHERE postId = ? AND type = 'video' LIMIT 1",
        [row.id],
      );
      const videoName = mediaRows[0]?.filename;
      const expectedThumb = videoName ? `${videoName}_thumb.jpg` : null;
      let keepPhotos = expectedThumb
        ? currentPhotos.filter((url) => urlBasename(url) === expectedThumb)
        : [];

      if (expectedThumb && keepPhotos.length === 0 && videoFiles.has(expectedThumb)) {
        try {
          const diskPath = `/видео из клуба/${expectedThumb}`;
          const body = await getCachedOrDownload(diskPath);
          const url = await uploadS3(
            `club/tg/${msgId}/${expectedThumb}`,
            body,
            "image/jpeg",
          );
          keepPhotos = [url];
        } catch (error) {
          console.warn("thumb fail", row.instagramId, error.message);
        }
      }

      if (JSON.stringify(keepPhotos) !== JSON.stringify(currentPhotos)) {
        if (!DRY_RUN) {
          await conn.query("UPDATE posts SET photos = ? WHERE id = ?", [
            JSON.stringify(keepPhotos),
            row.id,
          ]);
        }
        console.log("video photos", row.instagramId, keepPhotos.length, "was", currentPhotos.length);
        updated += 1;
      }
      continue;
    }

    const expected = expectedPhotoNamesForPost(messages, msg, albumPhotos, diskPhotos);
    if (!expected.length) {
      skipped += 1;
      continue;
    }

    if (photosMatch(expected, currentPhotos)) {
      skipped += 1;
      continue;
    }

    const newPhotos = [];
    let ok = true;
    for (const name of expected) {
      if (!diskPhotos.has(name)) {
        ok = false;
        break;
      }
      try {
        const diskPath = `/фото из клуба/${name}`;
        const body = await getCachedOrDownload(diskPath);
        const url = await uploadS3(`club/tg/${msgId}/${name}`, body, guessContentType(name));
        newPhotos.push(url);
      } catch (error) {
        ok = false;
        errors += 1;
        console.error("fail", row.instagramId, name, error.message);
        break;
      }
    }

    if (!ok) {
      if (currentPhotos.length > 0 && !DRY_RUN) {
        await conn.query("UPDATE posts SET photos = ? WHERE id = ?", [JSON.stringify([]), row.id]);
        cleared += 1;
        console.log("cleared (missing on disk)", row.instagramId, expected.join(", "));
      }
      continue;
    }

    if (!DRY_RUN) {
      await conn.query("UPDATE posts SET photos = ? WHERE id = ?", [
        JSON.stringify(newPhotos),
        row.id,
      ]);
    }
    updated += 1;
    console.log("fixed", row.instagramId, newPhotos.length, expected.join(", "));
  }

  await conn.end();
  console.log(JSON.stringify({ updated, cleared, skipped, errors, dryRun: DRY_RUN }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
