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

const conn = await mysql.createConnection(env.DATABASE_URL.replace(/\r/g, "").trim());

async function run(label, sql) {
  try {
    await conn.query(sql);
    console.log("ok:", label);
  } catch (error) {
    const message = String(error?.message || error);
    if (
      message.includes("Duplicate column") ||
      message.includes("Duplicate key name") ||
      message.includes("already exists")
    ) {
      console.log("skip:", label);
      return;
    }
    throw error;
  }
}

await run("users.phone", "ALTER TABLE `users` ADD COLUMN `phone` varchar(16) NULL");
await run("users_phone_unique", "CREATE UNIQUE INDEX `users_phone_unique` ON `users` (`phone`)");
await run(
  "sms_codes",
  `CREATE TABLE IF NOT EXISTS \`sms_codes\` (
	\`id\` int AUTO_INCREMENT NOT NULL,
	\`phone\` varchar(16) NOT NULL,
	\`codeHash\` varchar(64) NOT NULL,
	\`ip\` varchar(45) NOT NULL DEFAULT '',
	\`createdAt\` timestamp NOT NULL DEFAULT (now()),
	\`expiresAt\` timestamp NOT NULL,
	\`usedAt\` timestamp NULL,
	CONSTRAINT \`sms_codes_id\` PRIMARY KEY(\`id\`),
	INDEX \`sms_codes_phone_created\` (\`phone\`, \`createdAt\`),
	INDEX \`sms_codes_ip_created\` (\`ip\`, \`createdAt\`)
)`,
);

await conn.end();
console.log("sms auth tables ready");
