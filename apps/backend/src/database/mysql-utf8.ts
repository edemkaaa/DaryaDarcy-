import type { Connection } from "mysql2/promise";

/** Ensure 4-byte UTF-8 (emoji) survives reads/writes. */
export async function ensureUtf8Mb4(conn: Connection) {
  await conn.query("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci");
}
