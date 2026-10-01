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
const [[counts]] = await conn.query(
  "SELECT COUNT(*) AS c FROM post_media WHERE type = 'video'",
);
const [club] = await conn.query(`
  SELECT p.id, p.instagramId, p.target, m.url
  FROM posts p
  JOIN post_media m ON m.postId = p.id AND m.type = 'video'
  LIMIT 10
`);
const [feedVideoTag] = await conn.query(`
  SELECT p.id, p.instagramId, p.target, p.tags,
    (SELECT COUNT(*) FROM post_media m WHERE m.postId = p.id AND m.type = 'video') AS vc
  FROM posts p
  WHERE p.published = 1
    AND (p.target = 'feed' OR p.target = 'both')
    AND JSON_CONTAINS(p.tags, '"video"')
  LIMIT 10
`);
console.log("video post_media count:", counts.c);
console.log("all video media samples:", club);
console.log("feed with video tag:", feedVideoTag);
await conn.end();
