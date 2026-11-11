/** Named-lock orchestration проверяется управляемым MySQL connection, не настоящими server locks. */
import { afterEach, expect, it, vi } from "vitest";
import * as database from "../apps/backend/src/database/connection";
import { withDatabaseLock } from "../apps/backend/src/database/coordination";

/** Снимаем DB spies и fake timers. */
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
/** Двойник воспроизводит DATABASE/GET_LOCK/RELEASE_LOCK и раздельно считает release/destroy. */
function fixture(acquired: number | null = 1) {
  const connection = {
    query: vi
      .fn()
      .mockResolvedValueOnce([[{ db: "owned_fixture" }]])
      .mockResolvedValueOnce([[{ acquired }]])
      .mockResolvedValue([[{ released: 1 }]]),
    release: vi.fn(),
    destroy: vi.fn(),
  };
  const getConnection = vi.fn().mockResolvedValue(connection);
  vi.spyOn(database, "getDb").mockResolvedValue({
    $client: { getConnection },
  } as never);
  return { connection, getConnection };
}
/** Занятый lock возвращает acquired:false без запуска callback; чистая сессия возвращается в пул. */
it("skips an occupied job without calling it and releases its unlocked connection", async () => {
  const { connection } = fixture(0);
  const run = vi.fn();
  expect(await withDatabaseLock("busy-fixture", 0, run)).toEqual({
    acquired: false,
  });
  expect(run).not.toHaveBeenCalled();
  expect(connection.release).toHaveBeenCalledOnce();
  expect(connection.destroy).not.toHaveBeenCalled();
});
/** Неопределённый результат GET_LOCK делает сессию непригодной и не допускает работу. */
it("does not begin domain work when lock acquisition returns an error", async () => {
  const { connection } = fixture(null);
  const run = vi.fn();
  await expect(withDatabaseLock("error-fixture", 0, run)).rejects.toThrow(
    "временно недоступен",
  );
  expect(run).not.toHaveBeenCalled();
  expect(connection.destroy).toHaveBeenCalledOnce();
  expect(connection.release).not.toHaveBeenCalled();
});
/** Ошибка callback не мешает RELEASE_LOCK и обычному release подтверждённо чистого соединения. */
it("releases its named lock even when domain work throws", async () => {
  const { connection } = fixture();
  await expect(
    withDatabaseLock("throw-fixture", 0, async () => {
      throw new Error("synthetic domain failure");
    }),
  ).rejects.toThrow("synthetic domain failure");
  expect(connection.query.mock.calls.at(-1)?.[0].sql).toContain("RELEASE_LOCK");
  expect(connection.release).toHaveBeenCalledOnce();
  expect(connection.destroy).not.toHaveBeenCalled();
});
/** Неподтверждённый unlock требует destroy, чтобы lock не утёк следующему заёмщику. */
it.each(["refused", "query-failure"])(
  "destroys rather than reuses a session when unlock is %s",
  async (failure) => {
    const { connection } = fixture();
    connection.query
      .mockReset()
      .mockResolvedValueOnce([[{ db: "owned_fixture" }]])
      .mockResolvedValueOnce([[{ acquired: 1 }]]);
    if (failure === "refused")
      connection.query.mockResolvedValueOnce([[{ released: 0 }]]);
    else
      connection.query.mockRejectedValueOnce(
        new Error("synthetic unlock failure"),
      );
    await withDatabaseLock("unlock-fixture", 0, async () => {});
    expect(connection.destroy).toHaveBeenCalledOnce();
    expect(connection.release).not.toHaveBeenCalled();
  },
);
/** Просроченное ожидание не запускает callback; поздно выданное соединение освобождается без SQL. */
it("times out pool admission and releases a connection that arrives too late", async () => {
  vi.useFakeTimers();
  const { connection, getConnection } = fixture();
  let acquired!: (connection: unknown) => void;
  getConnection.mockImplementation(
    () =>
      new Promise((done) => {
        acquired = done;
      }),
  );
  const run = vi.fn();
  const pending = expect(
    withDatabaseLock("pool-fixture", 0, run),
  ).rejects.toThrow("временно недоступен");
  await vi.advanceTimersByTimeAsync(3000);
  await pending;
  acquired(connection);
  await vi.advanceTimersByTimeAsync(0);
  expect(connection.release).toHaveBeenCalledOnce();
  expect(connection.query).not.toHaveBeenCalled();
  expect(run).not.toHaveBeenCalled();
});
