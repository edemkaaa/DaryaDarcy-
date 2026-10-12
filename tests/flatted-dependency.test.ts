import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { expect, it } from "vitest";

const cacheRequire = createRequire(require.resolve("flat-cache/package.json"));
const flattedPath = cacheRequire.resolve("flatted");
const flatted = cacheRequire("flatted") as typeof import("flatted");

// Characterize ESLint's actual cache dependency in bounded disposable children.
// Hostile references are inspected, never mutated; no cache files are read.
it.each(["__proto__", "constructor", "toString"])(
  "does not resolve cache reference %s through the input array prototype",
  (reference) => {
    const output = execFileSync(
      process.execPath,
      [
        "-e",
        `const { parse } = require(process.argv[1]);
         const parsed = parse(JSON.stringify([{ x: process.argv[2] }]));
         console.log(JSON.stringify({ unresolved: parsed.x === undefined }));`,
        flattedPath,
        reference,
      ],
      { encoding: "utf8", timeout: 2000, maxBuffer: 4096 },
    );
    expect(JSON.parse(output)).toEqual({ unresolved: true });
  },
);

it("restores a bounded cache reference chain without recursive stack growth", () => {
  const output = execFileSync(
    process.execPath,
    [
      "--stack-size=128",
      "--max-old-space-size=64",
      "-e",
      `const { parse } = require(process.argv[1]);
       const entries = Array.from({ length: 2000 }, (_, i) => ({ next: String(i + 1) }));
       entries.push({ done: true });
       try {
         let value = parse(JSON.stringify(entries));
         for (let i = 0; i < 2000; i++) value = value.next;
         console.log(JSON.stringify({ done: value.done }));
       } catch (error) {
         console.log(JSON.stringify({ error: error.name }));
       }`,
      flattedPath,
    ],
    { encoding: "utf8", timeout: 2000, maxBuffer: 4096 },
  );
  expect(JSON.parse(output)).toEqual({ done: true });
});

it("preserves ordinary cache values, shared references and cycles", () => {
  const parsed = flatted.parse(
    '[{"name":"1","self":"0","shared":"2","again":"2"},"fixture",{"count":3}]',
  );
  expect(parsed.name).toBe("fixture");
  expect(parsed.shared).toEqual({ count: 3 });
  expect(parsed.again).toBe(parsed.shared);
  expect(parsed.self).toBe(parsed);
  expect(flatted.parse(flatted.stringify(parsed)).self.name).toBe("fixture");
});
