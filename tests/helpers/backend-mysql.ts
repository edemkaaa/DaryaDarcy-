import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { assertTestDatabase } from "../../tooling/scripts/test-database-policy";

export const testDatabaseUrl = process.env.BACKEND_TEST_DATABASE_URL;
export async function openTestDatabase() {
  if (!testDatabaseUrl) throw new Error("BACKEND_TEST_DATABASE_URL required");
  assertTestDatabase(testDatabaseUrl);
  const conn = await mysql.createConnection({
    uri: testDatabaseUrl,
    timezone: "Z",
  });
  await conn.query(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY, openId VARCHAR(64) NOT NULL UNIQUE, email VARCHAR(320),
    name TEXT, phone VARCHAR(16), passwordHash VARCHAR(255), loginMethod VARCHAR(64),
    gender ENUM('female','male'), avatarUrl TEXT, role ENUM('user','admin','moderator') NOT NULL DEFAULT 'user',
    blockedAt TIMESTAMP NULL, blockedReason VARCHAR(512), accountDeletionRequestedAt TIMESTAMP NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    lastSignedIn TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
  await conn.query(`CREATE TABLE IF NOT EXISTS club_payments (
    id INT AUTO_INCREMENT PRIMARY KEY, userId INT NOT NULL, orderId VARCHAR(64) NOT NULL UNIQUE,
    email VARCHAR(320), sum VARCHAR(32), status ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending',
    paidAt TIMESTAMP NULL, expiresAt TIMESTAMP NULL, cancelAtPeriodEnd BOOLEAN NOT NULL DEFAULT FALSE,
    cancelledAt TIMESTAMP NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
  await conn.query(`CREATE TABLE IF NOT EXISTS admin_audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY, actorUserId INT NOT NULL, action VARCHAR(64) NOT NULL,
    targetType VARCHAR(32) NOT NULL,targetId INT NULL,details TEXT,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`);
  await conn.query("SELECT GET_LOCK('backend_test_schema',30)");
  try {
    // Upgrade only the disposable fixture created by earlier test iterations.
    // Production schema already has AUTO_INCREMENT; authentication upserts need it.
    const [idColumns] = await conn.query<mysql.RowDataPacket[]>("SELECT EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='id'");
    if (!String(idColumns[0]?.EXTRA).includes("auto_increment")) {
      await conn.query("ALTER TABLE users MODIFY id INT NOT NULL AUTO_INCREMENT");
    }
    // Fixed parallel fixtures reserve IDs below one million. Keep accounts
    // created through real registration outside those suites' cleanup ranges.
    // Cached MySQL table statistics would otherwise repeat this DDL while
    // another suite holds a row lock. Inspect the live counter instead.
    await conn.query("SET SESSION information_schema_stats_expiry=0");
    const [counters] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT AUTO_INCREMENT FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users'",
    );
    if (Number(counters[0]?.AUTO_INCREMENT) < 1_000_000) {
      await conn.query("ALTER TABLE users AUTO_INCREMENT=1000000");
    }
    await conn.query(
      "CREATE TABLE IF NOT EXISTS backend_test_migrations (name VARCHAR(100) PRIMARY KEY)",
    );
    for (const name of [
      "0020_billing_identity",
      "0021_access_mail_status",
      "0022_password_token_recipient",
      "0023_launch_settings",
      "0024_identity_query_indexes",
      "0025_post_creation_requests",
      "0026_billing_checkout_intents",
      "0027_user_email_identity",
      "0028_member_email_bindings",
      "0029_article_creation_requests",
      "0030_normal_checkout_requests",
      "0032_private_attachment_uploads",
      "0033_content_recovery_markers",
      "0034_private_recovery_lifecycle",
      "0035_recovery_retirement",
      "0036_private_content_files",
      "0037_comment_creation_requests",
      "0039_private_video_uploads",
      "0041_library_files",
      "0043_public_photo_uploads",
    ]) {
      const [rows] = await conn.query<mysql.RowDataPacket[]>(
        "SELECT name FROM backend_test_migrations WHERE name=?",
        [name],
      );
      if (!rows.length) {
        const sql = await readFile(
          new URL(
            `../../packages/database/drizzle/${name}.sql`,
            import.meta.url,
          ),
          "utf8",
        );
        for (const statement of sql.split("--> statement-breakpoint"))
          await conn.query(statement);
        await conn.query("INSERT INTO backend_test_migrations VALUES (?)", [
          name,
        ]);
      }
    }
  } finally {
    await conn.query("SELECT RELEASE_LOCK('backend_test_schema')");
  }
  return conn;
}
