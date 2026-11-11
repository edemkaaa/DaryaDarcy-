/** Конфигурация Drizzle CLI: описывает модель и выход SQL, но сама не разрешает миграцию рабочей БД. */
import { defineConfig } from "drizzle-kit";

// Никакого запасного адреса: оператор обязан явно выбрать БД; db:push сначала выполняет отдельный preflight.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

// История SQL/metadata хранится в Git; существующие шаги не переписываются при пояснении модели.
export default defineConfig({
  schema: "./packages/database/src/schema.ts",
  out: "./packages/database/drizzle",
  dialect: "mysql",
  dbCredentials: {
    url: connectionString,
  },
});
