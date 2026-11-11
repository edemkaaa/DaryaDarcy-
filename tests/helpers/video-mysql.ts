import type { RowDataPacket } from "mysql2/promise";
import { openTestDatabase } from "./backend-mysql";
import { readFile } from "node:fs/promises";

export async function openVideoTestDatabase() {
  // Применяет VK-схему и ревизии лишь к охраняемой тестовой БД под проверенной блокировкой; ошибка закрывает созданное соединение.

  const conn = await openTestDatabase();
  try {
    const [locks] = await conn.query<RowDataPacket[]>(
      "SELECT GET_LOCK('backend_test_video_schema',30) AS acquired",
    );
    if (Number(locks[0]?.acquired) !== 1)
      throw new Error("Video test schema lock unavailable");
    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS videos (
        id INT AUTO_INCREMENT PRIMARY KEY,youtubeId VARCHAR(32) NOT NULL UNIQUE,
        title VARCHAR(512) NOT NULL,duration VARCHAR(16),thumbnailUrl TEXT,videoUrl TEXT,
        views VARCHAR(32),publishedText VARCHAR(64),sortOrder INT NOT NULL DEFAULT 0,
        published BOOLEAN NOT NULL DEFAULT TRUE,createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB`);
      const [applied] = await conn.query<RowDataPacket[]>(
        "SELECT name FROM backend_test_migrations WHERE name='0031_vk_catalog_access'",
      );
      if (!applied.length) {
        await conn.query(
          await readFile(
            new URL(
              "../../packages/database/drizzle/0031_vk_catalog_access.sql",
              import.meta.url,
            ),
            "utf8",
          ),
        );
        await conn.query(
          "INSERT INTO backend_test_migrations VALUES ('0031_vk_catalog_access')",
        );
      }
      const [revision] = await conn.query<RowDataPacket[]>(
        "SELECT name FROM backend_test_migrations WHERE name='0049_video_edit_revision'",
      );
      if (!revision.length) {
        await conn.query(await readFile(new URL("../../packages/database/drizzle/0049_video_edit_revision.sql", import.meta.url), "utf8"));
        await conn.query("INSERT INTO backend_test_migrations VALUES ('0049_video_edit_revision')");
      }
      // Fixed fixtures reserve IDs below one million. Use live metadata: cached
      // counters could repeat ALTER while another suite holds a transaction lock.
      await conn.query("SET SESSION information_schema_stats_expiry=0");
      const [counters] = await conn.query<RowDataPacket[]>(
        "SELECT AUTO_INCREMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='videos'",
      );
      if (Number(counters[0]?.AUTO_INCREMENT) < 1_000_000)
        await conn.query("ALTER TABLE videos AUTO_INCREMENT=1000000");
    } finally {
      await conn.query("SELECT RELEASE_LOCK('backend_test_video_schema')");
    }
    return conn;
  } catch (error) {
    await conn.end();
    throw error;
  }
}
