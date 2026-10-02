import mysql from "mysql2/promise";

/** Fixed metadata queries only; no creation of Drizzle's migration table. */
export async function readMigrationHistory(uri: string) {
  const url = new URL(uri);
  if (url.protocol !== "mysql:" || !url.pathname || url.pathname === "/")
    throw new Error("Invalid preflight connection");
  const conn = await mysql.createConnection({ uri, connectTimeout: 5000 });
  try {
    await conn.query("START TRANSACTION READ ONLY");
    const [tables] = await conn.query<mysql.RowDataPacket[]>({
      sql: "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='__drizzle_migrations'",
      timeout: 10000,
    });
    if (!tables.length) return undefined;
    const [rows] = await conn.query<mysql.RowDataPacket[]>({
      sql: "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at, id LIMIT 10001",
      timeout: 10000,
    });
    if (rows.length > 10000)
      throw new Error("Preflight history limit exceeded");
    return rows.map((row) => ({
      hash: row.hash as unknown,
      created_at: row.created_at as unknown,
    }));
  } finally {
    try {
      await conn.rollback();
    } finally {
      await conn.end();
    }
  }
}
