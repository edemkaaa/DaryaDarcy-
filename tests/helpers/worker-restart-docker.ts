import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { buildSync } from "esbuild";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { assertTestDatabase } from "../../tooling/scripts/test-database-policy";

const docker = (args: string[]) => {
  // Ограничивает время Docker-команды и скрывает argv из ошибки, поскольку там есть тестовая строка подключения.

  try {
    return execFileSync("docker", args, {
      encoding: "utf8",
      timeout: 20000,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    // Не печатать argv: оно содержит пароль исключительно тестовой БД.
    throw new Error(`Docker fixture command failed: ${args[0]}`);
  }
};

function cleanupAfterFailure(error: unknown, cleanup: () => void): never {
  // Сохраняет первоначальный сбой и добавляет отказ уборки, чтобы утечка временных ресурсов не скрыла причину.

  try {
    cleanup();
  } catch (cleanupError) {
    throw new AggregateError(
      [error, cleanupError],
      "Docker fixture failed and cleanup also failed",
    );
  }
  throw error;
}

// Проверяем контейнер и URL до открытия SQL-соединения в тесте.
export function dockerRestartFixture(databaseUrl: string) {
  // До SQL проверяет Unix Docker endpoint, digest образа и принадлежность tmpfs-контейнера БД; рабочие volumes не допускаются.

  const database = process.env.WORKER_RESTART_MYSQL_CONTAINER!;
  const image = process.env.WORKER_RESTART_DOCKER_IMAGE!;
  const nativeModules = process.env.WORKER_RESTART_LINUX_MODULES!;
  if (
    !/^[a-f0-9]{64}$/.test(database) ||
    !/^node@sha256:[a-f0-9]{64}$/.test(image) ||
    !nativeModules
  )
    throw new Error(
      "Explicit local image, Linux modules and disposable MySQL required",
    );
  const url = assertTestDatabase(databaseUrl);
  const endpoint =
    !process.env.DOCKER_CONTEXT && process.env.DOCKER_HOST
      ? process.env.DOCKER_HOST
      : docker([
          "context",
          "inspect",
          "--format",
          "{{.Endpoints.docker.Host}}",
        ]);
  if (!endpoint.startsWith("unix://"))
    throw new Error("Docker fixture requires a local Unix socket");

  // Tmpfs, отсутствие mounts, owner label и опубликованный loopback порт совместно доказывают принадлежность одноразовой БД.
  const [meta] = JSON.parse(docker(["inspect", database]));
  const databaseOwner = meta.Config.Labels?.["codex.owner"];
  const bindings = meta.NetworkSettings.Ports?.["3306/tcp"];
  if (
    !databaseOwner?.startsWith("daryadarcy-fresh-backend-audit-") ||
    meta.Name !== `/${databaseOwner}` ||
    !meta.HostConfig.Tmpfs?.["/var/lib/mysql"] ||
    meta.Mounts.length !== 0 ||
    url.hostname !== "127.0.0.1" ||
    bindings?.length !== 1 ||
    bindings[0].HostIp !== url.hostname ||
    bindings[0].HostPort !== url.port
  )
    throw new Error(
      "Database URL must match the owned disposable MySQL container",
    );
  const owner = `darcy-worker-restart-${randomUUID()}`;
  const scratch = mkdtempSync(join(tmpdir(), owner));
  const containers = new Set<string>();
  let networkCreated = false;
  let databaseConnected = false;
  function removeContainer(name: string) {
    // Перед адресным удалением повторно сверяет owner label контейнера; глобального prune нет.

    const [state] = JSON.parse(docker(["inspect", name]));
    if (state.Config.Labels?.["codex.owner"] !== owner)
      throw new Error("Container ownership changed");
    docker(["rm", "-f", name]);
    containers.delete(name);
  }
  function cleanup() {
    // Независимо пытается убрать свои контейнеры, сеть и каталог, собирая ошибки вместо прекращения уборки на первой.

    const errors: unknown[] = [];
    function attempt(step: () => void) {
      // Позволяет всем этапам уборки выполниться, сохранив каждый отказ для итогового AggregateError.

      try {
        step();
      } catch (error) {
        errors.push(error);
      }
    }
    for (const name of containers) attempt(() => removeContainer(name));
    if (databaseConnected)
      attempt(() => {
        docker(["network", "disconnect", owner, database]);
        databaseConnected = false;
      });
    if (networkCreated)
      attempt(() => {
        const [network] = JSON.parse(docker(["network", "inspect", owner]));
        if (network.Labels?.["codex.owner"] !== owner)
          throw new Error("Network ownership changed");
        docker(["network", "rm", owner]);
        networkCreated = false;
      });
    attempt(() => rmSync(scratch, { recursive: true, force: true }));
    if (errors.length)
      throw new AggregateError(errors, "Docker fixture cleanup failed");
  }
  // Сборка probe и отдельная сеть создаются лишь после guards; любая ошибка запускает адресную уборку собственных ресурсов.
  try {
    buildSync({
      entryPoints: [resolve("tests/helpers/worker-restart-process.ts")],
      bundle: true,
      platform: "node",
      packages: "external",
      format: "esm",
      outfile: join(scratch, "fixture.mjs"),
    });
    docker(["network", "create", "--label", `codex.owner=${owner}`, owner]);
    networkCreated = true;
    docker(["network", "connect", "--alias", "fixture-mysql", owner, database]);
    databaseConnected = true;
  } catch (error) {
    cleanupAfterFailure(error, cleanup);
  }
  url.hostname = "fixture-mysql";
  url.port = "3306";
  return {
    cleanup,
    async launch(actor: string, restart: boolean, control: Connection) {
      // Создаёт ограниченную read-only реплику с явной restart policy и монтирует только probe и необходимые зависимости.

      const name = `${owner}-${actor}-${randomUUID().slice(0, 8)}`;
      // create/start отдельно: даже ошибка запуска оставляет известный объект
      // для адресной уборки; никакого глобального prune.
      docker([
        "create",
        "--name",
        name,
        "--pull=never",
        "--label",
        `codex.owner=${owner}`,
        "--network",
        owner,
        "--restart",
        restart ? "unless-stopped" : "no",
        "--init",
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--memory=384m",
        "--cpus=1",
        "--log-driver=none",
        "-p",
        "127.0.0.1::3000",
        "-w",
        "/app",
        "--mount",
        `type=bind,src=${resolve("node_modules")},dst=/app/node_modules,readonly`,
        "--mount",
        `type=bind,src=${join(scratch, "fixture.mjs")},dst=/app/fixture.mjs,readonly`,
        "--mount",
        `type=bind,src=${resolve(nativeModules)},dst=/native,readonly`,
        "-e",
        "NODE_ENV=test",
        "-e",
        `DATABASE_URL=${url.href}`,
        "-e",
        "NODE_PATH=/native",
        "-e",
        "API_COORDINATION_MODE=mysql",
        "-e",
        "API_REPLICA_COUNT=2",
        "-e",
        `FIXTURE_ACTOR=${actor}`,
        "-e",
        "WORKER_RESTART_CONTAINER=1",
        image,
        "node",
        "/app/fixture.mjs",
      ]);
      containers.add(name);
      // Модуль лежит рядом с node_modules для стандартного ESM resolution.
      // Корень проекта и файлы секретов не передаются.
      try {
        docker(["start", name]);
        let current: { base: string; boot: string; generation: number };
        let restarts = 0;
        const since = new Date(Date.now() - 1000).toISOString();
        async function refresh() {
          // После рестарта заново читает случайный host port и поколение запуска; OOM не считается корректной реакцией на потерю lease.

          // Docker может назначить новый случайный host port после рестарта.
          // Внутренний 3000 постоянен; edge routing этот локальный тест не заменяет.
          const port = docker(["port", name, "3000/tcp"]).split(":").at(-1)!;
          const base = `http://127.0.0.1:${port}`;
          const response = await fetch(base + "/api/trpc/auth.me", {
            signal: AbortSignal.timeout(2000),
          });
          if (!response.ok) throw new Error("Docker API not ready");
          await response.arrayBuffer();
          const [boots] = await control.query<RowDataPacket[]>(
            "SELECT boot FROM backend_restart_boots WHERE actor=? ORDER BY id",
            [actor],
          );
          if (!boots.length) throw new Error("Missing fixture boot");
          current = {
            base,
            boot: boots.at(-1)!.boot,
            generation: boots.length,
          };
          const [state] = JSON.parse(docker(["inspect", name]));
          if (state.State.OOMKilled)
            throw new Error("Fixture OOM, not lock-loss exit");
          restarts = state.RestartCount;
        }
        const deadline = Date.now() + 20000;
        while (true) {
          try {
            await refresh();
            break;
          } catch (error) {
            if (Date.now() > deadline) throw error;
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
        // Docker документирует активацию restart policy после 10 секунд работы.
        const [state] = JSON.parse(docker(["inspect", name]));
        const remaining =
          10100 - (Date.now() - Date.parse(state.State.StartedAt));
        if (remaining > 0)
          await new Promise((resolve) => setTimeout(resolve, remaining));
        return {
          refresh,
          get current() {
            // Возвращает последнее проверенное поколение API, а не адрес первого запуска контейнера.

            return current;
          },
          get restarts() {
            // Счётчик берётся из Docker inspect после проверки нового поколения.

            return restarts;
          },
          get exits() {
            // Читает только события завершения собственного контейнера за время сценария.

            const lines = docker([
              "events",
              "--since",
              since,
              "--until",
              new Date().toISOString(),
              "--filter",
              `container=${name}`,
              "--filter",
              "event=die",
              "--format",
              "{{json .}}",
            ]);
            return lines
              ? lines.split("\n").map((line) => ({
                  code: Number(JSON.parse(line).Actor.Attributes.exitCode),
                  signal: null,
                }))
              : [];
          },
          stop: async () => /* Адресно удаляет проверенный собственный контейнер через общий ownership guard. */ removeContainer(name),
        };
      } catch (error) {
        cleanupAfterFailure(error, () => removeContainer(name));
      }
    },
  };
}
