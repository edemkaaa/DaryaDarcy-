import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
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

const sql = fs.readFileSync(
  path.join(root, "packages/database/drizzle/0007_password_hash.sql"),
  "utf8",
);
const conn = await mysql.createConnection(env.DATABASE_URL);
const [rows] = await conn.query("SHOW COLUMNS FROM users LIKE 'passwordHash'");
if (Array.isArray(rows) && rows.length > 0) {
  console.log("passwordHash already exists");
} else {
  await conn.query(sql);
  console.log("added passwordHash");
}
await conn.end();
