import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

/** One process-owned pool. App factories borrow it; only executable shutdown closes it. */
let _db: MySql2Database | null = null;

/** Shutdown only, after HTTP and workers have drained; never opens a connection. */
export async function closeDb(): Promise<void> {
  const database = _db;
  _db = null;
  if (database)
    await (database as MySql2Database & { $client: mysql.Pool }).$client.end();
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL?.replace(/\r/g, "").trim();
  if (!url) return null;
  try {
    const pool = mysql.createPool({
      uri: url,
      charset: "utf8mb4_unicode_ci",
      timezone: "Z",
      connectionLimit: 10,
    });
    pool.on("connection", (connection) => {
      // mysql2 queues this before the first command on each new connection.
      // PromisePool forwards the raw callback connection event, despite its Promise typings.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      connection.query("SET time_zone = '+00:00'");
    });
    _db = drizzle({ client: pool });
  } catch (error) {
    console.warn("[Database] Failed to connect");
    _db = null;
  }
  return _db;
}
