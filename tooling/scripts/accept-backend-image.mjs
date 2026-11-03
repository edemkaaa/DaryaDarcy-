import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, open, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Local-only acceptance of an existing image. No deployment, image pull, working
// database, .env loading, SMTP or S3. Logs are private and outside the repository.
const root = fileURLToPath(new URL("../../", import.meta.url));
const args = process.argv.slice(2);
if (args.length !== 1 || !args[0] || args[0].startsWith("-")) {
  console.error(
    "Usage: node tooling/scripts/accept-backend-image.mjs LOCAL_IMAGE",
  );
  process.exitCode = 1;
} else {
  try {
    await accept(args[0]);
  } catch {
    // Child-process errors may contain SQL credentials in their arguments/env.
    console.error(
      "Local image acceptance failed; inspect the private run logs.",
    );
    process.exitCode = 1;
  }
}

async function accept(image) {
  const owner = `daryadarcy-fresh-backend-audit-${randomBytes(8).toString("hex")}`;
  const folder = resolve(root, "../.local-artifacts", owner);
  await mkdir(folder, { mode: 0o700 });
  console.log(JSON.stringify({ artifacts: folder }));
  // Keep only the host toolchain environment; do not forward integration keys.
  const env = Object.fromEntries(
    [
      "PATH",
      "HOME",
      "TMPDIR",
      "DEVELOPER_DIR",
      "DOCKER_CONFIG",
      "DOCKER_CONTEXT",
      "DOCKER_HOST",
    ]
      .filter((key) => process.env[key] !== undefined)
      .map((key) => [key, process.env[key]]),
  );
  Object.assign(env, { DATABASE_URL: "", NODE_ENV: "test" });
  async function run(command, commandArgs, { log, timeout = 30_000 } = {}) {
    const handle = log
      ? await open(resolve(folder, log), "wx", 0o600)
      : undefined;
    try {
      return await new Promise((fulfil, reject) => {
        const child = spawn(command, commandArgs, {
          cwd: root,
          env,
          stdio: ["ignore", handle?.fd ?? "pipe", handle?.fd ?? "pipe"],
        });
        let output = "";
        child.stdout?.on("data", (chunk) => {
          output += String(chunk);
        });
        child.stderr?.resume();
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
        }, timeout);
        child.once("error", () => {
          clearTimeout(timer);
          reject(new Error("Process unavailable"));
        });
        child.once("close", (code) => {
          clearTimeout(timer);
          if (code !== 0) reject(new Error("Process failed"));
          else fulfil(output.trim());
        });
      });
    } finally {
      await handle?.close();
    }
  }
  const docker = (...parts) => run("docker", parts);
  // Docker contexts can point at a remote/working host: refuse those before
  // creating anything. An explicit DOCKER_HOST takes precedence over context.
  const context = JSON.parse(await docker("context", "inspect"))[0];
  const endpoint = env.DOCKER_CONTEXT
    ? context.Endpoints?.docker?.Host
    : env.DOCKER_HOST || context.Endpoints?.docker?.Host;
  if (!endpoint?.startsWith("unix://"))
    throw new Error("Local Docker required");
  const metadata = JSON.parse(await docker("image", "inspect", image))[0];
  if (
    metadata.Os !== "linux" ||
    metadata.Config.User !== "node" ||
    !["amd64", "arm64"].includes(metadata.Architecture)
  )
    throw new Error("Backend image required");
  // Resolve the mutable tag once; every replica below uses this exact local ID.
  const imageId = metadata.Id;
  const password = randomBytes(20).toString("hex");
  let databaseId;
  let passed = false;
  let cleaned = false;
  try {
    databaseId = await docker(
      "run",
      "--pull=never",
      "--detach",
      "--rm",
      "--name",
      owner,
      "--label",
      `codex.owner=${owner}`,
      "--memory=768m",
      "--cpus=1",
      "--log-driver=none",
      "--tmpfs",
      "/var/lib/mysql:rw,size=384m",
      "-p",
      "127.0.0.1::3306",
      "-e",
      `MYSQL_ROOT_PASSWORD=${password}`,
      "-e",
      "MYSQL_DATABASE=backend_test",
      "mysql:8.4",
      "--innodb-buffer-pool-size=32M",
      "--innodb-redo-log-capacity=16M",
      "--max-connections=30",
      "--skip-log-bin",
    );
    const port = (await docker("port", databaseId, "3306/tcp"))
      .split(":")
      .at(-1);
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        await docker(
          "exec",
          databaseId,
          "mysqladmin",
          "ping",
          "--protocol=tcp",
          "-h127.0.0.1",
          "-uroot",
          `-p${password}`,
        );
        ready = true;
        break;
      } catch {
        await new Promise((done) => setTimeout(done, 1000));
      }
    }
    if (!ready) throw new Error("Owned database unavailable");
    env.FRESH_DATABASE_URL = `mysql://root:${password}@127.0.0.1:${port}/backend_test`;
    env.FRESH_DATABASE_CONTAINER_ID = databaseId;
    await run("pnpm", ["db:fresh:local", "--initialize-empty-local"], {
      log: "migrations.log",
      timeout: 90_000,
    });
    env.BACKEND_TEST_DATABASE_URL = env.FRESH_DATABASE_URL;
    delete env.FRESH_DATABASE_URL;
    delete env.FRESH_DATABASE_CONTAINER_ID;
    Object.assign(env, {
      BACKEND_API_IMAGE: imageId,
      BACKEND_IMAGE_DATABASE_CONTAINER_ID: databaseId,
      BACKEND_IMAGE_DATABASE_OWNER: owner,
    });
    await run(
      "pnpm",
      [
        "exec",
        "vitest",
        "run",
        "--project",
        "mysql",
        "tests/backend-image.mysql.test.ts",
      ],
      { log: "image-tests.log", timeout: 600_000 },
    );
    passed = true;
  } finally {
    // Also recover after a partial docker-run result or a killed Vitest process.
    // Nothing is removed by image name, broad prune or volume discovery.
    for (const id of (
      await docker("ps", "-aq", "--filter", `label=codex.parent=${owner}`)
    )
      .split(/\s+/)
      .filter(Boolean)) {
      await docker("rm", "-f", id);
    }
    const owned = await docker(
      "ps",
      "-aq",
      "--filter",
      `label=codex.owner=${owner}`,
    );
    if (owned) {
      if (databaseId && owned !== databaseId && !databaseId.startsWith(owned))
        throw new Error("Ownership drift");
      databaseId = owned;
    }
    for (const network of (
      await docker(
        "network",
        "ls",
        "-q",
        "--filter",
        `label=codex.parent=${owner}`,
      )
    )
      .split(/\s+/)
      .filter(Boolean)) {
      if (databaseId)
        await docker("network", "disconnect", "-f", network, databaseId);
      await docker("network", "rm", network);
    }
    if (owned) await docker("stop", owned);
    cleaned =
      !(await docker("ps", "-aq", "--filter", `label=codex.owner=${owner}`)) &&
      !(await docker("ps", "-aq", "--filter", `label=codex.parent=${owner}`)) &&
      !(await docker(
        "network",
        "ls",
        "-q",
        "--filter",
        `label=codex.parent=${owner}`,
      ));
    const result = {
      passed,
      cleaned,
      architecture: metadata.Architecture,
      imageId,
      sourceRevision:
        metadata.Config.Labels?.["org.opencontainers.image.revision"],
      productionApproval: false,
      workingDataUsed: false,
      artifacts: folder,
    };
    await writeFile(
      resolve(folder, "result.json"),
      JSON.stringify(result, null, 2) + "\n",
      { mode: 0o600 },
    );
    console.log(JSON.stringify(result));
    if (!cleaned) throw new Error("Owned cleanup incomplete");
  }
}
