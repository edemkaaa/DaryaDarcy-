/** Проверяем параметризацию значений и экранирование SQL-идентификаторов на построенных запросах, без MySQL. */
import { expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { MySqlDialect, mysqlTable, int } from "drizzle-orm/mysql-core";
import { drizzle } from "drizzle-orm/mysql2";

/** Обратная кавычка внутри имени удваивается и остаётся частью идентификатора. */
it("quotes backticks inside identifiers instead of treating them as SQL", () => {
  const query = new MySqlDialect().sqlToQuery(sql`select ${sql.identifier("value` OR 1=1 -- ")}`);
  expect(query.sql).toBe("select `value`` OR 1=1 -- `");
  expect(query.params).toEqual([]);
});

/** Alias экранируется как имя, а пользовательское значение остаётся отдельным параметром. */
it("escapes quoted aliases and keeps user values as parameters", () => {
  const table = mysqlTable("identifier_probe", { id: int("id") });
  const database = drizzle.mock();
  const query = database.select({ value: sql`${"private value"}`.as("value` OR 1=1 -- ") }).from(table).toSQL();
  expect(query.sql).toBe("select ? as `value`` OR 1=1 -- ` from `identifier_probe`");
  expect(query.params).toEqual(["private value"]);
});
