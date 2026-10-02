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

const conn = await mysql.createConnection(env.DATABASE_URL.replace(/\r/g, "").trim());

async function run(label, sql) {
  try {
    await conn.query(sql);
    console.log("ok:", label);
  } catch (error) {
    const message = String(error?.message || error);
    if (message.includes("Duplicate column") || message.includes("already exists")) {
      console.log("skip:", label);
      return;
    }
    throw error;
  }
}

await run("posts.publishedAt", "ALTER TABLE `posts` ADD COLUMN `publishedAt` timestamp NULL");
await run("posts.publishedAt.backfill", "UPDATE `posts` SET `publishedAt` = `createdAt` WHERE `publishedAt` IS NULL");

await conn.end();
console.log("done");
