import { afterAll, beforeAll, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, unlink, rmdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const run = promisify(execFile);
let directory: string, output: string;
const frontend = resolve("apps/frontend/src/shared/api/contract.ts");
let original: string;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "daryadarcy-contract-"));
  output = join(directory, "contract.ts");
  original = await readFile(frontend, "utf8");
});
afterAll(async () => {
  await unlink(output).catch(() => {});
  await rmdir(directory);
});
it("exports and checks a handoff artifact without writing the frontend contract", async () => {
  // The guard makes RED safe: the old generator ignores --output and tries
  // the frontend destination. It must never write there even in a failing test.
  const script = `const fs=require('node:fs'),path=require('node:path');
    const write=fs.writeFileSync,allowed=${JSON.stringify(output)};
    fs.writeFileSync=(file,...args)=>{if(path.resolve(String(file))!==allowed)throw Error('Unexpected contract destination');return write(file,...args)};
    require('./tooling/scripts/extract-api-contract.cjs');`;
  const args = ["-e", script, "--", "--output", output];
  await run(process.execPath, args, { timeout: 20000 });
  const generated = await readFile(output, "utf8");
  expect(generated).toContain("savedPostsPage:");
  expect(generated).toContain("membersPage:");
  expect(generated).toContain("commentsPage:");
  expect(await readFile(frontend, "utf8")).toBe(original);
  await run(process.execPath, [...args, "--check"], { timeout: 20000 });
  await writeFile(output, generated + "// stale handoff\n");
  await expect(
    run(process.execPath, [...args, "--check"], { timeout: 20000 }),
  ).rejects.toMatchObject({ code: 1 });
}, 60000);
