import { fork, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";

/** Проверяем эксклюзивность и передачу фоновой задачи между двумя реальными процессами, пока второй HTTP остаётся доступным. */
describe.skipIf(!testDatabaseUrl)(
  "worker handover while another API stays online",
  () => {
    let conn: Connection;
    /** Создаём отдельную InnoDB probe-таблицу счётчика настоящих коммитов задания. */
    beforeAll(async () => {
      conn = await openTestDatabase();
      await conn.query(
        "CREATE TABLE backend_shutdown_probe (id INT PRIMARY KEY, commits INT NOT NULL) ENGINE=InnoDB",
      );
      await conn.query("INSERT INTO backend_shutdown_probe VALUES (1,0)");
    });
    /** Удаляем только служебную probe-таблицу одноразовой БД и закрываем соединение. */
    afterAll(async () => {
      await conn?.query("DROP TABLE IF EXISTS backend_shutdown_probe");
      await conn?.end();
    });

    /** Поднимаем отдельный loopback API с mysql-координацией, фиксируем exit и ждём готовность по IPC. */
    async function replica(children: ChildProcess[]) {
      const child = fork(
        resolve("tests/helpers/worker-shutdown-process.ts"),
        [],
        {
          execArgv: ["--import", import.meta.resolve("tsx")],
          stdio: ["ignore", "ignore", "ignore", "ipc"],
          env: {
            PATH: process.env.PATH,
            NODE_ENV: "test",
            DATABASE_URL: testDatabaseUrl,
            API_REPLICA_COUNT: "2",
            API_COORDINATION_MODE: "mysql",
            TSX_TSCONFIG_PATH: resolve("tsconfig.json"),
          },
        },
      );
      children.push(child);
      const exited = new Promise<{
        code: number | null;
        signal: string | null;
      }>((done) => {
        child.once("exit", (code, signal) => done({ code, signal }));
      });
      /** Ограниченно ждём один IPC-ответ, снимая подписки и таймер при успехе или смерти процесса. */
      function answer(
        timeout = 5000,
      ): Promise<{ base?: string; holding?: boolean; runs?: number }> {
        return new Promise((done, reject) => {
          const timer = setTimeout(
            () => finish(new Error("Replica reply timeout")),
            timeout,
          );
          /** Завершаем ожидание ошибкой, если процесс вышел раньше IPC-ответа. */
          const onExit = () => finish(new Error("Replica exited before reply"));
          /** Передаём полученный IPC-ответ общей функции очистки ожидания. */
          const onMessage = (message: object) => finish(undefined, message);
          /** Единой точкой снимаем таймер и события перед разрешением либо отклонением ожидания. */
          function finish(error?: Error, message?: object) {
            clearTimeout(timer);
            child.off("exit", onExit);
            child.off("message", onMessage);
            if (error) reject(error);
            else done(message!);
          }
          child.once("exit", onExit);
          child.once("message", onMessage);
        });
      }
      const ready = await answer(10000);
      expect(ready.base).toMatch(/^http:\/\/127\.0\.0\.1:/);
      return {
        child,
        exited,
        base: ready.base!,
        /** Подписываемся на ответ до отправки IPC-команды, закрывая гонку быстрого ответа. */
        ask(action: string) {
          const pending = answer();
          child.send({ action });
          return pending;
        },
      };
    }

    // Ловит раннее закрытие пула/lock до завершения job и отсутствие handover
    // после аварийного завершения. SQL-эффекты настоящие, отправки наружу нет.
    /** Сравниваем graceful drain, deadline и SIGKILL: пока владелец жив задача не дублируется, затем второй API получает lock и коммитит, сохраняя HTTP. */
    it.each(["drain", "deadline", "kill"] as const)(
      "preserves exclusivity and hands over after %s",
      async (mode) => {
        const children: ChildProcess[] = [];
        await conn.query(
          "UPDATE backend_shutdown_probe SET commits=0 WHERE id=1",
        );
        try {
          const a = await replica(children);
          const b = await replica(children);
          expect(await a.ask("start")).toEqual({ holding: true });
          expect(await b.ask("probe")).toEqual({ runs: 0 });
          if (mode !== "kill") {
            a.child.kill("SIGTERM");
            await vi.waitFor(
              async () => {
                await expect(
                  fetch(a.base + "/api/health", {
                    headers: { connection: "close" },
                    signal: AbortSignal.timeout(1000),
                  }),
                ).rejects.toThrow();
              },
              { timeout: 2000 },
            );
            expect(a.child.exitCode).toBeNull();
            expect(await b.ask("probe")).toEqual({ runs: 0 });
          }
          const response = await fetch(b.base + "/api/trpc/auth.me", {
            signal: AbortSignal.timeout(2000),
          });
          expect(response.status).toBe(200);
          expect(await response.json()).toMatchObject({
            result: { data: { json: null } },
          });
          if (mode === "drain") {
            a.child.kill("SIGTERM");
            a.child.send({ action: "release" });
          }
          if (mode === "kill") a.child.kill("SIGKILL");
          expect(await a.exited).toEqual({
            code: mode === "kill" ? null : mode === "drain" ? 0 : 1,
            signal: mode === "kill" ? "SIGKILL" : null,
          });
          const [before] = await conn.query<RowDataPacket[]>(
            "SELECT commits FROM backend_shutdown_probe WHERE id=1",
          );
          expect(before).toEqual([{ commits: mode === "drain" ? 1 : 0 }]);
          // После смерти процесса сервер MySQL может ещё освобождать соединение.
          await vi.waitFor(
            async () => expect(await b.ask("probe")).toEqual({ runs: 1 }),
            { timeout: 3000 },
          );
          const [after] = await conn.query<RowDataPacket[]>(
            "SELECT commits FROM backend_shutdown_probe WHERE id=1",
          );
          expect(after).toEqual([{ commits: mode === "drain" ? 2 : 1 }]);
          b.child.kill("SIGTERM");
          expect(await b.exited).toEqual({ code: 0, signal: null });
        } finally {
          await Promise.all(
            children.map((child) => {
              if (child.exitCode !== null || child.signalCode !== null) return;
              const stopped = new Promise<void>((done) =>
                child.once("exit", () => done()),
              );
              child.kill("SIGKILL");
              return stopped;
            }),
          );
        }
      },
      30000,
    );
  },
);
