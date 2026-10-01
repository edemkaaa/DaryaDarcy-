import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = {};
for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

const html = await fetch("https://www.youtube.com/@daryadarcy/videos", {
  headers: {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "accept-language": "ru,en;q=0.9",
  },
}).then((r) => r.text());

const ytInitial = html.match(/ytInitialData\s*=\s*(\{.+?\});<\/script>/);
if (!ytInitial) {
  console.log("no ytInitialData", html.slice(0, 300));
  process.exit(1);
}
const ids = new Set();
for (const match of ytInitial[1].matchAll(/"videoId":"([A-Za-z0-9_-]{11})"/g)) {
  ids.add(match[1]);
}
console.log("page_ids", ids.size);

const conn = await mysql.createConnection(env.DATABASE_URL.replace(/\r/g, "").trim());
const [rows] = await conn.query("SELECT youtubeId FROM videos");
const existing = new Set(rows.map((r) => r.youtubeId));
const missing = [...ids].filter((id) => !existing.has(id));
console.log("db", existing.size, "missing_from_page", missing.length);
console.log(missing.slice(0, 20));
await conn.end();
