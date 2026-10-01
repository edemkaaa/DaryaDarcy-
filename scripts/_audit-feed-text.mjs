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
    }),
);

const conn = await mysql.createConnection(env.DATABASE_URL);
const [empty] = await conn.query(
  "SELECT COUNT(*) AS c FROM posts WHERE published = 1 AND target IN ('feed', 'both') AND (text IS NULL OR text = '')",
);
const [withText] = await conn.query(
  "SELECT COUNT(*) AS c FROM posts WHERE published = 1 AND target IN ('feed', 'both') AND text IS NOT NULL AND text != ''",
);
const [recent] = await conn.query(
  "SELECT id, source, instagramId, CHAR_LENGTH(COALESCE(text, '')) AS len FROM posts WHERE published = 1 AND target IN ('feed', 'both') ORDER BY sortOrder LIMIT 20",
);
console.log("empty", empty[0].c, "withText", withText[0].c);
for (const r of recent) {
  console.log(r.id, r.source, r.instagramId, "len", r.len);
}
await conn.end();
