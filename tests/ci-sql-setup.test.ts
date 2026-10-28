import { expect, it } from "vitest";
import {
  mkdtemp,
  mkdir,
  writeFile,
  symlink,
  rm,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

it("CI rejects an unsafe database before executing any SQL suite, without printing its credentials", async () => {
  const directory = await mkdtemp(join(tmpdir(), "daryadarcy-sql-preflight-"));
  try {
    await mkdir(join(directory, "tests"));
    await symlink(resolve("node_modules"), join(directory, "node_modules"));
    await writeFile(
      join(directory, "vitest.config.mts"),
      `
      import base from ${JSON.stringify(resolve("vitest.config.mts"))};
      export default {...base,root:${JSON.stringify(directory)},test:{...base.test,
        setupFiles:[${JSON.stringify(resolve("vitest.setup.ts"))}]}};
    `,
    );
    const marker = join(directory, "unsafe-suite-executed");
    await writeFile(
      join(directory, "tests", "blocked.mysql.test.ts"),
      `
      import {it} from 'vitest';import{writeFileSync}from'node:fs';
      it('would mutate SQL',()=>writeFileSync(${JSON.stringify(marker)},'started'));
    `,
    );
    const result = await promisify(execFile)(
      process.execPath,
      [
        resolve("node_modules/vitest/vitest.mjs"),
        "run",
        "--config",
        join(directory, "vitest.config.mts"),
        "--project",
        "mysql",
      ],
      {
        timeout: 15_000,
        maxBuffer: 1024 * 1024,
        env: {
          ...process.env,
          CI: "true",
          BACKEND_TEST_CI_SERVICE: "true",
          BACKEND_TEST_DATABASE_URL:
            "mysql://fixture:PRIVATE_CI_URI_SENTINEL@external.example.test/working_database",
          VITEST: "",
          VITEST_WORKER_ID: "",
          VITEST_POOL_ID: "",
        },
      },
    ).then(
      (r) => ({ code: 0, output: r.stdout + r.stderr }),
      (e) => ({
        code: Number(e.code) || 1,
        output: String(e.stdout) + String(e.stderr),
      }),
    );
    expect(result.code).not.toBe(0);
    expect(result.output).toContain(
      "SQL tests require the disposable backend_test database on an allowed test host",
    );
    expect(result.output).not.toContain("PRIVATE_CI_URI_SENTINEL");
    await expect(access(marker)).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 20_000);
