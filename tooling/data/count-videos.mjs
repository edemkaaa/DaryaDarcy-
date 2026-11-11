// Считает строки videos в выбранной БД и показывает пример старых youtubeId; такой отчёт не подтверждает опубликованный каталог или запуск плееров.
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

// Счётчик и пример читаются из таблицы videos выбранной БД; это не проверка локального JSON или воспроизведения.
const conn = await mysql.createConnection(env.DATABASE_URL.replace(/\r/g, "").trim());
const [rows] = await conn.query("SELECT COUNT(*) AS n FROM videos");
const [sample] = await conn.query("SELECT id, youtubeId, title FROM videos ORDER BY sortOrder ASC LIMIT 3");
console.log(JSON.stringify({ count: rows, sample }, null, 2));
await conn.end();
