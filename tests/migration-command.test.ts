import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer } from "node:net";

const root = fileURLToPath(new URL("../", import.meta.url));
let scratch: string;

function execute(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<{ status: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const child = spawn(command, args, {
        cwd: scratch,
        env,
        timeout: 12_000,
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (data) => {
        stdout += data;
      });
      child.stderr.on("data", (data) => {
        stderr += data;
      });
      child.on("error", reject);
      child.on("close", (status) => resolve({ status, stdout, stderr }));
    },
  );
}

function environment(extra: NodeJS.ProcessEnv = {}) {
  return {
    ...process.env,
    DATABASE_URL: "",
    MIGRATION_PREFLIGHT_DATABASE_URL: "",
    ...extra,
  };
}

beforeEach(async () => {
  scratch = await mkdtemp(join(tmpdir(), "darcy-migration-command-"));
});
afterEach(async () => {
  await rm(scratch, { recursive: true, force: true });
});

describe("migration update command", () => {
  async function run(gateCode: number, applyCode = 0) {
    const manifest = JSON.parse(
      await readFile(join(root, "package.json"), "utf8"),
    );
    const bin = join(scratch, "bin");
    await mkdir(bin);
    // Executable transport probes make side effects observable without SQL.
    for (const name of ["pnpm", "drizzle-kit"]) {
      await writeFile(
        join(bin, name),
        `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.PROBE_LOG, ${JSON.stringify(name)} + ' ' + args.join(' ') + '\\n');
process.exit(${name === "pnpm" ? gateCode : applyCode});
`,
        { mode: 0o700 },
      );
    }
    const log = join(scratch, "trace");
    const result = await execute(
      "/bin/sh",
      ["-c", manifest.scripts["db:push"]],
      environment({
        PATH: `${bin}:${process.env.PATH}`,
        PROBE_LOG: log,
      }),
    );
    return { ...result, trace: await readFile(log, "utf8") };
  }

  it("never generates or applies SQL when preflight refuses", async () => {
    const result = await run(1);
    expect(result.status).toBe(1);
    expect(result.trace).toBe("pnpm db:preflight --require-database\n");
  });
  it("applies reviewed SQL only after the database-required gate", async () => {
    const result = await run(0);
    expect(result.status).toBe(0);
    expect(result.trace).toBe(
      "pnpm db:preflight --require-database\ndrizzle-kit migrate\n",
    );
  });
  it("propagates an application failure rather than reporting success", async () => {
    expect((await run(0, 23)).status).toBe(23);
  });
});

describe("actual read-only preflight CLI", () => {
  async function fixture(orphan = false) {
    const scripts = join(scratch, "tooling/scripts");
    const folder = join(scratch, "packages/database/drizzle");
    await mkdir(scripts, { recursive: true });
    await mkdir(join(folder, "meta"), { recursive: true });
    await symlink(
      join(root, "node_modules"),
      join(scratch, "node_modules"),
      "dir",
    );
    for (const name of [
      "migration-preflight.ts",
      "migration-policy.ts",
      "migration-history.ts",
      "email-identity-preflight.ts",
    ]) {
      await copyFile(join(root, "tooling/scripts", name), join(scripts, name));
    }
    const core = join(scratch, "apps/backend/src/_core");
    await mkdir(core, { recursive: true });
    await copyFile(
      join(root, "apps/backend/src/_core/password.ts"),
      join(core, "password.ts"),
    );
    await writeFile(
      join(folder, "meta/_journal.json"),
      JSON.stringify({
        dialect: "mysql",
        entries: [{ idx: 0, when: 100, tag: "0000_first", breakpoints: true }],
      }),
    );
    await writeFile(
      join(folder, "0000_first.sql"),
      "CREATE TABLE example (id INT);\n",
    );
    if (orphan) await writeFile(join(folder, "0001_orphan.sql"), "SELECT 1;\n");
    return async (args: string[] = [], env: NodeJS.ProcessEnv = {}) =>
      execute(
        process.execPath,
        ["--import", "tsx", join(scripts, "migration-preflight.ts"), ...args],
        environment(env),
      );
  }

  it("keeps ordinary file-only preflight independent of application credentials", async () => {
    const run = await fixture();
    const result = await run([], {
      DATABASE_URL: "mysql://application-secret@invalid.test/app",
    });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      databaseChecked: false,
      issues: [],
      pending: null,
      releaseApproval: false,
    });
    expect(result.stdout + result.stderr).not.toContain("application-secret");
  });
  it("requires an explicit inspection connection for the Feed index gate", async () => {
    const run = await fixture();
    const result = await run(["--require-feed-index"], {
      DATABASE_URL: "mysql://application-secret@invalid.test/app",
    });
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      databaseChecked: false,
      issues: ["database-connection-required"],
      releaseApproval: false,
    });
    expect(result.stdout + result.stderr).not.toContain("application-secret");
  });
  it.each(["", "   "])(
    "requires an explicit application connection for the apply gate (%j)",
    async (uri) => {
      const run = await fixture();
      await writeFile(
        join(scratch, ".env"),
        "DATABASE_URL=mysql://fixture@invalid.test/app\n",
      );
      const result = await run(["--require-database"], { DATABASE_URL: uri });
      expect(result.status).toBe(1);
      expect(JSON.parse(result.stdout).issues).toContain(
        "database-connection-required",
      );
    },
  );
  it("refuses different inspection and application databases without exposing their URLs", async () => {
    const run = await fixture();
    const result = await run(["--require-database"], {
      DATABASE_URL: "mysql://writer:write-secret@invalid.test/write_db",
      MIGRATION_PREFLIGHT_DATABASE_URL:
        "mysql://reader:read-secret@invalid.test/read_db",
    });
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("database-connection-mismatch");
    expect(JSON.parse(result.stdout).issues).toContain(
      "database-connection-mismatch",
    );
    expect(result.stdout + result.stderr).not.toMatch(
      /write-secret|read-secret|invalid\.test/,
    );
  });
  it.each([
    {
      label: "ordinary diagnostics refuse an orphan before connecting",
      orphan: true,
      args: [],
      variable: "MIGRATION_PREFLIGHT_DATABASE_URL",
      connections: 0,
    },
    {
      label: "apply gate refuses an orphan before connecting",
      orphan: true,
      args: ["--require-database"],
      variable: "DATABASE_URL",
      connections: 0,
    },
    {
      label: "apply gate actually inspects the application database",
      orphan: false,
      args: ["--require-database"],
      variable: "DATABASE_URL",
      connections: 1,
    },
  ])("$label", async (scenario) => {
    const run = await fixture(scenario.orphan);
    let connections = 0;
    const sockets = new Set<import("node:net").Socket>();
    const server = createServer((socket) => {
      connections++;
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
      socket.destroy();
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    try {
      const address = server.address() as import("node:net").AddressInfo;
      const result = await run(scenario.args, {
        [scenario.variable]: `mysql://fixture:sentinel@127.0.0.1:${address.port}/backend_test`,
      });
      expect(connections).toBe(scenario.connections);
      expect(result.status).toBe(1);
      if (scenario.orphan) {
        expect(JSON.parse(result.stdout)).toMatchObject({
          databaseChecked: false,
          issues: ["untracked-file:0001_orphan.sql"],
        });
      } else {
        // A refused real TCP handshake cannot be mistaken for a passing check.
        expect(result.stderr).toContain("Migration preflight failed");
      }
      expect(result.stdout + result.stderr).not.toContain("sentinel");
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
  it.each([
    ["--require-databse"],
    ["--require-database", "--require-database"],
    ["--require-database", "--force"],
  ])("rejects unsupported arguments %j", async (...args) => {
    const run = await fixture();
    const result = await run(args);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Unsupported preflight arguments");
  });
});
