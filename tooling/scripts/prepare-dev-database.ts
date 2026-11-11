// Подготавливает схему локальной разработки с явной проверкой целевого подключения. Загрузка env не даёт разрешения заменять рабочую БД.
import "dotenv/config";
import { config } from "dotenv";
import { createConnection } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { hashPassword } from "../../apps/backend/src/_core/password";
import { users } from "../../packages/database/src/schema";

const root = resolve(__dirname, "../..");
config({ path: join(root, "apps/backend/.env"), quiet: true });
const uri = process.env.DATABASE_URL;
if (!uri) throw new Error("Не задан DATABASE_URL в apps/backend/.env");
const target = new URL(uri);
if (
  !["127.0.0.1", "localhost"].includes(target.hostname) ||
  target.port !== "3307" ||
  target.pathname !== "/daryadarcy_dev"
) {
  throw new Error(
    "Этот скрипт работает только с локальной daryadarcy_dev на порту 3307",
  );
}
if (process.env.NODE_ENV === "production")
  throw new Error("Подготовка dev-базы запрещена в production");

async function main() {
  const connection = await createConnection(uri!);
  try {
    const [tables] = await connection.query("SHOW TABLES");
    if (Array.isArray(tables) && tables.length === 0) {
      const scratch = mkdtempSync(join(tmpdir(), "daryadarcy-dev-schema-"));
      try {
        const configPath = join(scratch, "drizzle.config.cjs");
        writeFileSync(
          configPath,
          `module.exports = { dialect: "mysql", schema: ${JSON.stringify(join(root, "packages/database/src/schema.ts"))}, dbCredentials: { url: process.env.DATABASE_URL } };\n`,
          { mode: 0o600 },
        );
        const result = spawnSync(
          "pnpm",
          ["exec", "drizzle-kit", "push", `--config=${configPath}`, "--force"],
          {
            cwd: root,
            env: { ...process.env, DATABASE_URL: uri },
            stdio: "inherit",
          },
        );
        if (result.status !== 0)
          throw new Error("Не удалось создать схему dev-базы");
      } finally {
        rmSync(scratch, { recursive: true, force: true });
      }
    }
    const password = process.env.DEV_ADMIN_PASSWORD || "DarcyDev2026!";
    if (password.length < 12)
      throw new Error(
        "DEV_ADMIN_PASSWORD должен содержать минимум 12 символов",
      );
    const passwordHash = await hashPassword(password);
    await drizzle({ client: connection })
      .insert(users)
      .ignore()
      .values([
        {
          openId: "dev-admin",
          email: "admin@daryadarcy.test",
          name: "Администратор",
          loginMethod: "email",
          role: "admin",
          passwordHash,
        },
        {
          openId: "dev-member",
          email: "member@daryadarcy.test",
          name: "Тестовый пользователь",
          loginMethod: "email",
          role: "user",
          passwordHash,
        },
        {
          openId: "dev-reader",
          email: "reader@daryadarcy.test",
          name: "Тестовый читатель",
          loginMethod: "email",
          role: "user",
          passwordHash,
        },
      ]);
    console.log(
      "Локальная БД готова. Тестовый администратор: admin@daryadarcy.test",
    );
    console.log("Существующие пользователи и их пароли сохранены.");
  } finally {
    await connection.end();
  }
}
main().catch(() => {
  console.error(
    "Не удалось подготовить dev-базу. Проверьте MySQL на 127.0.0.1:3307.",
  );
  process.exitCode = 1;
});
