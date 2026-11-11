/** Ленивый пул MySQL одного процесса: общий для фабрик приложения и закрываемый только при shutdown. */
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

/** Пул принадлежит процессу: фабрики приложения используют его, но не владеют его завершением. */
let _db: MySql2Database | null = null;

/** Вызывается после завершения HTTP и worker; никогда не создаёт соединение ради закрытия. */
export async function closeDb(): Promise<void> {
  const database = _db;
  _db = null;
  if (database)
    await (database as MySql2Database & { $client: mysql.Pool }).$client.end();
}

// Ленивое создание позволяет импортировать локальные инструменты без обязательной БД.
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
      // Профиль двух API допускает проверенную короткую волну. Очередь остаётся
      // конечной: mysql2 не отменяет getConnection после таймаута вызывающего кода.
      waitForConnections: true,
      queueLimit: process.env.API_DB_BURST_QUEUE_ENABLED === "true" ? 40 : 10,
    });
    pool.on("connection", (connection) => {
      // mysql2 ставит установку UTC перед первой командой нового соединения.
      // Событие PromisePool всё ещё передаёт callback-версию connection, несмотря на типы.
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
