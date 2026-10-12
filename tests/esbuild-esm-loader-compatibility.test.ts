import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const fixture = fileURLToPath(
  new URL("./fixtures/legacy-loader/", import.meta.url),
);
const require = createRequire(import.meta.url);

// Native loader/config characterization only: no Drizzle command, SQL or
// provider. Candidate hooks still come from the installed deprecated loader.
it.each([false, true])(
  "loads aliased typed ESM config and dynamic imports (candidate: %s)",
  (candidate) => {
    const child = spawnSync(
      process.execPath,
      [
        "--loader",
        candidate
          ? `${fixture}candidate-loader.mjs`
          : require.resolve("@esbuild-kit/esm-loader"),
        `${fixture}entry.mts`,
      ],
      {
        cwd: fixture,
        env: {
          ...process.env,
          ESBK_DISABLE_CACHE: "1",
          ESBK_TSCONFIG_PATH: `${fixture}tsconfig.json`,
        },
        timeout: 10_000,
        encoding: "utf8",
        maxBuffer: 64 * 1024,
      },
    );
    expect(child.error).toBeUndefined();
    expect(child.status, child.stderr).toBe(0);
    expect(JSON.parse(child.stdout)).toEqual({
      dialect: "sqlite",
      schema: "./synthetic-schema.ts",
      total: 12,
    });
  },
);
