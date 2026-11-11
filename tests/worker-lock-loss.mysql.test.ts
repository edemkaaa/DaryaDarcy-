import { fork, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { connect, createServer, type AddressInfo, type Socket } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";

// Только loopback-транспорт одноразовой БД. Позволяет потерять серверную
// сессию, не доставляя клиенту FIN/error: должен сработать timeout проверки.
/** Создаёт только loopback MySQL-прокси для тихого обрыва транспорта без FIN или socket error клиенту. */
async function blackholeProxy() {
  const target = new URL(testDatabaseUrl!);
  if (!["127.0.0.1", "localhost"].includes(target.hostname))
    throw new Error("Fault injection requires loopback MySQL");
  const upstreamHost = target.hostname;
  const upstreamPort = Number(target.port || 3306);
  let silent = false;
  const sockets = new Set<Socket>();
  const server = createServer((client) => {
    const upstream = connect(upstreamPort, upstreamHost);
    for (const socket of [client, upstream]) {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
      socket.on("error", () => {});
    }
    client.on("data", (data) => {
      if (!silent) upstream.write(data);
    });
    upstream.on("data", (data) => {
      if (!silent) client.write(data);
    });
    client.on("close", () => upstream.destroy());
    upstream.on("close", () => {
      if (!silent) client.destroy();
    });
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  target.hostname = "127.0.0.1";
  target.port = String((server.address() as AddressInfo).port);
  return {
    url: target.toString(),
    /** Перестаёт передавать байты обоих направлений, оставляя клиентский socket открытым для проверки guard-timeout. */
    drop() {
      silent = true;
    },
    /** Уничтожает только сокеты прокси и закрывает его локальный listener. */
    async close() {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((done) => server.close(() => done()));
    },
  };
}

/** Проверяет остановку API-процесса при потере именованной блокировки активной фоновой задачи. */
describe.skipIf(!testDatabaseUrl)("running worker loses its named lock", () => {
  let conn: Connection;
  let lockName: string;
  /** Создаёт собственную таблицу эффектов и вычисляет lock namespace по реальному имени одноразовой БД. */
  beforeAll(async () => {
    conn = await openTestDatabase();
    const [rows] = await conn.query<RowDataPacket[]>("SELECT DATABASE() AS db");
    lockName = createHash("sha256")
      .update(
        JSON.stringify([
          "darcy-coordination-v1",
          rows[0].db,
          "worker:lock-loss-fixture",
        ]),
      )
      .digest("hex");
    await conn.query(
      "CREATE TABLE backend_lock_loss_effects(id INT AUTO_INCREMENT PRIMARY KEY,actor VARCHAR(20) NOT NULL) ENGINE=InnoDB",
    );
  });
  /** Очищает только собственные эффекты предыдущего сценария. */
  beforeEach(async () => {
    await conn.query("DELETE FROM backend_lock_loss_effects");
  });
  /** Удаляет только тестовую таблицу эффектов и закрывает соединение. */
  afterAll(async () => {
    await conn?.query("DROP TABLE IF EXISTS backend_lock_loss_effects");
    await conn?.end();
  });
  /** Запускает отдельный API-процесс с минимальным тестовым окружением и ожидает готовность по IPC. */
  async function replica(
    actor: string,
    children: ChildProcess[],
    url = testDatabaseUrl,
  ) {
    const child = fork(
      resolve("tests/helpers/worker-lock-loss-process.ts"),
      [],
      {
        execArgv: ["--import", import.meta.resolve("tsx")],
        stdio: ["ignore", "ignore", "ignore", "ipc"],
        env: {
          PATH: process.env.PATH,
          NODE_ENV: "test",
          DATABASE_URL: url,
          API_REPLICA_COUNT: "2",
          API_COORDINATION_MODE: "mysql",
          FIXTURE_ACTOR: actor,
          TSX_TSCONFIG_PATH: resolve("tsconfig.json"),
        },
      },
    );
    children.push(child);
    const exited = new Promise<{ code: number | null; signal: string | null }>(
      (done) => child.once("exit", (code, signal) => done({ code, signal })),
    );
    /** Ожидает единственный IPC-ответ с deadline и обработкой преждевременного exit. */
    function answer(timeout = 5000): Promise<{
      base?: string;
      connectionId?: number;
      holding?: boolean;
      runs?: number;
      released?: boolean;
      unlocked?: boolean;
    }> {
      return new Promise((done, reject) => {
        /** Преобразует преждевременный exit реплики в ошибку ожидающего IPC-запроса. */
        const onExit = () => finish(new Error("Replica exited before reply"));
        /** Передаёт полученный IPC-ответ общему завершителю ожидания. */
        const onMessage = (value: object) => finish(undefined, value);
        const timer = setTimeout(
          () => finish(new Error("Replica reply timeout")),
          timeout,
        );
        /** Снимает таймер и IPC/exit listeners перед resolve или reject. */
        function finish(error?: Error, value?: object) {
          clearTimeout(timer);
          child.off("exit", onExit);
          child.off("message", onMessage);
          if (error) reject(error);
          else done(value!);
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
      /** Подписывается на ответ до отправки IPC-команды, исключая потерю быстрого ответа. */
      ask(action: string) {
        const p = answer();
        child.send({ action });
        return p;
      },
    };
  }
  /** Сверяет соединение с текущим владельцем именно fixture-lock перед адресным KILL CONNECTION. */
  async function killOwnedLock(id: number) {
    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT IS_USED_LOCK(?) AS owner",
      [lockName],
    );
    expect(rows[0].owner).toBe(id);
    if (!Number.isSafeInteger(id) || id <= 0)
      throw new Error("Invalid fixture connection");
    await conn.query(`KILL CONNECTION ${id}`);
  }
  /** Ограничивает ожидание выхода процесса и всегда снимает вспомогательный таймер. */
  async function waitForExit(exited: Promise<unknown>, timeout = 2500) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        exited,
        new Promise<null>((done) => {
          timer = setTimeout(() => done(null), timeout);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  /** Завершает только оставшиеся дочерние процессы suite и ждёт их exit. */
  async function cleanup(children: ChildProcess[]) {
    await Promise.all(
      children.map((child) => {
        if (child.exitCode !== null || child.signalCode !== null) return;
        const done = new Promise<void>((resolve) =>
          child.once("exit", () => resolve()),
        );
        child.kill("SIGKILL");
        return done;
      }),
    );
  }
  /** Потерявший lock процесс выходит до продолжения старой задачи, а вторая реплика выполняет единственный эффект. */
  it.each(["connection-killed", "lock-released"])(
    "stops the old process before it can resume stale work after %s",
    async (mode) => {
      const children: ChildProcess[] = [];
      try {
        const a = await replica("a", children),
          b = await replica("b", children);
        const held = await a.ask("hold");
        expect(held.holding).toBe(true);
        expect(await b.ask("probe")).toEqual({ runs: 0 });
        if (mode === "connection-killed")
          await killOwnedLock(held.connectionId!);
        else expect(await a.ask("unlock")).toEqual({ unlocked: true });
        const exit = await waitForExit(a.exited);
        expect(await b.ask("probe")).toEqual({ runs: 1 });
        // В RED даём старому callback продолжиться: это доказывает эффект после
        // потери lock, а не просто несовпадение ожидаемого кода завершения.
        if (exit === null)
          expect(await a.ask("release")).toEqual({ released: true });
        const [effects] = await conn.query<RowDataPacket[]>(
          "SELECT actor FROM backend_lock_loss_effects ORDER BY id",
        );
        expect(effects).toEqual([{ actor: "b" }]);
        expect(exit).toEqual({ code: 1, signal: null });
        const response = await fetch(b.base + "/api/trpc/auth.me", {
          signal: AbortSignal.timeout(2000),
        });
        expect(response.status).toBe(200);
        await response.arrayBuffer();
      } finally {
        await cleanup(children);
      }
    },
    20000,
  );
  /** После нормального окончания guard снят: сбой idle-соединения не завершает здоровый API. */
  it("removes the guard after normal completion so a later idle connection failure does not kill the API", async () => {
    const children: ChildProcess[] = [];
    try {
      const a = await replica("a", children);
      const held = await a.ask("hold");
      expect(await a.ask("release")).toEqual({ released: true });
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT IS_USED_LOCK(?) AS owner",
        [lockName],
      );
      expect(rows[0].owner).toBeNull();
      const id = held.connectionId!;
      if (!Number.isSafeInteger(id) || id <= 0)
        throw new Error("Invalid fixture connection");
      await conn.query(`KILL CONNECTION ${id}`);
      expect(await a.ask("probe")).toEqual({ runs: 1 });
      expect(a.child.exitCode).toBeNull();
    } finally {
      await cleanup(children);
    }
  }, 15000);
  /** Тихий сетевой blackhole обнаруживается guard-timeout; вторая реплика остаётся доступна и выполняет эффект одна. */
  it("stops on a silent transport timeout while another API remains available", async () => {
    const children: ChildProcess[] = [];
    const proxy = await blackholeProxy();
    try {
      const a = await replica("a", children, proxy.url);
      const b = await replica("b", children);
      const held = await a.ask("hold");
      proxy.drop();
      await killOwnedLock(held.connectionId!);
      // Вторая реплика работает даже до обнаружения сбоя первой.
      expect(await b.ask("probe")).toEqual({ runs: 1 });
      expect(await waitForExit(a.exited, 6000)).toEqual({
        code: 1,
        signal: null,
      });
      const [effects] = await conn.query<RowDataPacket[]>(
        "SELECT actor FROM backend_lock_loss_effects ORDER BY id",
      );
      expect(effects).toEqual([{ actor: "b" }]);
      expect(
        (
          await fetch(b.base + "/api/trpc/auth.me", {
            signal: AbortSignal.timeout(2000),
          })
        ).status,
      ).toBe(200);
    } finally {
      await cleanup(children);
      await proxy.close();
    }
  }, 20000);
});
