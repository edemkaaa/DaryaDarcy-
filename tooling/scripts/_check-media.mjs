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

const conn = await mysql.createConnection(env.DATABASE_URL);
const [rows] = await conn.query(`
  SELECT p.id, p.instagramId, p.publishedAt,
    JSON_LENGTH(p.photos) AS photoCount,
    (SELECT COUNT(*) FROM post_media pm WHERE pm.postId = p.id) AS mediaCount,
    LEFT(p.text, 80) AS textPreview
  FROM posts p
  WHERE p.source = 'telegram'
  ORDER BY p.publishedAt DESC
  LIMIT 30
`);
console.log("=== recent posts ===");
for (const r of rows) {
  console.log(
    r.instagramId,
    "photos:",
    r.photoCount || 0,
    "media:",
    r.mediaCount || 0,
    "|",
    (r.textPreview || "(empty)").replace(/\n/g, " ").slice(0, 50),
  );
}

const [noPhoto] = await conn.query(`
  SELECT COUNT(*) AS n FROM posts
  WHERE source = 'telegram'
    AND (photos IS NULL OR photos = '[]' OR JSON_LENGTH(photos) = 0)
`);
const [withPhoto] = await conn.query(`
  SELECT COUNT(*) AS n FROM posts
  WHERE source = 'telegram' AND JSON_LENGTH(photos) > 0
`);
const [withMedia] = await conn.query(`
  SELECT COUNT(DISTINCT pm.postId) AS n
  FROM post_media pm JOIN posts p ON p.id = pm.postId
  WHERE p.source = 'telegram'
`);

const [recentBatch] = await conn.query(`
  SELECT instagramId, JSON_LENGTH(photos) AS photos, 
    (SELECT COUNT(*) FROM post_media pm WHERE pm.postId = p.id) AS media
  FROM posts p
  WHERE source = 'telegram' AND instagramId IN (
    'tg-473','tg-2697','tg-3063','tg-3158','tg-3440','tg-3306','tg-3085'
  )
`);

console.log("\n=== stats ===", { noPhoto: noPhoto[0].n, withPhoto: withPhoto[0].n, withMedia: withMedia[0].n });
console.log("\n=== sample batch ===", recentBatch);

await conn.end();
