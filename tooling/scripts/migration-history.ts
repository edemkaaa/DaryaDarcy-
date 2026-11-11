// Читает историю миграций и наличие индекса через ограниченное соединение. Проверка истории отделена от применения DDL.
import mysql, { type Connection } from "mysql2/promise";

async function withReadOnlyConnection<T>(
  uri: string,
  read: (conn: Connection) => Promise<T>,
) {
  // Ограничивает время подключения, открывает read-only транзакцию и закрывает её rollback независимо от результата проверки.

  const url = new URL(uri);
  if (url.protocol !== "mysql:" || !url.pathname || url.pathname === "/")
    throw new Error("Invalid preflight connection");
  const conn = await mysql.createConnection({ uri, connectTimeout: 5000 });
  try {
    await conn.query("START TRANSACTION READ ONLY");
    return await read(conn);
  } finally {
    try {
      await conn.rollback();
    } finally {
      await conn.end();
    }
  }
}

/** Fixed metadata queries only; no creation of Drizzle's migration table. */
export async function readMigrationHistory(uri: string) {
  // Читает только существующую служебную историю с ограничением строк, не создавая таблицу при её отсутствии.

  return withReadOnlyConnection(uri, async (conn) => {
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
  });
}

export async function readFeedListingIndexAvailable(uri: string) {
  // Проверяет видимость нужного индекса, поскольку FORCE INDEX не принимает отсутствующий или invisible индекс.

  return withReadOnlyConnection(uri, async (conn) => {
    // MySQL rejects FORCE INDEX for a missing or invisible index.
    const [rows] = await conn.query<mysql.RowDataPacket[]>({
      sql: "SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='posts' AND INDEX_NAME='posts_feed_listing_idx' AND IS_VISIBLE='YES' LIMIT 1",
      timeout: 10000,
    });
    return rows.length > 0;
  });
}
