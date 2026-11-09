import { fork, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  createConnection,
  type Connection,
  type RowDataPacket,
} from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { dockerRestartFixture } from "./helpers/worker-restart-docker";

type Ready = { base: string; boot: string; generation: number };

// Тестовый supervisor, не замена Docker/systemd. Он автоматически перезапускает
// отдельный OS-процесс после exit(1); production entrypoint/инфраструктуру не меняем.
async function supervisedReplica(actor: string, restart: boolean) {
  const children: ChildProcess[] = [];
  const exits: { code: number | null; signal: string | null }[] = [];
  let stopping = false;
  let restarts = 0;
  let failure: Error | undefined;
  let current: Ready | undefined;
  let pending: Promise<Ready>;
  function launch(): Promise<Ready> {
    const child = fork(resolve("tests/helpers/worker-restart-process.ts"), [], {
      execArgv: ["--import", import.meta.resolve("tsx")],
      stdio: ["ignore", "ignore", "ignore", "ipc"],
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "test",
        DATABASE_URL: testDatabaseUrl,
        API_COORDINATION_MODE: "mysql",
        API_REPLICA_COUNT: "2",
        FIXTURE_ACTOR: actor,
        TSX_TSCONFIG_PATH: resolve("tsconfig.json"),
      },
    });
    children.push(child);
    child.once("exit", (code, signal) => {
      exits.push({ code, signal });
      if (!stopping && restart && code === 1 && restarts < 2) {
        restarts++;
        pending = launch();
        void pending.catch((error) => {
          failure = error;
        });
      }
    });
    return new Promise((done, reject) => {
      const timer = setTimeout(
        () => finish(new Error("Fixture startup timeout")),
        10000,
      );
      const onExit = () => finish(new Error("Fixture exited before readiness"));
      const onReady = (value: Ready) => finish(undefined, value);
      function finish(error?: Error, value?: Ready) {
        clearTimeout(timer);
        child.off("exit", onExit);
        child.off("message", onReady);
        if (error) reject(error);
        else {
          current = value;
          done(value!);
        }
      }
      child.once("exit", onExit);
      child.once("message", onReady);
    });
  }
  async function stop() {
    stopping = true;
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
    await Promise.allSettled([pending]);
  }
  pending = launch();
  try {
    await pending;
  } catch (error) {
    await stop();
    throw error;
  }
  return {
    async refresh() {},
    get current() {
      if (failure) throw failure;
      return current!;
    },
    get restarts() {
      return restarts;
    },
    exits,
    stop,
  };
}

describe.skipIf(!testDatabaseUrl)(
  "API worker recovery after automatic process restart",
  () => {
    let conn: Connection;
    let lockName: string;
    let containerFixture:
      | Awaited<ReturnType<typeof dockerRestartFixture>>
      | undefined;
    async function health(base: string) {
      const response = await fetch(base + "/api/trpc/auth.me", {
        signal: AbortSignal.timeout(2000),
      });
      expect(response.status).toBe(200);
      await response.arrayBuffer();
    }
    async function phase(boot: string, value: string) {
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT COUNT(*) AS n FROM backend_restart_events WHERE boot=? AND phase=?",
        [boot, value],
      );
      return Number(rows[0].n);
    }
    beforeAll(async () => {
      conn = await openTestDatabase();
      await conn.query(
        "CREATE TABLE backend_restart_boots(id INT AUTO_INCREMENT PRIMARY KEY,actor VARCHAR(10),boot VARCHAR(36))",
      );
      await conn.query(
        "CREATE TABLE backend_restart_events(id INT AUTO_INCREMENT PRIMARY KEY,actor VARCHAR(10),boot VARCHAR(36),phase VARCHAR(20))",
      );
      await conn.query(
        "CREATE TABLE backend_restart_work(id INT PRIMARY KEY,commits INT NOT NULL DEFAULT 0,actor VARCHAR(10),boot VARCHAR(36)) ENGINE=InnoDB",
      );
      const [rows] = await conn.query<RowDataPacket[]>(
        "SELECT DATABASE() AS db",
      );
      lockName = createHash("sha256")
        .update(
          JSON.stringify([
            "darcy-coordination-v1",
            rows[0].db,
            "worker:publication",
          ]),
        )
        .digest("hex");
      if (process.env.WORKER_RESTART_DOCKER_IMAGE)
        containerFixture = await dockerRestartFixture(testDatabaseUrl!, conn);
    });
    beforeEach(async () => {
      for (const table of [
        "backend_restart_events",
        "backend_restart_boots",
        "backend_restart_work",
      ])
        await conn.query(`DELETE FROM ${table}`);
      await conn.query("INSERT INTO backend_restart_work(id) VALUES(1)");
    });
    afterAll(async () => {
      await containerFixture?.cleanup();
      for (const table of [
        "backend_restart_events",
        "backend_restart_boots",
        "backend_restart_work",
      ])
        await conn?.query(`DROP TABLE IF EXISTS ${table}`);
      await conn?.end();
    });
    it.each([false, true])(
      "resumes publication after restart (lock occupied on restart: %s)",
      async (occupied) => {
        const replicas: Awaited<ReturnType<typeof supervisedReplica>>[] = [];
        let contender: Connection | undefined;
        try {
          const launch = containerFixture?.launch ?? supervisedReplica;
          const a = await launch("a", true);
          replicas.push(a);
          const b = await launch("b", false);
          replicas.push(b);
          const first = a.current;
          expect(first.generation).toBe(1);
          await vi.waitFor(
            async () => expect(await phase(first.boot, "entered")).toBe(1),
            { timeout: 5000 },
          );
          const [owners] = await conn.query<RowDataPacket[]>(
            "SELECT IS_USED_LOCK(?) AS owner",
            [lockName],
          );
          const id = Number(owners[0].owner);
          if (!Number.isSafeInteger(id) || id <= 0)
            throw new Error("Missing owned fixture lock");
          contender = occupied
            ? await createConnection(testDatabaseUrl!)
            : undefined;
          let wait: Promise<unknown> | undefined;
          if (contender) {
            wait = contender.query("SELECT GET_LOCK(?,10) AS acquired", [
              lockName,
            ]);
            void wait.catch(() => {});
            const waitingId = contender.threadId;
            await vi.waitFor(
              async () => {
                const [rows] = await conn.query<RowDataPacket[]>(
                  "SELECT STATE FROM information_schema.PROCESSLIST WHERE ID=?",
                  [waitingId],
                );
                expect(rows[0]?.STATE).toBe("User lock");
              },
              { timeout: 3000 },
            );
          }
          await conn.query(`KILL CONNECTION ${id}`);
          if (wait)
            expect(((await wait) as RowDataPacket[][])[0][0].acquired).toBe(1);
          await vi.waitFor(
            async () => {
              await a.refresh();
              expect(a.restarts).toBe(1);
              expect(a.current.generation).toBe(2);
              await health(a.current.base);
            },
            { timeout: 15000, interval: 100 },
          );
          expect(a.exits).toEqual([{ code: 1, signal: null }]);
          await b.refresh();
          await health(b.current.base);
          expect(b.restarts).toBe(0);
          const second = a.current;
          expect(second.boot).not.toBe(first.boot);
          if (contender) {
            await vi.waitFor(
              async () => expect(await phase(second.boot, "settled")).toBe(1),
              { timeout: 5000 },
            );
            expect(await phase(second.boot, "entered")).toBe(0);
            const [before] = await conn.query<RowDataPacket[]>(
              "SELECT commits FROM backend_restart_work WHERE id=1",
            );
            expect(before[0].commits).toBe(0); // Первая незавершённая транзакция откатилась.
            await contender.query("SELECT RELEASE_LOCK(?)", [lockName]);
          }
          // Не меняем часы: ждём настоящий следующий 60-секундный тик WorkerJobs.
          await vi.waitFor(
            async () => expect(await phase(second.boot, "completed")).toBe(1),
            { timeout: occupied ? 70000 : 5000, interval: 250 },
          );
          const [work] = await conn.query<RowDataPacket[]>(
            "SELECT commits,actor,boot FROM backend_restart_work WHERE id=1",
          );
          expect(work).toEqual([{ commits: 1, actor: "a", boot: second.boot }]);
          expect(await phase(first.boot, "completed")).toBe(0);
          await a.refresh();
          await b.refresh();
          expect(a.restarts).toBe(1);
          expect(b.restarts).toBe(0);
          expect(b.current.generation).toBe(1);
          await health(a.current.base);
          await health(b.current.base);
        } finally {
          await contender?.end();
          await Promise.all(replicas.map((replica) => replica.stop()));
        }
      },
      125000,
    );
  },
);
