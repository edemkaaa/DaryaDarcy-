// Минимальная конфигурация проверяет TS enum при экспорте Drizzle; фиктивная схема не связана с рабочей БД.
enum Dialect {
  MySQL = "mysql",
}
export default { dialect: Dialect.MySQL, schema: "./schema.ts" };
