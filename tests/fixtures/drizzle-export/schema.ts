import { int, mysqlTable, varchar } from "drizzle-orm/mysql-core";

// Синтетическая таблица нужна только проверке загрузки TypeScript-схемы CLI, это не production-миграция.
export const fixture = mysqlTable("synthetic_compatibility", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
});
