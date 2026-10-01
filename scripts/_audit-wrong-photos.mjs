import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { buildAlbumGroups } from "../lib/telegram-albums.mjs";

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

const RESULT_JSON = process.env.TG_RESULT_JSON || "C:/Users/Иван/Downloads/result 2.json";

function expectedPhotoName(msg) {
  const d = new Date(Number(msg.date_unixtime) * 1000);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `photo_${msg.id}@${dd}-${mm}-${yyyy}_${hh}-${mi}-${ss}.jpg`;
}

function urlBasename(url) {
  return decodeURIComponent(url.split("/").pop()?.split("?")[0] || "");
}

const data = JSON.parse(fs.readFileSync(RESULT_JSON, "utf8"));
const byId = new Map(data.messages.map((m) => [m.id, m]));
const { albumPhotos } = buildAlbumGroups(data.messages);

const conn = await mysql.createConnection(env.DATABASE_URL);
const [rows] = await conn.query(
  "SELECT id, instagramId, photos, tags FROM posts WHERE source = 'telegram' AND JSON_LENGTH(photos) > 0",
);

let wrong = 0;
let communityWrong = 0;
const samples = [];

for (const row of rows) {
  const msgId = Number(String(row.instagramId).replace("tg-", ""));
  const msg = byId.get(msgId);
  if (!msg) continue;

  const photos = typeof row.photos === "string" ? JSON.parse(row.photos) : row.photos;
  const tags = typeof row.tags === "string" ? JSON.parse(row.tags) : row.tags || [];
  const album = albumPhotos.get(msgId);

  const expectedNames = album?.length
    ? album.map((_, i) => {
        const albumMsgs = data.messages
          .filter((m) => m.date_unixtime === msg.date_unixtime && m.photo)
          .sort((a, b) => a.id - b.id);
        return expectedPhotoName(albumMsgs[i] || msg);
      })
    : [expectedPhotoName(msg)];

  let postWrong = false;
  for (let i = 0; i < photos.length; i++) {
    const base = urlBasename(photos[i]);
    if (!base.startsWith("photo_")) continue;
    const expected = expectedNames[i] || expectedNames[0];
    if (base !== expected) {
      postWrong = true;
      if (samples.length < 20) {
        samples.push({ id: row.instagramId, index: i, expected, got: base, tags });
      }
      break;
    }
  }

  if (postWrong) {
    wrong += 1;
    if (tags.includes("community")) communityWrong += 1;
  }
}

await conn.end();
console.log(JSON.stringify({ totalWithPhotos: rows.length, wrong, communityWrong, samples }, null, 2));
