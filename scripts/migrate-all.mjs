import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const journal = JSON.parse(
  fs.readFileSync(path.join(root, "drizzle/meta/_journal.json"), "utf8"),
);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const conn = await mysql.createConnection(url);
for (const entry of journal.entries) {
  const file = path.join(root, "drizzle", `${entry.tag}.sql`);
  const sql = fs.readFileSync(file, "utf8");
  console.log("apply", entry.tag);
  for (const statement of sql.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (!trimmed) continue;
    try {
      await conn.query(trimmed);
    } catch (error) {
      const msg = String(error?.message || error);
      if (
        msg.includes("Duplicate column") ||
        msg.includes("Duplicate key name") ||
        msg.includes("already exists") ||
        msg.includes("Duplicate entry")
      ) {
        console.log("  skip:", msg.split("\n")[0]);
        continue;
      }
      throw error;
    }
  }
}

const tables = ["users", "posts", "tags", "videos", "post_media"];
for (const table of tables) {
  try {
    const [[row]] = await conn.query(`SELECT COUNT(*) AS c FROM \`${table}\``);
    console.log(table, row.c);
  } catch {
    console.log(table, "missing");
  }
}
await conn.end();
console.log("done");
