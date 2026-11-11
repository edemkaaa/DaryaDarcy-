// Собирает изолированный стенд редакторов и запускает выбранный сквозной сценарий. Созданные процессы и временные ресурсы принадлежат только этому прогону.
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import {
  mkdtemp,
  mkdir,
  cp,
  symlink,
  writeFile,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";
import { randomUUID } from "node:crypto";
import {
  normalGuestFlags,
  assertNormalGuestBuild,
} from "./normal-guest-profile.mjs";

// Explicit opt-in: owns its Docker container, empty schema and temporary Next copy.
// No environment files, background jobs, production credentials or remote services.
const root = fileURLToPath(new URL("../../", import.meta.url));
const profile = process.argv[2] ?? "editors";
if (
  !["editors", "recovery", "checkout"].includes(profile) ||
  process.argv.length > 3
)
  throw new Error("Expected editors, recovery or checkout acceptance profile");
const recovery = profile === "recovery";
const checkout = profile === "checkout";
const temp = await mkdtemp(join(tmpdir(), "darcy-editor-acceptance-"));
const container = `daryadarcy-fresh-editor-${randomUUID()}`;
const fixtureFile = join(temp, "fixture.json");
const children = new Set();
const env = {
  PATH: process.env.PATH,
  NODE_ENV: "test",
  NODE_OPTIONS: "--max-old-space-size=1536",
  UV_THREADPOOL_SIZE: "1",
  NEXT_TELEMETRY_DISABLED: "1",
  CIRCLE_NODE_TOTAL: "2",
};
let owned = false;
let closing;
let memoryTimer;
let peakUsed = 0;
const memoryLimit = 13_200_000_000;
async function usedMemory() {
  const info = await readFile("/proc/meminfo", "utf8");
  const total = Number(info.match(/^MemTotal:\s+(\d+)/m)?.[1]) * 1024;
  const available = Number(info.match(/^MemAvailable:\s+(\d+)/m)?.[1]) * 1024;
  if (!Number.isFinite(total - available))
    throw new Error("Cannot monitor host memory");
  peakUsed = Math.max(peakUsed, total - available);
  return total - available;
}
function launch(command, args, extra = {}, cwd = root) {
  const child = spawn(command, args, {
    cwd,
    env: { ...env, ...extra },
    detached: true,
    stdio: "inherit",
  });
  children.add(child);
  child.once("exit", () => children.delete(child));
  return child;
}
async function run(command, args, extra, cwd) {
  const child = launch(command, args, extra, cwd);
  const [code, signal] = await once(child, "exit");
  if (code !== 0)
    throw new Error(
      `Acceptance command failed (${code ?? signal}): ${command}`,
    );
}
async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
async function waitFor(probe, child, label) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child && (child.exitCode !== null || child.signalCode !== null))
      throw new Error(`${label} exited before readiness`);
    try {
      if (await probe()) return;
    } catch {
      /* still starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${label} readiness timed out`);
}
async function cleanup() {
  return (closing ??= (async () => {
    clearInterval(memoryTimer);
    for (const child of children) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch {
        /* already gone */
      }
    }
    await Promise.all(
      [...children].map(async (child) => {
        const timeout = setTimeout(() => {
          try {
            process.kill(-child.pid, "SIGKILL");
          } catch {
            /* already gone */
          }
        }, 3000);
        try {
          await once(child, "exit");
        } finally {
          clearTimeout(timeout);
        }
      }),
    );
    if (owned) {
      const state = JSON.parse(
        execFileSync("docker", ["inspect", container], { encoding: "utf8" }),
      )[0];
      console.log(
        `Own MySQL: OOMKilled=${state.State.OOMKilled}, restarts=${state.RestartCount}`,
      );
      execFileSync("docker", ["rm", "--force", container], { stdio: "ignore" });
    }
    if (!basename(temp).startsWith("darcy-editor-acceptance-"))
      throw new Error("Temporary scope changed");
    await rm(temp, { recursive: true, force: true });
    console.log(
      `Peak host used RAM: ${(peakUsed / 1e9).toFixed(3)} GB; limit ${(memoryLimit / 1e9).toFixed(1)} GB.`,
    );
  })());
}
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    void cleanup().finally(() => process.exit(130));
  });
}
try {
  if ((await usedMemory()) >= memoryLimit)
    throw new Error("Memory threshold reached before starting");
  memoryTimer = setInterval(() => {
    void usedMemory()
      .then((used) => {
        if (!closing && used >= memoryLimit) {
          console.error("Host memory threshold reached; stopping acceptance.");
          void cleanup().finally(() => process.exit(125));
        }
      })
      .catch((error) => {
        console.error(error);
        void cleanup().finally(() => process.exit(125));
      });
  }, 250);
  // Require an existing image rather than downloading or changing Docker services.
  execFileSync("docker", ["image", "inspect", "mysql:8.4"], {
    stdio: "ignore",
  });
  const password = randomUUID();
  const containerId = execFileSync(
    "docker",
    [
      "create",
      "--name",
      container,
      "--label",
      `codex.owner=${container}`,
      "--memory=768m",
      "--memory-swap=768m",
      "--cpus=1",
      "--pids-limit=128",
      "--tmpfs",
      "/var/lib/mysql:rw,size=512m",
      "--publish",
      "127.0.0.1::3306",
      "--env",
      `MYSQL_ROOT_PASSWORD=${password}`,
      "--env",
      "MYSQL_ROOT_HOST=%",
      "--env",
      "MYSQL_DATABASE=backend_test",
      "mysql:8.4",
      "--innodb-buffer-pool-size=64M",
      "--performance-schema=OFF",
      "--max-connections=32",
      "--innodb-redo-log-capacity=64M",
    ],
    { encoding: "utf8" },
  ).trim();
  owned = true;
  execFileSync("docker", ["start", container], { stdio: "ignore" });
  const port = Number(
    execFileSync("docker", ["port", container, "3306/tcp"], {
      encoding: "utf8",
    })
      .trim()
      .split(":")
      .at(-1),
  );
  const databaseUrl = `mysql://root:${password}@127.0.0.1:${port}/backend_test`;
  const { createConnection } = await import("mysql2/promise");
  await waitFor(
    async () => {
      const connection = await createConnection({
        uri: databaseUrl,
        connectTimeout: 1000,
      });
      await connection.end();
      return true;
    },
    undefined,
    "Own MySQL",
  );
  console.log("Own disposable MySQL ready (768 MiB cap).");
  await run(
    process.execPath,
    [
      "--import",
      "tsx",
      "tooling/scripts/fresh-database.ts",
      "--initialize-empty-local",
    ],
    {
      FRESH_DATABASE_URL: databaseUrl,
      FRESH_DATABASE_CONTAINER_ID: containerId,
    },
  );
  const webPort = await freePort();
  const origin = `http://127.0.0.1:${webPort}`;
  await writeFile(
    fixtureFile,
    JSON.stringify({ databaseUrl, origin, password: randomUUID(), profile }),
    { mode: 0o600 },
  );
  const api = launch(
    process.execPath,
    ["--import", "tsx", "tests/helpers/content-editor-acceptance-api.ts"],
    {
      DARYADARCY_EDITOR_FIXTURE_FILE: fixtureFile,
      DATABASE_URL: databaseUrl,
      JWT_SECRET: randomUUID() + randomUUID(),
      PUBLIC_APP_URL: origin,
      ...(recovery ? { DARYADARCY_RECOVERY_ACCEPTANCE: "true" } : {}),
      ...(checkout ? { DARYADARCY_CHECKOUT_ACCEPTANCE: "true" } : {}),
    },
  );
  await waitFor(
    async () => JSON.parse(await readFile(fixtureFile, "utf8")).api,
    api,
    "Own API",
  );
  const fixture = JSON.parse(await readFile(fixtureFile, "utf8"));
  const directory = join(temp, "apps/frontend");
  await mkdir(directory, { recursive: true });
  for (const name of [
    "src",
    "package.json",
    "next.config.mjs",
    "next.config.d.mts",
    "tsconfig.json",
    "private-library-assets.json",
    "image-variants.json",
    "AGENTS.md",
  ]) {
    await cp(join(root, "apps/frontend", name), join(directory, name), {
      recursive: true,
    });
  }
  await symlink(join(root, "node_modules"), join(temp, "node_modules"));
  await symlink(join(root, "packages"), join(temp, "packages"));
  await symlink(join(root, "apps/frontend/public"), join(directory, "public"));
  const webEnv = {
    NODE_ENV: "production",
    API_PROXY_TARGET: fixture.api,
    NEXT_PUBLIC_API_BASE_URL: "",
    NEXT_PUBLIC_PRODAMUS_TEST_ENABLED: "false",
    NEXT_PUBLIC_CLUB_TEST_CHECKOUT: "false",
    NEXT_PUBLIC_NORMAL_CHECKOUT_RECOVERY_ENABLED: "false",
    NEXT_PUBLIC_GUEST_CHECKOUT_RECOVERY_ENABLED: "false",
    NEXT_PUBLIC_VK_CATALOG_ENABLED: String(recovery),
    NEXT_PUBLIC_PRIVATE_LIBRARY_FILES_ENABLED: "false",
    ...(checkout ? normalGuestFlags : {}),
  };
  await run(
    process.execPath,
    [join(root, "node_modules/next/dist/bin/next"), "build", "--webpack"],
    webEnv,
    directory,
  );
  if (checkout)
    assertNormalGuestBuild(
      JSON.parse(
        await readFile(
          join(directory, ".next/required-server-files.json"),
          "utf8",
        ),
      ),
    );
  const web = launch(
    process.execPath,
    [
      join(root, "node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(webPort),
    ],
    webEnv,
    directory,
  );
  await waitFor(
    async () =>
      (
        await fetch(`${origin}/api/health`, {
          signal: AbortSignal.timeout(1000),
        })
      ).ok,
    web,
    "Own production web/API",
  );
  const output = join(root, `apps/frontend/test-results/real-${profile}`);
  await run(
    process.execPath,
    [
      join(root, "node_modules/@playwright/test/cli.js"),
      "test",
      "--config",
      `playwright.real-${profile}.config.ts`,
      ...(process.env.DARYADARCY_EDITOR_GREP
        ? ["--grep", process.env.DARYADARCY_EDITOR_GREP]
        : []),
    ],
    {
      CI: "1",
      DARYADARCY_EDITOR_FIXTURE_FILE: fixtureFile,
      PLAYWRIGHT_EXECUTABLE_PATH: process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? "",
      PLAYWRIGHT_JSON_OUTPUT_FILE: join(output, "results.json"),
    },
    join(root, "apps/frontend"),
  );
  const stats = JSON.parse(
    await readFile(join(output, "results.json"), "utf8"),
  ).stats;
  if (!stats.expected || stats.unexpected || stats.skipped || stats.flaky)
    throw new Error(
      "Real acceptance requires executed passing tests without skips or flakes",
    );
  if (checkout && stats.expected !== 11)
    throw new Error(
      "NORMAL/GUEST acceptance requires all 11 checkout scenarios",
    );
  console.log(
    `Real ${profile} acceptance passed: ${stats.expected} tests, no skips.`,
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await cleanup();
}
