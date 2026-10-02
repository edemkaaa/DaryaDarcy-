import "dotenv/config";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("NO_DATABASE_URL");
    process.exit(1);
  }
  console.log("url_len", url.length);
  console.log("has_tidb", url.includes("tidbcloud.com"));
  console.log("has_ssl", url.includes("ssl="));
  try {
    const conn = await mysql.createConnection(url);
    const [tables] = await conn.query("SHOW TABLES");
    const names = tables.map((row) => Object.values(row)[0]);
    console.log("tables", names.length, names.includes("tags") ? "has_tags" : "NO_tags");
    const [count] = await conn.query("SELECT COUNT(*) AS c FROM tags");
    console.log("tags_count", count[0].c);
    await conn.end();
  } catch (err) {
    console.log("MYSQL_CODE", err.code || "");
    console.log("MYSQL_MSG", err.message || String(err));
  }
  try {
    const db = drizzle(url);
    const result = await db.execute(sql`select count(*) as c from tags`);
    console.log("drizzle_ok");
  } catch (err) {
    console.log("DRIZZLE_MSG", err.message || String(err));
    console.log("DRIZZLE_CAUSE", err.cause?.code || "", err.cause?.message || String(err.cause || ""));
    process.exit(1);
  }
}

main();
