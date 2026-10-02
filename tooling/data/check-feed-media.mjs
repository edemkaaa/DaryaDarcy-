import fs from "fs";
import mysql from "mysql2/promise";

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const conn = await mysql.createConnection(env.DATABASE_URL);
const [manyPhotos] = await conn.query(
  "SELECT id, JSON_LENGTH(photos) AS n FROM posts WHERE published = 1 AND target IN ('feed', 'both') AND JSON_LENGTH(photos) > 9 ORDER BY JSON_LENGTH(photos) DESC LIMIT 15"
);
console.log("Posts with 10+ photos:", manyPhotos.length);
for (const r of manyPhotos) console.log(" ", r.id, r.n);

const [videoPosts] = await conn.query(
  "SELECT COUNT(*) AS c FROM posts p JOIN post_media pm ON pm.postId = p.id WHERE p.published = 1 AND p.target IN ('feed', 'both') AND pm.type = 'video'"
);
console.log("Video posts in feed:", videoPosts[0].c);

const [firstPage] = await conn.query(
  "SELECT p.id, JSON_LENGTH(p.photos) AS photoCount, (SELECT COUNT(*) FROM post_media pm WHERE pm.postId = p.id AND pm.type = 'video') AS hasVideo FROM posts p WHERE p.published = 1 AND p.target IN ('feed', 'both') ORDER BY p.sortOrder LIMIT 12"
);
console.log("First page posts:");
for (const r of firstPage) console.log(" ", r.id, "photos", r.photoCount, "video", r.hasVideo);

await conn.end();
