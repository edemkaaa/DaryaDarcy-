import fs from "node:fs";
import mysql from "mysql2/promise";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const conn = await mysql.createConnection(env.DATABASE_URL);
const [rows] = await conn.query(`
  SELECT id, instagramId, target, tags, photos
  FROM posts
  WHERE published = 1
    AND (target = 'feed' OR target = 'both')
    AND (
      LOWER(CAST(photos AS CHAR)) LIKE '%.mp4%'
      OR LOWER(CAST(photos AS CHAR)) LIKE '%.mov%'
      OR LOWER(CAST(photos AS CHAR)) LIKE '%.m4v%'
      OR JSON_CONTAINS(tags, '"video"')
    )
  LIMIT 15
`);
for (const row of rows) {
  const photos = typeof row.photos === "string" ? JSON.parse(row.photos) : row.photos;
  console.log(row.id, row.instagramId, row.target, row.tags, photos?.slice?.(0, 2));
}
console.log("count", rows.length);
await conn.end();
