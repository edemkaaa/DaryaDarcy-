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

const CLUB_ONLY = ["discussion", "books", "photomarathon", "letter", "podcast", "guide", "backstage"];
const apply = process.argv.includes("--apply");

const conn = await mysql.createConnection(env.DATABASE_URL.replace(/\r/g, "").trim());
const [counts] = await conn.query(
  "SELECT target, COUNT(*) AS n FROM posts GROUP BY target",
);
console.log("by_target", counts);

const [rows] = await conn.query(
  "SELECT id, target, published, status, source, LEFT(text, 80) AS preview, tags FROM posts ORDER BY id DESC LIMIT 80",
);
const leaky = [];
for (const row of rows) {
  let tags = row.tags;
  if (typeof tags === "string") {
    try {
      tags = JSON.parse(tags);
    } catch {
      tags = [];
    }
  }
  const list = Array.isArray(tags) ? tags : [];
  const hasClubTag = list.some((t) => CLUB_ONLY.includes(String(t)));
  if (hasClubTag && row.target !== "club") leaky.push({ id: row.id, target: row.target, tags: list, preview: row.preview });
}
console.log("recent", rows.length, "club_tagged_not_club", leaky.length);
for (const item of leaky.slice(0, 20)) console.log(item);

if (apply && leaky.length) {
  const ids = leaky.map((p) => p.id);
  await conn.query("UPDATE posts SET target = 'club' WHERE id IN (?)", [ids]);
  console.log("updated", ids);
}

await conn.end();
