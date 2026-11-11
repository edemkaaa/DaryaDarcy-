// Применяет прежние SQL-части Pen Pals последовательно; сам запуск не включает функцию и не проверяет её объектный доступ.
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

const sql = fs.readFileSync(path.join(root, "drizzle", "0008_pen_pals.sql"), "utf8");
const statements = sql
  .split("--> statement-breakpoint")
  .map((part) => part.trim())
  .filter(Boolean);

// С этого места выбранная БД реально изменяется; текущая история и рабочее назначение автоматически не проверены.
const conn = await mysql.createConnection(env.DATABASE_URL.replace(/\r/g, "").trim());
for (const statement of statements) {
  await conn.query(statement);
  console.log("ok", statement.slice(0, 60).replace(/\s+/g, " "));
}
await conn.end();
console.log("pen pal tables ready");
