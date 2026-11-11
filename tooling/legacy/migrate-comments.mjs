// Создаёт прежнюю схему комментариев из SQL-файла без актуального preflight.
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

const sql = fs.readFileSync(path.join(root, "drizzle", "0011_post_comments.sql"), "utf8");
// С этого места выбранная БД реально изменяется; текущая история и рабочее назначение автоматически не проверены.
const conn = await mysql.createConnection(env.DATABASE_URL.replace(/\r/g, "").trim());
await conn.query(sql);
console.log("post_comments table ready");
await conn.end();
