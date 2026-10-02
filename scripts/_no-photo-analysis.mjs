import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { isTaggedClubMessage } from "../apps/frontend/lib/telegram-post-tags.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
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

const FILE_NOT_INCLUDED = /not included/i;
const data = JSON.parse(fs.readFileSync("C:/Users/Иван/Downloads/result 2.json", "utf8"));
const byId = new Map(data.messages.filter((m) => m.type === "message").map((m) => [m.id, m]));

const conn = await mysql.createConnection(env.DATABASE_URL);
const [rows] = await conn.query(`
  SELECT id, instagramId, photos,
    (SELECT COUNT(*) FROM post_media pm WHERE pm.postId = posts.id) AS mediaCount
  FROM posts WHERE source = 'telegram'
    AND (photos IS NULL OR photos = '[]' OR JSON_LENGTH(photos) = 0)
  ORDER BY publishedAt DESC
`);
await conn.end();

let withPhotoInExport = 0;
let photoMissingInExport = 0;
const samples = [];

for (const row of rows) {
  const id = Number(String(row.instagramId).replace("tg-", ""));
  const msg = byId.get(id);
  if (!msg) continue;
  const photoMissing = !msg.photo || FILE_NOT_INCLUDED.test(String(msg.photo));
  if (photoMissing) photoMissingInExport++;
  else withPhotoInExport++;
  if (samples.length < 15) {
    samples.push({
      id,
      date: msg.date,
      photo: msg.photo,
      file_name: msg.file_name,
      media: msg.media_type,
      mediaCount: row.mediaCount,
    });
  }
}

console.log(
  JSON.stringify(
    {
      dbNoPhotoPosts: rows.length,
      exportPhotoPathMissing: photoMissingInExport,
      exportHasPhotoPath: withPhotoInExport,
      samples,
    },
    null,
    2,
  ),
);
