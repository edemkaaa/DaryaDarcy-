/** Опасная maintenance-операция допускается только на канонической одноразовой локальной БД; сам SQL запрещён spy. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { maintainPrivateRecovery } from "../apps/backend/src/content/private-recovery-maintenance";

// No SQL or storage connection exists. An admitted candidate would fail here;
// these tests require rejection before the first database/storage operation.
const sql = vi.fn(() => {
  throw new Error("Unexpected SQL admission");
});
const database = { select: sql } as unknown as MySql2Database;
/** Включаем три тестовых флага и локальный backend_test, сбрасывая счётчик недопустимого SQL. */
beforeEach(() => {
  sql.mockClear();
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("DATABASE_URL", "mysql://fixture:fixture@127.0.0.1/backend_test");
  vi.stubEnv("CONTENT_RECOVERY_RETENTION_ENABLED", "true");
  vi.stubEnv("CONTENT_RECOVERY_MAINTENANCE_ENABLED", "true");
  vi.stubEnv("PRIVATE_ORPHAN_CLEANUP_ENABLED", "true");
});
/** Возвращаем окружение после каждой проверки guard. */
afterEach(() => vi.unstubAllEnvs());

/** Параметры драйвера, fragment, другой host/schema и CI-service URL запрещены этому локальному maintenance-пути. */
it.each([
  "mysql://fixture:fixture@127.0.0.1/backend_test?socketPath=/tmp/other-mysql.sock",
  "mysql://fixture:fixture@127.0.0.1/backend_test?%73ocketPath=%2Ftmp%2Fother-mysql.sock",
  "mysql://fixture:fixture@127.0.0.1/backend_test?socketPath=%22%2Ftmp%2Fother-mysql.sock%22",
  "mysql://fixture:fixture@127.0.0.1/backend_test?multipleStatements=true",
  "mysql://fixture:fixture@127.0.0.1/backend_test#other-database",
  "mysql://fixture:fixture@127.0.0.1/working_database",
  "mysql://fixture:fixture@external.example.test/backend_test",
  "mysql://fixture:fixture@backend-mysql/backend_test",
])("refuses a noncanonical local fixture before SQL: %s", async (uri) => {
  vi.stubEnv("DATABASE_URL", uri);
  await expect(maintainPrivateRecovery(database)).rejects.toThrow(
    "Only disposable local recovery maintenance",
  );
  expect(sql).not.toHaveBeenCalled();
});

/** Production не становится безопасным только от имени backend_test. */
it("does not permit maintenance in production even with a localhost test URI", async () => {
  vi.stubEnv("NODE_ENV", "production");
  await expect(maintainPrivateRecovery(database)).rejects.toThrow(
    "Only disposable local recovery maintenance",
  );
  expect(sql).not.toHaveBeenCalled();
});

/** Выключенная retention/maintenance возвращает нулевой отчёт до первого побочного действия. */
it.each([
  "CONTENT_RECOVERY_RETENTION_ENABLED",
  "CONTENT_RECOVERY_MAINTENANCE_ENABLED",
])("does nothing when %s is disabled, without SQL or storage", async (flag) => {
  vi.stubEnv(flag, "false");
  await expect(maintainPrivateRecovery(database)).resolves.toEqual({
    compacted: 0,
    observed: 0,
    deleted: 0,
    failed: 0,
    nextCursor: null,
  });
  expect(sql).not.toHaveBeenCalled();
});
