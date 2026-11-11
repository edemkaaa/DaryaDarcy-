/** Проверяем действующую typed ESLint-конфигурацию сервера на коде в памяти. */
import { ESLint } from "eslint";
import { resolve } from "node:path";
import { expect, it } from "vitest";

/** Используем настоящий путь проекта: незавершённые Promise и опасный finally обязаны дать конкретные правила, корректный await/catch должен пройти. */
it("rejects unsafe async code while accepting awaited and handled operations", async () => {
  const cwd = resolve("apps/backend");
  const eslint = new ESLint({ cwd, overrideConfigFile: resolve(cwd, "eslint.config.mjs") });
  // Use a real project path so the production typed configuration is exercised.
  const filePath = resolve(cwd, "src/_core/async-handler.ts");
  const [unsafe] = await eslint.lintText(`
    declare function save(): Promise<void>;
    declare function listen(callback: () => void): void;
    save();
    listen(async () => { await save(); });
    const pending = new Promise(async resolve => { resolve(1); });
    const returned = new Promise(resolve => resolve(1));
    function cleanup() { try { return 1; } finally { throw Error("lost"); } }
  `, { filePath });
  expect([...new Set(unsafe.messages.map(message => message.ruleId))].sort()).toEqual([
    "@typescript-eslint/no-floating-promises",
    "@typescript-eslint/no-misused-promises",
    "no-async-promise-executor",
    "no-promise-executor-return",
    "no-unsafe-finally",
  ].sort());
  const [safe] = await eslint.lintText(`
    declare function save(): Promise<void>;
    declare function failed(error: unknown): void;
    declare function listen(callback: () => void): void;
    export async function run() { await save(); }
    listen(() => { void save().catch(failed); });
  `, { filePath });
  expect(safe.messages).toEqual([]);
}, 20_000);
