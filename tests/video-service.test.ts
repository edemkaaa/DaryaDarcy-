import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "vitest";
import { nativeTestFailure } from "./helpers/native-test-failure";

// Exercise the same dependency-free Node runtime that is deployed, not a
// transpiled version. A failed native behavior test propagates a nonzero exit.
test("isolated public-video worker passes its native HTTP/cache/process suite", async () => {
  const directory = resolve("apps/video-service/test");
  const files = (await readdir(directory))
    .filter((file) => file.endsWith(".test.mjs"))
    .map((file) => resolve(directory, file));
  // Only literal names from our trusted local fixtures may enter diagnostics.
  // Unknown/dynamic names and all arbitrary child stdout/stderr stay private.
  const names = new Set(
    (await Promise.all(files.map((file) => readFile(file, "utf8")))).flatMap(
      (source) =>
        [...source.matchAll(/\btest\("([^"\r\n]{1,240})"/g)].map(
          (match) => match[1],
        ),
    ),
  );
  try {
    await promisify(execFile)(
      process.execPath,
      ["--test", "--test-reporter=tap", ...files],
      {
        timeout: 30_000,
        maxBuffer: 1024 * 1024,
      },
    );
  } catch (failure) {
    throw nativeTestFailure(failure, names);
  }
}, 35_000);
