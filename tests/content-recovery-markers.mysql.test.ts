import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";

/** Проверяет минимальную схему долговечного маркера без сохранения payload или результата операции. */
describe.skipIf(!testDatabaseUrl)("content recovery marker schema", () => {
  let conn: Connection;
  /** Открывает одноразовую схему из миграций. */
  beforeAll(async () => {
    conn = await openTestDatabase();
  });
  /** Удаляет только два тестовых namespace-маркера при наличии таблицы и закрывает соединение. */
  afterAll(async () => {
    if (conn) {
      const [tables] = await conn.query<RowDataPacket[]>(
        "SHOW TABLES LIKE 'content_recovery_markers'",
      );
      if (tables.length)
        await conn.query(
          "DELETE FROM content_recovery_markers WHERE requestKey=? AND actorUserId IN (97340,97341)",
          ["0".repeat(64)],
        );
      await conn.end();
    }
  });
  /** Сверяет полный состав PRIMARY KEY kind/requestKey, ascii_bin идентичность и только четыре согласованных колонки. */
  it("preserves a complete unique operation identity without payload or result columns", async () => {
    const [tables] = await conn.query<RowDataPacket[]>(
      "SHOW TABLES LIKE 'content_recovery_markers'",
    );
    expect(tables).toHaveLength(1);
    const [indexes] = await conn.query<RowDataPacket[]>(
      "SELECT COLUMN_NAME AS name,SUB_PART AS prefix FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='content_recovery_markers' AND INDEX_NAME='PRIMARY' ORDER BY SEQ_IN_INDEX",
    );
    expect(indexes).toEqual([
      { name: "kind", prefix: null },
      { name: "requestKey", prefix: null },
    ]);
    const [columns] = await conn.query<RowDataPacket[]>(
      "SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='content_recovery_markers' ORDER BY ORDINAL_POSITION",
    );
    expect(columns.map((row) => row.name)).toEqual([
      "kind",
      "requestKey",
      "actorUserId",
      "createdAt",
    ]);
    const [identity] = await conn.query<RowDataPacket[]>(
      "SELECT COLLATION_NAME AS collation FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='content_recovery_markers' AND COLUMN_NAME='requestKey'",
    );
    expect(identity[0].collation).toBe("ascii_bin");
  });
  /** Одинаковый ключ в namespace поста нельзя перепривязать другому владельцу; namespace статьи независим. */
  it("rejects a competing owner for the same operation while separating namespaces", async () => {
    const key = "0".repeat(64);
    await conn.query(
      "INSERT INTO content_recovery_markers (kind,requestKey,actorUserId,createdAt) VALUES ('post',?,97340,NOW())",
      [key],
    );
    await expect(
      conn.query(
        "INSERT INTO content_recovery_markers (kind,requestKey,actorUserId,createdAt) VALUES ('post',?,97341,NOW())",
        [key],
      ),
    ).rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
    await conn.query(
      "INSERT INTO content_recovery_markers (kind,requestKey,actorUserId,createdAt) VALUES ('article',?,97340,NOW())",
      [key],
    );
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT kind,actorUserId FROM content_recovery_markers WHERE requestKey=? ORDER BY kind",
      [key],
    );
    expect(rows).toEqual([
      { kind: "post", actorUserId: 97340 },
      { kind: "article", actorUserId: 97340 },
    ]);
  });
});
