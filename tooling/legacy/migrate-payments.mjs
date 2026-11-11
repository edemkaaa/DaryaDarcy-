// Старый DDL платежей добавляет поля отмены и shop_purchases; не проверяет совместимость с текущим выпуском.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const env = {};
for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("=");
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

// С этого места выбранная БД реально изменяется; текущая история и рабочее назначение автоматически не проверены.
const conn = await mysql.createConnection(env.DATABASE_URL.replace(/\r/g, "").trim());

async function run(sql, label) {
  // Применяет один старый DDL-запрос, подавляя только ожидаемые duplicate/already-exists ошибки; журнал миграций не ведётся.

  try {
    await conn.query(sql);
    console.log("ok", label);
  } catch (error) {
    const message = String(error?.message || error);
    if (/Duplicate column|already exists/i.test(message)) {
      console.log("skip", label);
      return;
    }
    throw error;
  }
}

await run(
  "ALTER TABLE `club_payments` ADD COLUMN `cancelAtPeriodEnd` tinyint(1) NOT NULL DEFAULT 0",
  "cancelAtPeriodEnd",
);
await run(
  "ALTER TABLE `club_payments` ADD COLUMN `cancelledAt` timestamp NULL",
  "cancelledAt",
);
await run(
  `CREATE TABLE IF NOT EXISTS \`shop_purchases\` (
  \`id\` int AUTO_INCREMENT NOT NULL,
  \`userId\` int,
  \`productId\` varchar(64) NOT NULL,
  \`orderId\` varchar(80) NOT NULL,
  \`email\` varchar(320),
  \`sum\` varchar(32),
  \`status\` enum('pending','paid','failed') NOT NULL DEFAULT 'pending',
  \`paidAt\` timestamp NULL,
  \`createdAt\` timestamp NOT NULL DEFAULT (now()),
  \`updatedAt\` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT \`shop_purchases_id\` PRIMARY KEY(\`id\`),
  CONSTRAINT \`shop_purchases_orderId\` UNIQUE(\`orderId\`)
)`,
  "shop_purchases",
);

await conn.end();
console.log("payments schema ready");
