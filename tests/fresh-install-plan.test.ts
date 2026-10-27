import { afterEach, beforeEach, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
let scratch: string;
beforeEach(async () => {
  scratch = await mkdtemp(join(tmpdir(), "daryadarcy-fresh-plan-"));
  await mkdir(join(scratch, "tooling/scripts"), { recursive: true });
  await mkdir(join(scratch, "packages/database/drizzle/meta"), {
    recursive: true,
  });
  await symlink(join(root, "node_modules"), join(scratch, "node_modules"));
  for (const name of ["fresh-database.ts", "migration-policy.ts"])
    await copyFile(
      join(root, "tooling/scripts", name),
      join(scratch, "tooling/scripts", name),
    );
  const source = join(root, "packages/database/drizzle");
  for (const name of (await readdir(source)).filter((name) =>
    name.endsWith(".sql"),
  ))
    await copyFile(
      join(source, name),
      join(scratch, "packages/database/drizzle", name),
    );
  await copyFile(
    join(source, "meta/_journal.json"),
    join(scratch, "packages/database/drizzle/meta/_journal.json"),
  );
});
afterEach(async () => {
  await rm(scratch, { recursive: true, force: true });
});
function run(args = ["--plan"], extra: NodeJS.ProcessEnv = {}) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["--import", "tsx", "tooling/scripts/fresh-database.ts", ...args],
        {
          cwd: scratch,
          env: { PATH: "", ...extra },
          timeout: 10000,
        },
      );
      let stdout = "",
        stderr = "";
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      child.on("error", reject);
      child.on("close", (code) => resolve({ code, stdout, stderr }));
    },
  );
}
it("plans the complete fresh order without Docker, credentials or modifying the legacy journal", async () => {
  const journalPath = join(
    scratch,
    "packages/database/drizzle/meta/_journal.json",
  );
  const before = await readFile(journalPath, "utf8");
  const result = await run();
  expect(result.code, result.stderr).toBe(0);
  const plan = JSON.parse(result.stdout);
  expect(plan).toMatchObject({
    profile: "fresh-install-plan",
    databaseChecked: false,
    initialized: false,
    releaseApproval: false,
  });
  expect(plan.migrations).toHaveLength(45);
  expect(
    plan.migrations.slice(17, 20).map((row: { tag: string }) => row.tag),
  ).toEqual([
    "0017_consent_text",
    "0018_push_consent_text",
    "0019_comment_likes",
  ]);
  expect(plan.migrations.at(-1).tag).toBe("0044_post_listing_indexes");
  for (const row of plan.migrations) {
    const bytes = await readFile(
      join(scratch, "packages/database/drizzle", `${row.tag}.sql`),
    );
    expect(row.hash).toBe(createHash("sha256").update(bytes).digest("hex"));
  }
  expect(plan.planHash).toBe(
    createHash("sha256").update(JSON.stringify(plan.migrations)).digest("hex"),
  );
  expect(result.stdout).not.toContain("CREATE TABLE");
  expect(await readFile(journalPath, "utf8")).toBe(before);
});
it("does not open an inherited application, preflight or fixture connection or expose their credentials", async () => {
  let connections = 0;
  const trap = createServer((socket) => {
    connections++;
    socket.destroy();
  });
  await new Promise<void>((resolve) => trap.listen(0, "127.0.0.1", resolve));
  try {
    const port = (trap.address() as { port: number }).port;
    const uri = `mysql://probe:private-plan-sentinel@127.0.0.1:${port}/backend_test`;
    const result = await run(["--plan"], {
      DATABASE_URL: uri,
      MIGRATION_PREFLIGHT_DATABASE_URL: uri,
      FRESH_DATABASE_URL: uri,
      FRESH_DATABASE_CONTAINER_ID: "0".repeat(64),
    });
    expect(result.code, result.stderr).toBe(0);
    expect(connections).toBe(0);
    expect(result.stdout + result.stderr).not.toContain(
      "private-plan-sentinel",
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      trap.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
it("changes the plan fingerprint when SQL bytes change", async () => {
  const before = await run();
  expect(before.code, before.stderr).toBe(0);
  const file = join(
    scratch,
    "packages/database/drizzle/0041_library_files.sql",
  );
  await writeFile(
    file,
    (await readFile(file, "utf8")) + "\n-- reviewed candidate change\n",
  );
  const after = await run();
  expect(after.code, after.stderr).toBe(0);
  expect(JSON.parse(after.stdout).planHash).not.toBe(
    JSON.parse(before.stdout).planHash,
  );
});
it("refuses unknown SQL rather than including it in a fresh plan", async () => {
  await writeFile(
    join(scratch, "packages/database/drizzle/0042_unknown.sql"),
    "DROP TABLE users;",
  );
  const result = await run();
  expect(result.code).toBe(1);
  expect(result.stdout).toBe("");
});
it("refuses a missing SQL file without reporting a partial plan", async () => {
  await rm(
    join(scratch, "packages/database/drizzle/0018_push_consent_text.sql"),
  );
  const result = await run();
  expect(result.code).toBe(1);
  expect(result.stdout).toBe("");
});
it.each([
  {
    FRESH_DATABASE_URL:
      "mysql://probe:private-plan-sentinel@192.0.2.1/backend_test",
  },
  {
    FRESH_DATABASE_URL:
      "mysql://probe:private-plan-sentinel@127.0.0.1:3306/daryadarcy_candidate_20261019",
  },
  { NODE_ENV: "production" },
])("does not widen local initialization permissions %#", async (extra) => {
  const result = await run(["--initialize-empty-local"], {
    FRESH_DATABASE_CONTAINER_ID: "0".repeat(64),
    ...extra,
  });
  expect(result.code).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).not.toContain("private-plan-sentinel");
});
it.each([
  ["--plan", "--initialize-empty-local"],
  ["--initialize-empty-server"],
  ["--plan", "--force"],
])("refuses unsupported or combined operation modes %j", async (...args) => {
  const result = await run(args);
  expect(result.code).toBe(1);
  expect(result.stdout).toBe("");
});
