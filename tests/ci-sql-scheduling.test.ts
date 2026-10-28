import { afterAll, beforeAll, expect, it } from "vitest";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  symlink,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execute = promisify(execFile);
const root = process.cwd();
let directory: string;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "daryadarcy-sql-scheduling-"));
  await mkdir(join(directory, "tests"));
  await symlink(resolve(root, "node_modules"), join(directory, "node_modules"));
  await writeFile(
    join(directory, "vitest.config.mts"),
    `
    import base from ${JSON.stringify(resolve(root, "vitest.config.mts"))};
    export default {...base,root:${JSON.stringify(directory)},test:{...base.test,
      setupFiles:[${JSON.stringify(resolve(root, "vitest.setup.ts"))}]}};
  `,
  );
});
afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});

it("serializes all shared-MySQL files once, while independent unit files still run together", async () => {
  const resource = join(directory, "sql-exclusive.lock");
  const sql = `
    import {it,expect} from 'vitest';
    import {open,unlink,appendFile,readFile} from 'node:fs/promises';
    it('owns the shared SQL fixture exclusively',async()=>{
      expect(await readFile(${JSON.stringify(join(directory, "unit-a.ready"))},'utf8')).toBe('ready');
      expect(await readFile(${JSON.stringify(join(directory, "unit-b.ready"))},'utf8')).toBe('ready');
      const lease=await open(${JSON.stringify(resource)},'wx');
      try {
        await new Promise(r=>setTimeout(r,200));
        await appendFile(${JSON.stringify(join(directory, "sql-completed"))},'done'+String.fromCharCode(10));
      } finally {await lease.close();await unlink(${JSON.stringify(resource)});}
    });
  `;
  for (const file of [
    "a.mysql.test.ts",
    "b.mysql.test.ts",
    "c.mysql.test.ts",
    "mysql-backup.test.ts",
    "private-library.browser.test.ts",
  ])
    await writeFile(join(directory, "tests", file), sql);
  for (const [name, other] of [
    ["a", "b"],
    ["b", "a"],
  ])
    await writeFile(
      join(directory, "tests", `unit-${name}.test.ts`),
      `
      import {it} from 'vitest';
      import {writeFile,access} from 'node:fs/promises';
      it('overlaps the other unit worker',async()=>{
        await writeFile(${JSON.stringify(join(directory, `unit-${name}.ready`))},'ready');
        const deadline=Date.now()+3000;
        while(true){
          try {await access(${JSON.stringify(join(directory, `unit-${other}.ready`))});break;}
          catch {if(Date.now()>deadline)throw new Error('Unit files were unnecessarily serialized');}
          await new Promise(r=>setTimeout(r,10));
        }
      });
    `,
    );
  const report = join(directory, "report.json");
  const result = await execute(
    process.execPath,
    [
      resolve(root, "node_modules/vitest/vitest.mjs"),
      "run",
      "--config",
      join(directory, "vitest.config.mts"),
      "--maxWorkers",
      "2",
      "--reporter=json",
      "--outputFile",
      report,
    ],
    {
      cwd: root,
      timeout: 15_000,
      maxBuffer: 1024 * 1024,
      env: {
        ...process.env,
        BACKEND_TEST_DATABASE_URL: "",
        VITEST: "",
        VITEST_WORKER_ID: "",
        VITEST_POOL_ID: "",
      },
    },
  ).then(
    () => 0,
    (error) => Number(error.code) || 1,
  );
  const data = JSON.parse(await readFile(report, "utf8"));
  expect({
    exitCode: result,
    passed: data.numPassedTests,
    failed: data.numFailedTests,
  }).toEqual({ exitCode: 0, passed: 7, failed: 0 });
  expect(
    (await readFile(join(directory, "sql-completed"), "utf8"))
      .trim()
      .split("\n"),
  ).toHaveLength(5);
}, 20_000);
