/** Проверяем настоящий offline export Drizzle с синтетической схемой; это не команда применения миграций. */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const fixture = fileURLToPath(
  new URL("./fixtures/drizzle-export/", import.meta.url),
);
// Node resolves a linked installation before reporting the requiring filename.
const cli = realpathSync(resolve("node_modules/drizzle-kit/bin.cjs"));

// Export generates DDL on stdout only; it does NOT execute SQL or migrate a DB.
// Both paths use the real CLI/register/schema serializer. No mocked results.
/** В дочернем процессе запрещаем сетевые соединения, отключаем .env и сверяем точный DDL и неизменность fixture-каталога. */
it.each([false, true])(
  "exports synthetic MySQL schema through the native CLI (candidate: %s)",
  (candidate) => {
    const before = readdirSync(fixture).sort();
    const disabledEnv = `${fixture}nonexistent-disabled.env`;
    expect(existsSync(disabledEnv)).toBe(false);
    const child = spawnSync(
      process.execPath,
      [
        "-e",
        `const assert = require('node:assert/strict');
         const Module = require('node:module');
         require('node:net').Socket.prototype.connect = function() {
           throw new Error('Offline export must not open network connections');
         };
         const cli = process.argv[1];
         const candidate = process.argv[2] === 'true';
         const compiler = candidate ? require('esbuild') : Module.createRequire(cli)('esbuild');
         assert.equal(compiler.version, candidate ? '0.28.2' : '0.25.12');
         const originalLoad = Module._load;
         let injected = false;
         if (candidate) Module._load = function(id, parent, ...rest) {
           if (id === 'esbuild' && parent?.filename === cli) { injected = true; return compiler; }
           return originalLoad.call(this, id, parent, ...rest);
         };
         process.on('exit', () => assert.equal(injected, candidate));
         process.argv = [process.execPath, cli, 'export', '--config', './drizzle.config.ts', '--sql'];
         require(cli);`,
        cli,
        String(candidate),
      ],
      {
        cwd: fixture,
        env: {
          PATH: process.env.PATH,
          DOTENV_CONFIG_PATH: disabledEnv,
          ESBK_DISABLE_CACHE: "1",
        },
        timeout: 10_000,
        maxBuffer: 64 * 1024,
        encoding: "utf8",
      },
    );
    expect(child.error).toBeUndefined();
    expect(child.status, child.stderr).toBe(0);
    expect(child.stderr).toBe("");
    expect(child.stdout.trim()).toBe(
      `Reading schema files:\n${resolve(fixture, "schema.ts")}\n\n` +
        "CREATE TABLE `synthetic_compatibility` (\n\t`id` int AUTO_INCREMENT NOT NULL,\n\t`name` varchar(64) NOT NULL,\n\tCONSTRAINT `synthetic_compatibility_id` PRIMARY KEY(`id`)\n);",
    );
    expect(readdirSync(fixture).sort()).toEqual(before);
  },
);
