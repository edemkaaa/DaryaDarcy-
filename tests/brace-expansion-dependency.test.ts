import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { expect, it } from "vitest";

const lintRequire = createRequire(require.resolve("eslint/package.json"));
const globRequire = createRequire(lintRequire.resolve("minimatch"));
const expansionPath = globRequire.resolve("brace-expansion");

// The real lint dependency, not a separately installed parser or version check.
it("caps default sequence output in a bounded disposable child", () => {
  const output = execFileSync(
    process.execPath,
    [
      "--max-old-space-size=64",
      "-e",
      `const expand = require(process.argv[1]);
       const values = expand('{1..100005}');
       console.log(JSON.stringify({ count: values.length, first: values[0], last: values.at(-1) }));`,
      expansionPath,
    ],
    { encoding: "utf8", timeout: 2000, maxBuffer: 4096 },
  );
  expect(JSON.parse(output)).toEqual({
    count: 100000,
    first: "1",
    last: "100000",
  });
});

const expand = globRequire("brace-expansion") as (
  pattern: string,
  options?: { max?: number; maxLength?: number },
) => string[];

it("bounds Cartesian products by output count", () => {
  expect(expand("{a,b}{1,2,3}", { max: 3 })).toEqual(["a1", "a2", "a3"]);
});

it("bounds accumulated output characters", () => {
  expect(expand("{aa,bb,cc}", { maxLength: 4 })).toEqual(["aa", "bb"]);
});

it("preserves ordinary lint braces, ranges, escapes and legacy dollar syntax", () => {
  const fixtures: [string, string[]][] = [
    ["src/*.{ts,tsx}", ["src/*.ts", "src/*.tsx"]],
    ["{a,b}{1,2}", ["a1", "a2", "b1", "b2"]],
    ["{03..01}", ["03", "02", "01"]],
    ["{a..e..2}", ["a", "c", "e"]],
    ["{a,{b,c}}", ["a", "b", "c"]],
    ["{,a,}", ["a"]],
    ["\\{a,b\\}", ["{a,b}"]],
    ["${a,b}{c,d}", ["${a,b}{c,d}"]],
    ["{}x{a,b}", ["{}xa", "{}xb"]],
  ];
  for (const [pattern, expected] of fixtures) {
    expect(expand(pattern), pattern).toEqual(expected);
  }
});
