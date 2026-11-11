// Enum и alias-import служат проверке совместимости старого loader; sqlite указан как фикстура без открытия БД.
enum Dialect {
  SQLite = "sqlite",
}
export default { dialect: Dialect.SQLite, schema: "./synthetic-schema.ts" };
