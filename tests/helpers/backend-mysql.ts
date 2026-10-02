import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";

export const testDatabaseUrl = process.env.BACKEND_TEST_DATABASE_URL;
export async function openTestDatabase() {
  if (!testDatabaseUrl) throw new Error("BACKEND_TEST_DATABASE_URL required");
  const url = new URL(testDatabaseUrl);
  if (
    !["127.0.0.1", "localhost"].includes(url.hostname) ||
    url.pathname !== "/backend_test"
  ) {
    throw new Error(
      "Integration tests require local disposable backend_test database",
    );
  }
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
    await conn.query(
      "CREATE TABLE IF NOT EXISTS backend_test_migrations (name VARCHAR(100) PRIMARY KEY)",
    );
    for (const name of [
      "0020_billing_identity",
      "0021_access_mail_status",
      "0022_password_token_recipient",
      "0023_launch_settings",
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
