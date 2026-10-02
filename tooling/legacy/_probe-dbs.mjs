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

const OLD_URL = env.DATABASE_URL;
const NEW_URL = env.NEW_DATABASE_URL;

if (!OLD_URL || !NEW_URL) {
  throw new Error("DATABASE_URL and NEW_DATABASE_URL are required");
}

async function probe(label, url) {
  try {
    const conn = await mysql.createConnection(url);
    const [tables] = await conn.query("SHOW TABLES");
    const names = tables.map((row) => Object.values(row)[0]);
    const counts = {};
    for (const name of names) {
      const [[row]] = await conn.query(`SELECT COUNT(*) AS c FROM \`${name}\``);
      counts[name] = row.c;
    }
    await conn.end();
    console.log(label, "OK", JSON.stringify({ tables: names.length, counts }));
    return { ok: true, names, counts };
  } catch (error) {
    console.log(label, "FAIL", error.message);
    return { ok: false };
  }
}

console.log("probing...");
await probe("OLD", OLD_URL);
await probe("NEW", NEW_URL);
