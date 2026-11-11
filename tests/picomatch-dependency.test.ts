/** Проверяем реальную lint-зависимость picomatch/micromatch на малых фикстурах и ограниченном дочернем процессе. */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { expect, it } from "vitest";

const globRequire = createRequire(require.resolve("micromatch/package.json"));
const picomatchPath = globRequire.resolve("picomatch");
const picomatch = globRequire("picomatch") as (
  pattern: string,
) => (filename: string) => boolean;

// Narrow characterization of the glob dependency used by frontend lint tools.
// These synthetic patterns are never passed to application access control.
/** Служебное имя прототипа не должно становиться допустимым POSIX-классом шаблона. */
it.each(["constructor", "toString", "valueOf"])(
  "does not match a filename using inherited POSIX class %s",
  (name) => {
    expect(picomatch(`[[:${name}:]]`)("f }]")).toBe(false);
  },
);

/** Потенциальное долгое сопоставление ограничено процессом, heap и timeout; зависание не считается корректным false. */
it("rejects overlapping repeated alternatives within a bounded child", () => {
  let output: string;
  try {
    output = execFileSync(
      process.execPath,
      [
        "--max-old-space-size=64",
        "-e",
        `const match = require(process.argv[1])('+(a|aa)');
         console.log(JSON.stringify({ matched: match('a'.repeat(48) + '!') }));`,
        picomatchPath,
      ],
      { encoding: "utf8", timeout: 2000, maxBuffer: 4096 },
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ETIMEDOUT") throw error;
    output = '{"timedOut":true}';
  }
  expect(JSON.parse(output)).toEqual({ matched: false });
});

/** Проверяем обычные расширения, исключение test-файлов и поддерживаемые классы шаблона. */
it("preserves ordinary lint file selection and exclusions", () => {
  const micromatch = globRequire("micromatch") as (
    filenames: string[],
    patterns: string[],
  ) => string[];
  expect(
    micromatch(
      [
        "src/app/page.tsx",
        "src/lib/client.ts",
        "src/lib/client.test.ts",
        "docs/readme.md",
      ],
      ["src/**/*.{ts,tsx}", "!src/**/*.test.ts"],
    ),
  ).toEqual(["src/app/page.tsx", "src/lib/client.ts"]);
  expect(picomatch("[[:digit:]].ts")("3.ts")).toBe(true);
  expect(picomatch("src/+(view|page).tsx")("src/page.tsx")).toBe(true);
});
