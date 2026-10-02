import fs from "node:fs";
import mysql from "mysql2/promise";

const env = {};
for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

const conn = await mysql.createConnection(env.DATABASE_URL.trim());
const [cols] = await conn.query("SHOW COLUMNS FROM posts LIKE 'publishedAt'");
console.log("column:", cols.length ? "ok" : "MISSING");
const [rows] = await conn.query(
  "SELECT id, LEFT(text, 40) AS t, status, target, publishedAt, createdAt FROM posts ORDER BY COALESCE(publishedAt, createdAt) DESC LIMIT 8",
);
for (const r of rows) {
  console.log(
    `#${r.id} | ${r.status} | ${r.target} | pub=${r.publishedAt?.toISOString?.() ?? r.publishedAt} | created=${r.createdAt?.toISOString?.() ?? r.createdAt} | ${r.t}`,
  );
}
await conn.end();
