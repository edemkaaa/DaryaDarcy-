// Ручной перенос старых platform-миграций 0015–0018 пропускает duplicate ошибки и отдельно проверяет наличие таблиц, не их эквивалентность.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const env = Object.fromEntries(
  fs
    .readFileSync(path.join(root, ".env"), "utf8")
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const url = env.DATABASE_URL?.replace(/\r/g, "").trim();
if (!url) {
  console.error("DATABASE_URL missing");
  process.exit(1);
}

const files = ["0015_push_consent", "0016_platform_features", "0017_consent_text", "0018_push_consent_text"];

function splitSql(sql) {
  // Исторически делит SQL по breakpoint либо строке с точкой с запятой; это не универсальный SQL-парсер.

  if (sql.includes("--> statement-breakpoint")) {
    return sql
      .split("--> statement-breakpoint")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  const parts = [];
  let buf = "";
  for (const line of sql.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("--")) continue;
    buf += `${line}\n`;
    if (trimmed.endsWith(";")) {
      const statement = buf.trim();
      if (statement) parts.push(statement);
      buf = "";
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

// С этого места выбранная БД реально изменяется; текущая история и рабочее назначение автоматически не проверены.
const conn = await mysql.createConnection(url);
for (const tag of files) {
  const file = path.join(root, "drizzle", `${tag}.sql`);
  const sql = fs.readFileSync(file, "utf8");
  console.log("apply", tag);
  for (const statement of splitSql(sql)) {
    try {
      await conn.query(statement);
    } catch (error) {
      const msg = String(error?.message || error);
      if (
        msg.includes("Duplicate column") ||
        msg.includes("Duplicate key name") ||
        msg.includes("already exists") ||
        msg.includes("Duplicate entry")
      ) {
        console.log("  skip:", msg.split("\n")[0]);
        continue;
      }
      throw error;
    }
  }
}

const checks = [
  "push_consent_events",
  "user_consent_events",
  "pen_pal_matches",
  "comment_reports",
  "admin_audit_log",
  "shop_delivery_emails",
];
for (const table of checks) {
  const [[row]] = await conn.query(
    "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?",
    [table],
  );
  console.log(table, row.c ? "ok" : "MISSING");
}

const [[usersCols]] = await conn.query(
  "SELECT COUNT(*) AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'blockedAt'",
);
console.log("users.blockedAt", usersCols.c ? "ok" : "MISSING");

await conn.end();
console.log("done");
