/**
 * Upgrade posts.text to utf8mb4 so emoji survive storage.
 * Usage: node tooling/legacy/migrate-posts-text-utf8mb4.mjs
 */
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

async function main() {
  const conn = await mysql.createConnection(env.DATABASE_URL);
  await conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
  const [before] = await conn.query(
    "SHOW FULL COLUMNS FROM posts WHERE Field IN ('text', 'richText')",
  );
  console.log("before", before.map((c) => `${c.Field}:${c.Collation}`).join(", "));
  await conn.query(
    "ALTER TABLE posts MODIFY text LONGTEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL",
  );
  await conn.query(
    "ALTER TABLE posts MODIFY richText JSON NULL",
  );
  const [after] = await conn.query(
    "SHOW FULL COLUMNS FROM posts WHERE Field IN ('text', 'richText')",
  );
  console.log("after", after.map((c) => `${c.Field}:${c.Collation}`).join(", "));
  await conn.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
