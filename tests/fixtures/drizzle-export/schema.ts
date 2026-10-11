import { int, mysqlTable, varchar } from "drizzle-orm/mysql-core";

export const fixture = mysqlTable("synthetic_compatibility", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 64 }).notNull(),
});
