// Обновляет локальный список роликов прежнего YouTube-канала через внешний загрузчик; не является синхронизацией VK.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const env = {};
for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

// Внешний yt-dlp получает старый YouTube-каталог; сетевое чтение выполняется ещё до подключения БД.
const listed = spawnSync(
  "python",
  ["-m", "yt_dlp", "--flat-playlist", "--playlist-end", "250", "--print", "%(id)s\t%(title)s\t%(duration_string)s", "https://www.youtube.com/@daryadarcy"],
  { encoding: "utf8" },
);
if (listed.status !== 0) {
  console.error(listed.stderr);
  process.exit(1);
}

const videos = listed.stdout
  .trim()
  .split(/\n/)
  .map((line) => {
    const [id, title, duration] = line.split("\t");
    return { id, title, duration: duration || null };
  })
  .filter((v) => v.id && v.title);

// Отсутствующие youtubeId далее вставляются опубликованными; это историческая запись, не текущая синхронизация VK.
const conn = await mysql.createConnection(env.DATABASE_URL.replace(/\r/g, "").trim());
const [rows] = await conn.query("SELECT youtubeId FROM videos");
const existing = new Set(rows.map((r) => r.youtubeId));
let imported = 0;
for (let i = 0; i < videos.length; i++) {
  const v = videos[i];
  if (existing.has(v.id)) continue;
  await conn.query(
    "INSERT INTO videos (youtubeId, title, duration, thumbnailUrl, sortOrder, published) VALUES (?, ?, ?, ?, ?, 1)",
    [v.id, v.title.slice(0, 512), v.duration, `https://daryadarcy.com/media/yt-thumb/${v.id}/hqdefault.jpg`, i],
  );
  imported += 1;
  console.log("imported", v.id, v.title);
}
const [count] = await conn.query("SELECT COUNT(*) AS n FROM videos");
console.log(JSON.stringify({ listed: videos.length, imported, total: count[0].n }));
await conn.end();
