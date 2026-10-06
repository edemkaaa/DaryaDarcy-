import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "vitest";

// Exercise the same dependency-free Node runtime that is deployed, not a
// transpiled version. A failed native behavior test propagates a nonzero exit.
test("isolated public-video worker passes its native HTTP/cache/process suite", async () => {
  const directory = resolve("apps/video-service/test");
  const files = (await readdir(directory))
    .filter((file) => file.endsWith(".test.mjs"))
    .map((file) => resolve(directory, file));
  await promisify(execFile)(process.execPath, ["--test", ...files], {
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  });
}, 35_000);
