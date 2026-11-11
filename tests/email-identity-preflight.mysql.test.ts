import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { readFile } from "node:fs/promises";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import {
  inspectEmailIdentityData,
  readEmailIdentityIssues,
} from "../tooling/scripts/email-identity-preflight";

/** Проверяет read-only диагностику legacy-email без исправления строк и раскрытия адресов в отчёте. */
describe.skipIf(!testDatabaseUrl)("email preflight on disposable MySQL", () => {
  let conn: Connection;
  /** Создаёт временную users только для данного соединения, сохраняя каноническую таблицу фикстуры. */
  beforeAll(async () => {
    conn = await openTestDatabase();
    // Connection-local legacy data: no changes to the real fixture users.
    await conn.query(
      "CREATE TEMPORARY TABLE users (id INT PRIMARY KEY,email VARCHAR(320))",
    );
  });
  /** Очищает временную таблицу перед новым набором legacy-адресов. */
  beforeEach(async () => {
    await conn.query("DELETE FROM users");
  });
  /** Закрывает соединение вместе с его временной таблицей. */
  afterAll(async () => {
    await conn?.end();
  });
  /** Выполняет preflight внутри read-only транзакции и завершает её rollback независимо от результата. */
  async function inspect() {
    await conn.query("START TRANSACTION READ ONLY");
    try {
      return await inspectEmailIdentityData(conn);
    } finally {
      await conn.rollback();
    }
  }
  /** Несколько NULL и пустых email допустимы и не создают диагностик персональных данных. */
  it("accepts multiple absent emails and reports no personal data", async () => {
    await conn.query(
      "INSERT INTO users VALUES (1,NULL),(2,NULL),(3,''),(4,''),(5,'member@example.test')",
    );
    expect(await inspect()).toEqual([]);
  });
  /** Варианты регистра и пробелов обнаруживаются как неканоничные дубли без переписывания аккаунтов. */
  it("rejects normalized duplicates and noncanonical data without changing any row", async () => {
    await conn.query(
      "INSERT INTO users VALUES (1,'member@example.test'),(2,'  MEMBER@EXAMPLE.TEST  ')",
    );
    const [before] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM users ORDER BY id",
    );
    expect(await inspect()).toEqual([
      "email-identity-noncanonical",
      "email-identity-duplicates",
    ]);
    const [after] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM users ORDER BY id",
    );
    expect(after).toEqual(before);
  });
  /** Диагностика проходит все страницы, включая проблемный адрес после границы 500 строк. */
  it("inspects every page, including an incompatible address after row 500", async () => {
    const values = Array.from({ length: 501 }, (_, i) => [
      i + 1,
      i === 500 ? "\tmember@example.test" : null,
    ]);
    await conn.query("INSERT INTO users (id,email) VALUES ?", [values]);
    expect(await inspect()).toEqual(["email-identity-noncanonical"]);
  });
  /** Preflight не пропускает legacy-строки с отрицательными ID. */
  it("also checks legacy rows with nonpositive IDs", async () => {
    await conn.query("INSERT INTO users VALUES (-1,' MEMBER@EXAMPLE.TEST ') ");
    expect(await inspect()).toEqual(["email-identity-noncanonical"]);
  });
  /** Публичный preflight открывает реальное read-only соединение и принимает каноническую схему. */
  it("opens a real read-only inspection connection for the canonical fixture", async () => {
    expect(await readEmailIdentityIssues(testDatabaseUrl!)).toEqual([]);
  });
  /** Некорректный адрес отмечается диагностикой invalid и сохраняется без изменений. */
  it("rejects malformed legacy email without rewriting the account", async () => {
    await conn.query("INSERT INTO users VALUES (1,'not-an-email')");
    expect(await inspect()).toEqual(["email-identity-invalid"]);
    const [rows] = await conn.query<RowDataPacket[]>("SELECT * FROM users");
    expect(rows).toEqual([{ id: 1, email: "not-an-email" }]);
  });
});

/** Проверяет точный SQL миграции уникального email на отдельной legacy-таблице, не трогая ограничения основной users. */
describe.skipIf(!testDatabaseUrl)(
  "unique email migration on disposable legacy data",
  () => {
    let conn: Connection;
    let migration: string;
    /** Создаёт собственную именованную таблицу и подставляет её имя в прочитанный SQL миграции. */
    beforeAll(async () => {
      conn = await openTestDatabase();
      // Named table belongs only to this run; exercise the exact migration on
      // legacy data without dropping the canonical fixture's constraint.
      await conn.query(
        "CREATE TABLE email_identity_migration_fixture (id INT PRIMARY KEY,email VARCHAR(320))",
      );
      migration = (
        await readFile(
          new URL(
            "../packages/database/drizzle/0027_user_email_identity.sql",
            import.meta.url,
          ),
          "utf8",
        )
      ).replace("`users`", "`email_identity_migration_fixture`");
    });
    /** Удаляет только таблицу эксперимента миграции и закрывает соединение. */
    afterAll(async () => {
      if (conn) {
        await conn.query("DROP TABLE email_identity_migration_fixture");
        await conn.end();
      }
    });
    /** При нормализованных дублях миграция отклоняется атомарно: строки прежние, уникальный индекс не создан. */
    it("fails atomically on duplicates instead of repairing or deleting old accounts", async () => {
      await conn.query(
        "INSERT INTO email_identity_migration_fixture VALUES (1,'member@example.test'),(2,' MEMBER@EXAMPLE.TEST ')",
      );
      const [before] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM email_identity_migration_fixture ORDER BY id",
      );
      await expect(conn.query(migration)).rejects.toMatchObject({
        code: "ER_DUP_ENTRY",
      });
      const [after] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM email_identity_migration_fixture ORDER BY id",
      );
      expect(after).toEqual(before);
      const [indexes] = await conn.query<RowDataPacket[]>(
        "SHOW INDEX FROM email_identity_migration_fixture WHERE Key_name='users_email_identity_unique'",
      );
      expect(indexes).toEqual([]);
    });
  },
);
