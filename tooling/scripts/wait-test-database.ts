// Ожидает доступность только разрешённого тестового MySQL перед CI-прогоном. Повторные подключения ограничены временем ожидания.
import mysql from "mysql2/promise";
import { setTimeout } from "node:timers/promises";
import { assertTestDatabase } from "./test-database-policy";

async function wait() {
  // Проверяет целевой тестовый URL до подключения и ограниченно повторяет SELECT 1, закрывая соединение каждой попытки.

  const uri = process.env.BACKEND_TEST_DATABASE_URL;
  if (!uri) throw new Error("BACKEND_TEST_DATABASE_URL required");
  assertTestDatabase(uri);
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    let connection;
    try {
      connection = await mysql.createConnection({ uri, connectTimeout: 1000 });
      await connection.query("SELECT 1");
      console.log("Disposable test database is ready");
      return;
    } catch { await setTimeout(500); }
    finally { await connection?.end(); }
  }
  throw new Error("Disposable test database readiness timed out");
}
void wait().catch(() => { console.error("Test database unavailable or unsafe configuration"); process.exitCode = 1; });
