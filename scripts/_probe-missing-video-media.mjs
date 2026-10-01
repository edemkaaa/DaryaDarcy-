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
  SELECT p.id, p.instagramId, p.photos, p.tags
  FROM posts p
  LEFT JOIN post_media m ON m.postId = p.id AND m.type = 'video'
  WHERE p.published = 1
    AND JSON_CONTAINS(p.tags, '"video"')
    AND m.id IS NULL
`);
for (const row of rows) {
  const photos = typeof row.photos === "string" ? JSON.parse(row.photos) : row.photos;
  console.log(row.id, row.instagramId, photos?.length, photos?.[0]?.slice?.(0, 80));
}
await conn.end();
