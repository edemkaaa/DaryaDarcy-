/** Reader истории миграций проверяется с mock wire MySQL, но настоящими фиксированными metadata-запросами. */
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  query: vi.fn(),
  rollback: vi.fn(),
  end: vi.fn(),
}));
vi.mock("mysql2/promise", () => ({
  default: { createConnection: mocks.connect },
}));
import { readMigrationHistory } from "../tooling/scripts/migration-history";

/** Проверяем read-only транзакцию, отсутствие auto-DDL и обязательное закрытие соединения. */
describe("read-only migration history connection", () => {
  /** Сбрасываем wire mocks и задаём ожидаемую строку журнала. */
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.connect.mockResolvedValue({
      query: mocks.query,
      rollback: mocks.rollback,
      end: mocks.end,
    });
    mocks.query.mockImplementation(async (input) => {
      if (input === "START TRANSACTION READ ONLY") return [[], []];
      if (input.sql.includes("information_schema.TABLES"))
        return [[{ TABLE_NAME: "__drizzle_migrations" }], []];
      return [[{ hash: "a".repeat(64), created_at: 100 }], []];
    });
  });
  /** Разрешены ровно START READ ONLY и два metadata SELECT, затем rollback/end. */
  it("issues only fixed metadata reads inside a read-only transaction", async () => {
    expect(
      await readMigrationHistory("mysql://test:secret@127.0.0.1/backend_test"),
    ).toEqual([{ hash: "a".repeat(64), created_at: 100 }]);
    expect(
      mocks.query.mock.calls.map(([input]) =>
        typeof input === "string" ? input : input.sql,
      ),
    ).toEqual([
      "START TRANSACTION READ ONLY",
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='__drizzle_migrations'",
      "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at, id LIMIT 10001",
    ]);
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.end).toHaveBeenCalledOnce();
  });
  /** Отсутствие таблицы возвращается как undefined; reader не создаёт её. */
  it("does not create an absent migration journal", async () => {
    mocks.query.mockResolvedValue([[], []]);
    expect(
      await readMigrationHistory("mysql://test@127.0.0.1/backend_test"),
    ).toBeUndefined();
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.end).toHaveBeenCalledOnce();
  });
  /** Ошибка чтения сохраняется, а rollback/end всё равно исполняются. */
  it("closes the connection after a metadata query fails", async () => {
    mocks.query.mockRejectedValue(new Error("fixture metadata failure"));
    await expect(
      readMigrationHistory("mysql://test@127.0.0.1/backend_test"),
    ).rejects.toThrow("fixture metadata failure");
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.end).toHaveBeenCalledOnce();
  });
  /** Даже отказ rollback не оставляет соединение открытым. */
  it("still closes the connection if rollback fails", async () => {
    mocks.rollback.mockRejectedValue(new Error("fixture rollback failure"));
    await expect(
      readMigrationHistory("mysql://test@127.0.0.1/backend_test"),
    ).rejects.toThrow("fixture rollback failure");
    expect(mocks.end).toHaveBeenCalledOnce();
  });
  /** Некорректный scheme/schema останавливается до createConnection. */
  it.each(["https://example.test/db", "mysql://test@127.0.0.1/"])(
    "refuses an invalid connection before opening it: %s",
    async (uri) => {
      await expect(readMigrationHistory(uri)).rejects.toThrow(
        "Invalid preflight connection",
      );
      expect(mocks.connect).not.toHaveBeenCalled();
    },
  );
});
