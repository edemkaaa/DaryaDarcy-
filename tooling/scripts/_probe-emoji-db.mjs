import fs from "node:fs";
import mysql from "mysql2/promise";

const env = Object.fromEntries(
  fs
    .readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const conn = await mysql.createConnection(env.DATABASE_URL);
await conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
const json = JSON.parse(fs.readFileSync("ig_posts_processed.json", "utf8"));
const entry = json.find((p) => p.shortcode === "DZKpKPwl0-S");
await conn.query("UPDATE posts SET text = ? WHERE instagramId = ?", [
  entry.text.trim(),
  "DZKpKPwl0-S",
]);
const [rows] = await conn.query("SELECT text FROM posts WHERE instagramId = ?", [
  "DZKpKPwl0-S",
]);
console.log("json", JSON.stringify(entry.text.slice(40, 75)));
console.log("db", JSON.stringify(String(rows[0].text).slice(40, 75)));
const [cols] = await conn.query("SHOW FULL COLUMNS FROM posts WHERE Field = 'text'");
console.log("col", cols[0].Type, cols[0].Collation);
await conn.end();
