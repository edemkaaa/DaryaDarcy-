// Историческая операция объединяет конкретные сообщения с фото и документом в один пост. Не использовать её как универсальный merge любых публикаций.
/**
 * Merge tg-2695 + tg-2696 (photos) + tg-2697 (билеты.docx) into one exclusive post.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

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

const ANCHOR = "tg-2695";
const PHOTO_SIBLING = "tg-2696";
const DOC_SIBLING = "tg-2697";
const DRY_RUN = process.argv.includes("--dry-run");

function parseJson(value) {
  // Разбирает старое JSON-поле; некорректное значение трактуется как пустой список.

  if (!value) return [];
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }
  return value;
}

function urlBasename(url) {
  // Сравнивает имя последнего сегмента URL без параметров; это сопоставление имени, а не проверка байтов.

  return decodeURIComponent(String(url).split("/").pop()?.split("?")[0] || "");
}

async function main() {
  // Объединяет только заранее выбранные сообщения 2695–2697 и удаляет два дубля; это одноразовый сценарий, не универсальная очистка.

  const conn = await mysql.createConnection(env.DATABASE_URL);

  const [rows] = await conn.query(
    "SELECT id, instagramId, photos FROM posts WHERE instagramId IN (?, ?, ?)",
    [ANCHOR, PHOTO_SIBLING, DOC_SIBLING],
  );

  const byTg = new Map(rows.map((row) => [row.instagramId, row]));
  const anchor = byTg.get(ANCHOR);
  const photoSibling = byTg.get(PHOTO_SIBLING);
  const docSibling = byTg.get(DOC_SIBLING);

  if (!anchor) {
    throw new Error(`Anchor post ${ANCHOR} not found`);
  }

  const anchorPhotos = parseJson(anchor.photos);
  const siblingPhotos = photoSibling ? parseJson(photoSibling.photos) : [];
  const mergedPhotos = [...anchorPhotos];
  const seen = new Set(anchorPhotos.map(urlBasename));
  for (const url of siblingPhotos) {
    const base = urlBasename(url);
    if (!seen.has(base)) {
      mergedPhotos.push(url);
      seen.add(base);
    }
  }

  const [anchorMedia] = await conn.query(
    "SELECT id, type, url, filename, mimeType, duration, sortOrder FROM post_media WHERE postId = ? ORDER BY sortOrder",
    [anchor.id],
  );
  const [docMedia] = docSibling
    ? await conn.query(
        "SELECT id, type, url, filename, mimeType, duration, sortOrder FROM post_media WHERE postId = ? ORDER BY sortOrder",
        [docSibling.id],
      )
    : [[]];

  console.log(
    JSON.stringify(
      {
        anchor: ANCHOR,
        photosBefore: anchorPhotos.length,
        photosAfter: mergedPhotos.length,
        mediaBefore: anchorMedia.length,
        mediaToMove: docMedia.length,
        dryRun: DRY_RUN,
      },
      null,
      2,
    ),
  );

  if (!DRY_RUN) {
    await conn.query("UPDATE posts SET photos = ? WHERE id = ?", [
      JSON.stringify(mergedPhotos),
      anchor.id,
    ]);

    for (const item of docMedia) {
      await conn.query(
        "UPDATE post_media SET postId = ?, sortOrder = ? WHERE id = ?",
        [anchor.id, anchorMedia.length + item.sortOrder, item.id],
      );
    }

    if (photoSibling) {
      await conn.query("DELETE FROM posts WHERE id = ?", [photoSibling.id]);
    }
    if (docSibling) {
      await conn.query("DELETE FROM posts WHERE id = ?", [docSibling.id]);
    }
  }

  await conn.end();
  console.log("done");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
