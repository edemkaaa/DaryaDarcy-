/** Guard MySQL-владения проверяется управляемыми promises и таймерами, без настоящего SQL. */
import { EventEmitter } from "node:events";
import type { PoolConnection } from "mysql2/promise";
import { afterEach, expect, it, vi } from "vitest";
import { runWithWorkerLock } from "../apps/backend/src/database/worker-lock-guard";

/** После каждого исхода возвращаем настоящие часы. */
afterEach(() => vi.useRealTimers());

/** После конца callback ждём уже запущенный heartbeat, не возвращая соединение в пул; поздний transport failure не теряет основной исход, listeners/timers очищаются. */
it.each(["success", "failure"])(
  "waits for a pending ownership check before returning the session after callback %s",
  async (outcome) => {
    vi.useFakeTimers();
    let finishJob!: () => void;
    let failProbe!: (error: Error) => void;
    const job = new Promise<void>((done) => {
      finishJob = done;
    });
    const probe = new Promise<never>((_, reject) => {
      failProbe = reject;
    });
    // Только SQL-транспорт заменён управляемым ожиданием. Сам guard настоящий;
    // аварийный выход процесса проверяется отдельными SQL/OS-сценариями.
    const connection = Object.assign(new EventEmitter(), {
      query: vi
        .fn()
        .mockResolvedValueOnce([[{ owned: 1 }]])
        .mockReturnValue(probe),
    });
    const result = runWithWorkerLock(
      connection as unknown as PoolConnection,
      "owned-fixture",
      async () => {
        await job;
        if (outcome === "failure") throw new Error("domain failure");
      },
    ).then(
      () => "success",
      (error: Error) => error.message,
    );
    let settled = false;
    void result.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(connection.query).toHaveBeenCalledTimes(2); // Нет очереди heartbeat.
    finishJob();
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false); // Соединение ещё нельзя вернуть в пул.
    failProbe(new Error("late transport failure"));
    expect(await result).toBe(
      outcome === "failure" ? "domain failure" : "success",
    );
    expect(connection.listenerCount("error")).toBe(0);
    expect(connection.listenerCount("end")).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  },
);
