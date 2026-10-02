import mysql from "mysql2/promise";

export const testDatabaseUrl = process.env.BACKEND_TEST_DATABASE_URL;
export async function openTestDatabase() {
  if (!testDatabaseUrl) throw new Error("BACKEND_TEST_DATABASE_URL required");
  const url = new URL(testDatabaseUrl);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/backend_test") {
    throw new Error("Integration tests require local disposable backend_test database");
  }
  const conn = await mysql.createConnection({ uri: testDatabaseUrl, timezone: "Z" });
  await conn.query(`CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY, openId VARCHAR(64) NOT NULL UNIQUE, email VARCHAR(320),
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
  return conn;
}
