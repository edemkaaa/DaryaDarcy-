import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { expect, test } from "vitest";
import * as diagnostics from "./helpers/native-test-failure";

test("recognizes multiline literal names but never dynamic diagnostic names", () => {
  expect(diagnostics).toHaveProperty("nativeTestNames");
  const names = diagnostics.nativeTestNames([
    'test("one line", async () => {}); test(\n  "multiline", { timeout: 5000 }, async () => {}); test(titleFromPayload, () => {});',
  ]);
  expect([...names]).toEqual(["one line", "multiline"]);
  expect(
    diagnostics.nativeTestFailure({ stdout: "not ok 1 - multiline" }, names)
      .message,
  ).toContain("multiline");
});

test("reports only trusted failed native test names, never child error details", async () => {
  expect(diagnostics).toHaveProperty("nativeTestFailure");
  const failure = await promisify(execFile)(process.execPath, [
    "-e",
    'console.log("not ok 1 - fixture failure\\n  error: private fixture value\\nnot ok 2 - untrusted private title"); console.error("private stderr"); process.exit(1)',
  ]).catch((error) => error);
  const safe = diagnostics.nativeTestFailure(
    failure,
    new Set(["fixture failure"]),
  );
  expect(safe.message).toContain("fixture failure");
  expect(safe.message).not.toContain("private");
  expect(safe.message).not.toContain("untrusted");
  expect(safe.cause).toBeUndefined();
  expect(Object.keys(safe)).toEqual([]);
});

test.each([
  [{ killed: true, stdout: "private", stderr: "private" }, "deadline"],
  [
    { code: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER", stdout: "private" },
    "output limit",
  ],
  [{ code: 1, stdout: "not ok 1 - unknown private title" }, "failed"],
  [new Error("private spawn error"), "failed"],
  [null, "failed"],
])(
  "classifies native runner failure without forwarding captured output",
  (failure, kind) => {
    const safe = diagnostics.nativeTestFailure(failure, new Set());
    expect(safe.message).toContain(kind);
    expect(safe.message).not.toContain("private");
    expect(safe.cause).toBeUndefined();
  },
);
