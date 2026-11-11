import { fork, type ChildProcess } from "node:child_process";
import { resolve } from "node:path";
import { once } from "node:events";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { closeDb } from "../apps/backend/src/database/connection";
import {
  checkSharedRateLimit,
  beginSharedLogin,
} from "../apps/backend/src/database/shared-limits";
import {
  runExclusiveWorker,
  verifyApiCoordination,
} from "../apps/backend/src/database/coordination";

/** Проверяем общие квоты и владение задачами между настоящими отдельными OS-процессами с одноразовой MySQL. */
describe.skipIf(!testDatabaseUrl)(
  "shared API coordination on owned MySQL",
  () => {
    let conn: Connection;
    const children: ChildProcess[] = [];
    /** Требуем mysql-координацию двух API, выполняем startup probe и запрещаем запуск на уже занятых тестовых счётчиках. */
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      vi.stubEnv("API_REPLICA_COUNT", "2");
      vi.stubEnv("API_COORDINATION_MODE", "mysql");
      await verifyApiCoordination();
      // This suite owns the ephemeral counters in the separately disposable test DB.
      const [occupied] = await conn.query<RowDataPacket[]>(
        "SELECT keyHash FROM api_rate_limits LIMIT 1",
      );
      if (occupied.length)
        throw new Error("Coordination fixtures already occupied");
    });
    /** Сбрасываем только общую таблицу квот выделенной одноразовой БД между сценариями. */
    beforeEach(async () => {
      await conn.query("DELETE FROM api_rate_limits");
    });
    /** Убиваем оставшиеся дочерние процессы, очищаем свои счётчики, закрываем пул и окружение. */
    afterAll(async () => {
      for (const child of children)
        if (child.exitCode === null && child.signalCode === null)
          child.kill("SIGKILL");
      await conn?.query("DELETE FROM api_rate_limits");
      await conn?.end();
      await closeDb();
      vi.unstubAllEnvs();
    });
    /** Поднимаем независимый тестовый процесс с минимальным окружением и ждём IPC-ready с конечным таймаутом. */
    async function replica() {
      const child = fork(resolve("tests/helpers/coordination-process.ts"), [], {
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
      });
      children.push(child);
      const ready = await new Promise<{ base: string }>((done, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Replica startup timeout")),
          10000,
        );
        child.once("message", (message) => {
          clearTimeout(timer);
          done(message as { base: string });
        });
        child.once("exit", () => {
          clearTimeout(timer);
          reject(new Error("Replica exited before readiness"));
        });
      });
      return {
        child,
        base: ready.base,
        /** Отправляем одно действие по IPC и ограниченно ждём его ответ, не подменяя общие SQL-лимиты. */
        ask: (action: string, key = "shared-fixture") =>
          new Promise<unknown>((done, reject) => {
            const timer = setTimeout(
              () => reject(new Error("Replica action timeout")),
              5000,
            );
            child.once("message", (answer) => {
              clearTimeout(timer);
              done(answer);
            });
            child.send({ action, key });
          }),
      };
    }
    /** Обе реплики расходуют одно фиксированное окно, а не отдельные локальные остатки. */
    it("shares one fixed-window quota between independent OS processes", async () => {
      const a = await replica(),
        b = await replica();
      expect(await a.ask("rate", "one-global-key")).toEqual({ ok: true });
      expect(await b.ask("rate", "one-global-key")).toEqual({ ok: true });
      expect(await a.ask("rate", "one-global-key")).toMatchObject({
        ok: false,
      });
      expect(await b.ask("rate", "one-global-key")).toMatchObject({
        ok: false,
      });
    });
    /** Чередуем 22 настоящих login-запроса между listener: первые 20 неверных вводов, затем общий IP429 без cookie. */
    it("enforces the original HTTP login IP quota across two real API listeners", async () => {
      const a = await replica(),
        b = await replica();
      const results = [];
      for (let i = 0; i < 22; i++) {
        const response = await fetch((i % 2 ? a : b).base + "/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{}",
        });
        results.push(response.status);
        await response.arrayBuffer();
        expect(response.headers.get("set-cookie")).toBeNull();
      }
      expect(results.slice(0, 20)).toEqual(Array(20).fill(400));
      expect(results.slice(20)).toEqual([429, 429]);
    });
    /** Двенадцать конкурентных резервирований допускают ровно три, не превышая общую квоту. */
    it("atomically admits only the shared quota during a concurrent burst", async () => {
      const results = await Promise.all(
        Array.from({ length: 12 }, () =>
          checkSharedRateLimit("burst-synthetic", 3, 60_000),
        ),
      );
      expect(results.filter((result) => result.ok)).toHaveLength(3);
    });
    /** Разные реплики и регистр email делят одну задержку аккаунта; таблица содержит только хеш и счётчик. */
    it("shares account cooldown independently of IP/process", async () => {
      const a = await replica(),
        b = await replica();
      for (let i = 0; i < 5; i++)
        expect(
          await (i % 2 ? a : b).ask("login", "synthetic@example.invalid"),
        ).toEqual({ ok: true });
      expect(await b.ask("login", "SYNTHETIC@example.invalid")).toMatchObject({
        ok: false,
        retryAfterSec: 1,
      });
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT keyHash,generation,attempts FROM api_rate_limits",
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].keyHash).toMatch(/^[a-f0-9]{64}$/);
      expect(rows[0].attempts).toBe(5);
    });
    /** Поздний успех старой попытки не обнуляет уже увеличенный счётчик. */
    it("does not clear a newer reservation when an earlier login succeeds", async () => {
      const older = await beginSharedLogin("late@example.invalid");
      const newer = await beginSharedLogin("late@example.invalid");
      if (!older.ok || !newer.ok) throw new Error("Fixture not admitted");
      await older.succeeded();
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT attempts FROM api_rate_limits",
      );
      expect(rows).toEqual([{ attempts: 2 }]);
      await newer.succeeded();
      const [empty] = await conn.query<RowDataPacket[]>(
        "SELECT attempts FROM api_rate_limits",
      );
      expect(empty).toEqual([]);
    });
    /** Поколение отличает новое окно даже при одинаковом номере попытки. */
    it("does not let an old successful login clear a new window with the same attempt number", async () => {
      const older = await beginSharedLogin("window@example.invalid");
      await conn.query("UPDATE api_rate_limits SET expiresAt=0");
      const newer = await beginSharedLogin("window@example.invalid");
      if (!older.ok || !newer.ok) throw new Error("Fixture not admitted");
      await older.succeeded();
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT attempts FROM api_rate_limits",
      );
      expect(rows).toEqual([{ attempts: 1 }]);
      await newer.succeeded();
      const [empty] = await conn.query<RowDataPacket[]>(
        "SELECT attempts FROM api_rate_limits",
      );
      expect(empty).toEqual([]);
    });
    /** Истёкшее окно обновляется, заполнение до 10 тысяч не вытесняет активную квоту и запрещает новые ключи. */
    it("resets expired windows, retains live quotas and bounds counter growth", async () => {
      await checkSharedRateLimit("expiry-fixture", 1, 60_000);
      await conn.query("UPDATE api_rate_limits SET expiresAt=0");
      expect(await checkSharedRateLimit("expiry-fixture", 1, 60_000)).toEqual({
        ok: true,
      });
      await conn.query(
        "INSERT INTO api_rate_limits(kind,keyHash,attempts,expiresAt,nextAllowedAt,generation) SELECT 'rate',LPAD(HEX(a.id*100+b.id),64,'0'),1,9999999999999,0,'capacity' FROM JSON_TABLE(?, '$[*]' COLUMNS(id INT PATH '$')) a CROSS JOIN JSON_TABLE(?, '$[*]' COLUMNS(id INT PATH '$')) b WHERE a.id<>0 OR b.id<>0",
        [
          JSON.stringify(Array.from({ length: 100 }, (_, i) => i)),
          JSON.stringify(Array.from({ length: 100 }, (_, i) => i)),
        ],
      );
      expect((await checkSharedRateLimit("new-denied", 1, 60_000)).ok).toBe(
        false,
      );
      expect((await checkSharedRateLimit("expiry-fixture", 1, 60_000)).ok).toBe(
        false,
      );
    });
    /** Вторая реплика пропускает занятое имя задачи и получает исполнение после явного освобождения. */
    it("does not begin a worker on another replica until the holder finishes", async () => {
      const a = await replica(),
        b = await replica();
      expect(await a.ask("hold")).toEqual({ holding: true });
      expect(await b.ask("job")).toEqual({ runs: 0 });
      expect(await a.ask("release")).toEqual({ released: true });
      expect(await b.ask("job")).toEqual({ runs: 1 });
    });
    /** Убийство владельца и исключение callback освобождают named lock для следующей задачи. */
    it("releases the worker lock when its process dies or callback throws", async () => {
      const a = await replica(),
        b = await replica();
      await a.ask("hold");
      const exited = once(a.child, "exit");
      a.child.kill("SIGKILL");
      await exited;
      expect(await b.ask("job")).toEqual({ runs: 1 });
      await expect(
        runExclusiveWorker("throw-fixture", async () => {
          throw new Error("synthetic");
        }),
      ).rejects.toThrow("synthetic");
      let ran = false;
      await runExclusiveWorker("throw-fixture", async () => {
        ran = true;
      });
      expect(ran).toBe(true);
    });
    /** Отсутствие общей таблицы запрещает квоту и readiness; после возврата схемы общий режим восстанавливается. */
    it("fails closed when the common table is missing, then recovers", async () => {
      await conn.query(
        "RENAME TABLE api_rate_limits TO api_rate_limits_fixture_unavailable",
      );
      try {
        await expect(checkSharedRateLimit("failure", 1, 1000)).rejects.toThrow(
          "временно недоступен",
        );
        await expect(verifyApiCoordination()).rejects.toThrow(
          "временно недоступен",
        );
      } finally {
        await conn.query(
          "RENAME TABLE api_rate_limits_fixture_unavailable TO api_rate_limits",
        );
      }
      expect(await checkSharedRateLimit("failure", 1, 1000)).toEqual({
        ok: true,
      });
    });
  },
);
