import { openTestDatabase } from "./backend-mysql";
import type { RowDataPacket } from "mysql2/promise";
import { readFile } from "node:fs/promises";

export async function openContentTestDatabase() {
  const conn = await openTestDatabase();
  await conn.query("SELECT GET_LOCK('backend_test_content_schema',30)");
  try {
    await conn.query(`CREATE TABLE IF NOT EXISTS posts (
      id INT PRIMARY KEY, text TEXT NOT NULL, photos JSON NOT NULL, tags JSON NOT NULL,
      source VARCHAR(32) DEFAULT 'manual', instagramId VARCHAR(128), sortOrder INT DEFAULT 0,
      published BOOLEAN NOT NULL DEFAULT TRUE, status ENUM('draft','scheduled','published') DEFAULT 'published',
      target ENUM('feed','club','both') DEFAULT 'feed', scheduledAt TIMESTAMP NULL, publishedAt TIMESTAMP NULL,
      richText JSON, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
    const [publicIdMigration] = await conn.query<RowDataPacket[]>(
      "SELECT name FROM backend_test_migrations WHERE name='0051_post_public_id'",
    );
    if (!publicIdMigration.length) {
      const sql = await readFile(new URL("../../packages/database/drizzle/0051_post_public_id.sql", import.meta.url), "utf8");
      for (const statement of sql.split("--> statement-breakpoint"))
        await conn.query(statement);
      await conn.query("INSERT INTO backend_test_migrations VALUES('0051_post_public_id')");
    }
    await conn.query(`CREATE TABLE IF NOT EXISTS post_media (
      id INT PRIMARY KEY,postId INT NOT NULL,type ENUM('video','audio','document') NOT NULL,url TEXT NOT NULL,
      filename VARCHAR(512),mimeType VARCHAR(128),fileSize INT,duration INT,sortOrder INT DEFAULT 0,createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
    const [posterMigration] = await conn.query<RowDataPacket[]>("SELECT name FROM backend_test_migrations WHERE name='0040_private_video_posters'");
    if (!posterMigration.length) {
      await conn.query(await readFile(new URL("../../packages/database/drizzle/0040_private_video_posters.sql", import.meta.url), "utf8"));
      await conn.query("INSERT INTO backend_test_migrations VALUES('0040_private_video_posters')");
    }
    await conn.query("CREATE TABLE IF NOT EXISTS likes (id INT AUTO_INCREMENT PRIMARY KEY,userId INT,postId INT,createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
    await conn.query("CREATE TABLE IF NOT EXISTS saved_posts (id INT AUTO_INCREMENT PRIMARY KEY,userId INT NOT NULL,postId INT NOT NULL,createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB");
    await conn.query(`CREATE TABLE IF NOT EXISTS post_comments (
      id INT AUTO_INCREMENT PRIMARY KEY,postId INT NOT NULL,parentId INT NULL,userId INT NOT NULL,text TEXT NOT NULL,photos JSON,createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
    await conn.query("CREATE TABLE IF NOT EXISTS comment_likes (id INT AUTO_INCREMENT PRIMARY KEY,userId INT NOT NULL,commentId INT NOT NULL,createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB");
    await conn.query("CREATE TABLE IF NOT EXISTS comment_reports (id INT AUTO_INCREMENT PRIMARY KEY,commentId INT NOT NULL,reporterUserId INT NOT NULL,reason VARCHAR(512) NOT NULL,createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB");
    for (const table of ["posts", "post_media", "post_comments", "comment_likes", "comment_reports"]) {
      const [columns] = await conn.query<RowDataPacket[]>("SELECT EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME='id'", [table]);
      if (!String(columns[0]?.EXTRA).includes("auto_increment")) await conn.query(`ALTER TABLE ${table} MODIFY id INT NOT NULL AUTO_INCREMENT`);
    }
    // Production posts/media/comments have generated IDs. Keep those outside explicit
    // fixture IDs, so real creation/replacement cannot collide with other suites.
    for (const table of ["posts", "post_media", "post_comments"]) {
      const [counters] = await conn.query<RowDataPacket[]>("SELECT AUTO_INCREMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=?", [table]);
      if (Number(counters[0]?.AUTO_INCREMENT) < 1_000_000) await conn.query(`ALTER TABLE ${table} AUTO_INCREMENT=1000000`);
    }
    for (const [table, index, columns] of [
      ["comment_likes", "comment_likes_unique", "userId,commentId"],
      ["comment_reports", "comment_reports_unique", "commentId,reporterUserId"],
    ]) {
      const [indexes] = await conn.query<RowDataPacket[]>("SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?", [table, index]);
      if (!indexes.length) await conn.query(`ALTER TABLE ${table} ADD UNIQUE ${index} (${columns})`);
    }
  } finally {
    await conn.query("SELECT RELEASE_LOCK('backend_test_content_schema')");
  }
  return conn;
}
