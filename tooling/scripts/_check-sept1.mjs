import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
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

const data = JSON.parse(fs.readFileSync("C:/Users/Иван/Downloads/result 2.json", "utf8"));
const { albumPhotos } = buildAlbumGroups(data.messages);

const conn = await mysql.createConnection(env.DATABASE_URL);
const [rows] = await conn.query(
  "SELECT id, instagramId, photos, tags, publishedAt, text FROM posts WHERE source = 'telegram'",
);

for (const r of rows) {
  const tags = typeof r.tags === "string" ? JSON.parse(r.tags) : r.tags || [];
  if (!tags.includes("community")) continue;
  const d = r.publishedAt ? new Date(r.publishedAt) : null;
  if (!d || d.getFullYear() !== 2025 || d.getMonth() !== 8 || d.getDate() > 3) continue;
  const photos = typeof r.photos === "string" ? JSON.parse(r.photos) : r.photos || [];
  const msgId = Number(String(r.instagramId).replace("tg-", ""));
  const album = albumPhotos.get(msgId);
  const [media] = await conn.query(
    "SELECT type, filename FROM post_media WHERE postId = ?",
    [r.id],
  );
  console.log(
    JSON.stringify({
      id: r.instagramId,
      date: d.toISOString().slice(0, 10),
      photos: photos.length,
      albumExpected: album?.length || 0,
      media,
      text: String(r.text || "").slice(0, 80),
    }),
  );
}

await conn.end();
