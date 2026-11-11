/** Проверяем зависимость ESLint minimatch на ограниченном времени и сохранении glob-семантики. */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { expect, it } from "vitest";

const lintRequire = createRequire(require.resolve("eslint/package.json"));
const matcherPath = lintRequire.resolve("minimatch");

// Actual ESLint dependency; synthetic inputs run only in disposable children.
/** Потенциально медленный шаблон запускается отдельно с малым heap и timeout; timeout не считается успешным совпадением. */
it.each([
  ["consecutive stars", "'a' + '*'.repeat(100) + 'b'", "'a' + 'c'.repeat(25)"],
  [
    "non-adjacent globstars",
    "Array(50).fill('**/a').join('/') + '/b/**'",
    "Array(101).fill('a').join('/')",
  ],
])("bounds %s without blocking the test worker", (_name, pattern, filename) => {
  let output: string;
  try {
    output = execFileSync(
      process.execPath,
      [
        "--max-old-space-size=64",
        "-e",
        `const match = require(process.argv[1]);
       console.log(JSON.stringify({ matched: match(${filename}, ${pattern}) }));`,
        matcherPath,
      ],
      { encoding: "utf8", timeout: 2000, maxBuffer: 4096 },
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ETIMEDOUT") throw error;
    output = '{"timedOut":true}';
  }
  expect(JSON.parse(output)).toEqual({ matched: false });
});

/** Обычные glob, скрытые файлы, braces и partial matching сохраняют прежние результаты. */
it("preserves lint glob, dot, brace and partial matching semantics", () => {
  const match = lintRequire("minimatch") as (
    filename: string,
    pattern: string,
    options?: { dot?: boolean; partial?: boolean },
  ) => boolean;
  const fixtures: [string, string, boolean][] = [
    ["src/app/page.tsx", "src/**/*.{ts,tsx}", true],
    ["docs/readme.md", "src/**/*.{ts,tsx}", false],
    ["src/.hidden/page.ts", "src/**/*.ts", false],
    ["src/app/page.test.ts", "**/*.test.ts", true],
    ["src/app/page.tsx", "src/+(view|page).tsx", false],
    ["src/page.tsx", "src/+(view|page).tsx", true],
  ];
  for (const [filename, pattern, expected] of fixtures) {
    expect(match(filename, pattern)).toBe(expected);
  }
  expect(match("src/.hidden/page.ts", "src/**/*.ts", { dot: true })).toBe(true);
  expect(match("/b/c/d/a", "/**/a/b/c", { partial: true })).toBe(true);
});
