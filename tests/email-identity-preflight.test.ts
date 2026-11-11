/** Read-only preflight нормализованных email использует mock MySQL wire и безопасные коды проблем без PII. */
import { beforeEach, describe, expect, it, vi } from "vitest";
const connection = vi.hoisted(() => ({
  query: vi.fn(),
  rollback: vi.fn(),
  end: vi.fn(),
}));
const createConnection = vi.hoisted(() => vi.fn());
vi.mock("mysql2/promise", () => ({ default: { createConnection } }));
import { readEmailIdentityIssues } from "../tooling/scripts/email-identity-preflight";

/** Ни один сценарий не исправляет адреса: incompatibility должна блокировать отдельную миграцию. */
describe("read-only normalized email preflight", () => {
  /** Сбрасываем соединение и заранее задаём пустые результаты metadata-чтений. */
  beforeEach(() => {
    vi.resetAllMocks();
    createConnection.mockResolvedValue(connection);
    connection.query.mockResolvedValue([[]]);
  });
  /** Формируем последовательность READ ONLY, страниц users, конца выборки и признака дублей. */
  function rows(emails: (string | null)[], duplicate = false) {
    connection.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([
        emails.map((email, index) => ({ id: index + 1, email })),
      ])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([duplicate ? [{ conflict: 1 }] : []]);
  }
  /** Канонические/null/пустые старые email проходят только SELECT-проверки с rollback/end. */
  it("accepts normalized addresses and absent legacy emails without writes", async () => {
    rows(["member@example.test", null, ""]);
    expect(
      await readEmailIdentityIssues("mysql://root@127.0.0.1/backend_test"),
    ).toEqual([]);
    const statements = connection.query.mock.calls.map(([query]) =>
      typeof query === "string" ? query : query.sql,
    );
    expect(statements[0]).toBe("START TRANSACTION READ ONLY");
    expect(statements.slice(1).every((sql) => sql.startsWith("SELECT "))).toBe(
      true,
    );
    expect(statements).toHaveLength(4);
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.end).toHaveBeenCalledOnce();
  });
  /** Нестандартный регистр и пробельные формы дают код noncanonical без самого адреса. */
  it.each([
    "MEMBER@example.test",
    " member@example.test ",
    "\tmember@example.test\n",
    "\u00a0member@example.test",
    "   ",
  ])(
    "blocks incompatible legacy email %# without echoing it",
    async (email) => {
      rows([email]);
      const issues = await readEmailIdentityIssues(
        "mysql://root@127.0.0.1/backend_test",
      );
      expect(issues).toEqual(["email-identity-noncanonical"]);
      expect(JSON.stringify(issues)).not.toContain(email);
    },
  );
  /** Конфликт уникальности сообщается обезличенным кодом. */
  it("blocks duplicates without returning addresses or account identifiers", async () => {
    rows(["member@example.test"], true);
    expect(
      await readEmailIdentityIssues("mysql://root@127.0.0.1/backend_test"),
    ).toEqual(["email-identity-duplicates"]);
  });
  /** Некорректная старая строка не нормализуется автоматически. */
  it("blocks a malformed non-empty legacy address without repairing it", async () => {
    rows(["not-an-email"]);
    expect(
      await readEmailIdentityIssues("mysql://root@127.0.0.1/backend_test"),
    ).toEqual(["email-identity-invalid"]);
  });
  /** Читаем keyset-порциями до 500 по последнему проверенному ID, не OFFSET. */
  it("paginates with a bound and the last inspected id", async () => {
    connection.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[{ id: 501, email: null }]])
      .mockResolvedValueOnce([[{ id: 900, email: "member@example.test" }]])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([[]]);
    expect(
      await readEmailIdentityIssues("mysql://root@127.0.0.1/backend_test"),
    ).toEqual([]);
    expect(connection.query.mock.calls[1][1]).toEqual([-2147483649]);
    expect(connection.query.mock.calls[2][1]).toEqual([501]);
    expect(connection.query.mock.calls[3][1]).toEqual([900]);
    expect(connection.query.mock.calls[1][0].sql).toContain("LIMIT 500");
  });
  /** Повреждённая SQL-строка останавливает проверку и освобождает соединение. */
  it("fails closed on malformed rows and closes the inspection connection", async () => {
    connection.query
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([
        [{ id: "unknown", email: "member@example.test" }],
      ]);
    await expect(
      readEmailIdentityIssues("mysql://root@127.0.0.1/backend_test"),
    ).rejects.toThrow("Invalid email identity row");
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.end).toHaveBeenCalledOnce();
  });
  /** SQL-отказ не запускает DDL/UPDATE и всегда вызывает rollback/end. */
  it("closes after a failed query without trying a repair", async () => {
    connection.query
      .mockResolvedValueOnce([[]])
      .mockRejectedValueOnce(new Error("query failed"));
    await expect(
      readEmailIdentityIssues("mysql://root@127.0.0.1/backend_test"),
    ).rejects.toThrow("query failed");
    expect(connection.rollback).toHaveBeenCalledOnce();
    expect(connection.end).toHaveBeenCalledOnce();
  });
});
