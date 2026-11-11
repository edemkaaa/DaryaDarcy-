// Объединяет соседние фото Telegram-серии с опорным постом. Применение изменяет записи и требует сверки конкретной группы сообщений.
/**
 * Merge photo-only sibling messages (same TG burst) into the anchor post with text/video.
 * Example: tg-3005 video + tg-3006/3007 album photos → one post.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { buildAlbumGroups, plainText } from "../../apps/frontend/lib/telegram-albums.mjs";

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
  return names;
}

async function yandexDownload(diskPath) {
  // Запрашивает временную ссылку скачивания конкретного файла публичного Диска.

  const url =
    "https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=" +
    encodeURIComponent(YANDEX_PUBLIC) +
    "&path=" +
    encodeURIComponent(diskPath);
  const meta = await fetch(url).then((r) => r.json());
  if (!meta.href) throw new Error(`Missing: ${diskPath}`);
  const res = await fetch(meta.href);
  if (!res.ok) throw new Error(`Download failed: ${diskPath}`);
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

async function uploadS3(key, body) {
  // Историческая загрузка создаёт публичный объект public-read; не использовать как замену нынешнему защищённому переносу.

  if (DRY_RUN) return S3_PUBLIC + key;
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

function resolveBurstPhotoNames(diskPhotos, msg, albumCount) {
  // Подбирает фотографии короткой серии по именам и дате; результат требует сверки количества оператором.

  const suffix = dateSuffix(msg);
  const matches = diskPhotos
    .filter((name) => name.startsWith("photo_") && name.includes(suffix))
    .sort((a, b) => {
      const idA = Number(a.match(/^photo_(\d+)@/)?.[1] || 0);
      const idB = Number(b.match(/^photo_(\d+)@/)?.[1] || 0);
      return idA - idB;
    });
  if (matches.length === albumCount || (albumCount === 1 && matches.length === 1)) return matches;
  return matches;
}

function urlBasename(url) {
  // Сравнивает имя последнего сегмента URL без параметров; это сопоставление имени, а не проверка байтов.

  return decodeURIComponent(url.split("/").pop()?.split("?")[0] || "");
}

async function main() {
  // Объединяет фото сообщений в пределах пяти секунд вокруг текстового поста; SQL-запись отключается только явным dry-run.

  const diskPhotos = await listDiskFiles("/фото из клуба");
  const data = JSON.parse(fs.readFileSync(RESULT_JSON, "utf8"));
  const messages = data.messages.filter((m) => m.type === "message");
  const byId = new Map(messages.map((m) => [m.id, m]));
  const { albumPhotos, absorbedBy } = buildAlbumGroups(messages);

  const conn = await mysql.createConnection(env.DATABASE_URL);
  const [rows] = await conn.query(
    "SELECT id, instagramId, photos FROM posts WHERE source = 'telegram'",
  );

  let updated = 0;

  for (const row of rows) {
    const anchorId = Number(String(row.instagramId).replace("tg-", ""));
    const anchor = byId.get(anchorId);
    if (!anchor || !plainText(anchor)) continue;

    const burstWindow = 5;
    const anchorTime = Number(anchor.date_unixtime);
    const siblings = messages.filter((m) => {
      if (m.id === anchorId) return false;
      const dt = Math.abs(Number(m.date_unixtime) - anchorTime);
      return dt <= burstWindow && m.photo && !plainText(m) && !m.file_name;
    });

    if (!siblings.length) continue;

    const photoNames = [];
    for (const sib of siblings.sort((a, b) => a.id - b.id)) {
      const albumLen = albumPhotos.get(sib.id)?.length || 1;
      photoNames.push(...resolveBurstPhotoNames(diskPhotos, sib, albumLen));
    }

    const uniqueNames = [...new Set(photoNames)];
    if (!uniqueNames.length) continue;

    const current =
      typeof row.photos === "string" ? JSON.parse(row.photos) : row.photos || [];
    const currentNames = new Set(current.map(urlBasename));
    const missing = uniqueNames.filter((n) => !currentNames.has(n));
    if (!missing.length) continue;

    const newPhotos = [...current];
    for (const name of missing) {
      try {
        const body = await getCachedOrDownload(`/фото из клуба/${name}`);
        const url = await uploadS3(`club/tg/${anchorId}/${name}`, body);
        newPhotos.push(url);
      } catch (error) {
        console.warn("skip", row.instagramId, name, error.message);
      }
    }

    if (newPhotos.length === current.length) continue;

    if (!DRY_RUN) {
      await conn.query("UPDATE posts SET photos = ? WHERE id = ?", [
        JSON.stringify(newPhotos),
        row.id,
      ]);
    }
    updated += 1;
    console.log(
      row.instagramId,
      "photos",
      current.length,
      "->",
      newPhotos.length,
      missing.join(", "),
    );
  }

  await conn.end();
  console.log(JSON.stringify({ updated, dryRun: DRY_RUN }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
