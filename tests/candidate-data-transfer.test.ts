/** Проверяем чистый план колонок переноса на метаданных, не выполняя SQL или копирование данных. */
import { expect, it } from "vitest";
import * as transfer from "../tooling/scripts/candidate-data-transfer";

const oldColumns = [
  {
    table: "users",
    name: "id",
    type: "int",
    nullable: "NO",
    default: null,
    extra: "auto_increment",
    generation: "",
    collation: null,
    ordinal: 1,
  },
  {
    table: "users",
    name: "passwordHash",
    type: "varchar(255)",
    nullable: "YES",
    default: null,
    extra: "",
    generation: "",
    collation: "utf8mb4_0900_ai_ci",
    ordinal: 2,
  },
];
/** Явный список сохраняет исходные колонки; дополнительное nullable-поле цели не требует выдуманного значения. */
it("keeps every source column explicit and permits a nullable new target field", () => {
  expect(
    transfer.transferColumnPlan?.(oldColumns, [
      ...oldColumns,
      { ...oldColumns[1], name: "newField", ordinal: 3 },
    ]),
  ).toEqual([{ name: "users", columns: ["id", "passwordHash"] }]);
});
/** Отсутствие, сужение типа и обязательное новое поле должны блокировать перенос. */
it.each(
  [
    oldColumns.slice(0, 1),
    oldColumns.map((c) =>
      c.name === "passwordHash" ? { ...c, type: "varchar(100)" } : c,
    ),
    [
      ...oldColumns,
      { ...oldColumns[1], name: "required", nullable: "NO", ordinal: 3 },
    ],
  ].map((target) => ({ target })),
)(
  "refuses missing, narrowed or unsatisfied target columns %#",
  ({ target }) => {
    expect(() => transfer.transferColumnPlan?.(oldColumns, target)).toThrow();
  },
);
/** Непроверенное имя таблицы не должно становиться частью генерируемого SQL. */
it("refuses identifiers which could redirect a generated SQL statement", () => {
  const malicious = oldColumns.map((c) => ({
    ...c,
    table: "users`; DROP DATABASE other;--",
  }));
  expect(() => transfer.transferColumnPlan?.(malicious, malicious)).toThrow();
});
/** История схемы не переносится как обычные пользовательские записи. */
it("refuses copying migration history as application data", () => {
  const history = oldColumns.map((c) => ({
    ...c,
    table: "__drizzle_migrations",
  }));
  expect(() => transfer.transferColumnPlan?.(history, history)).toThrow();
});
