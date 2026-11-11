/** Проверяем установленный YAML-парсер ESLint на ограничениях merge/nesting и обычных конфигурациях. */
import { createRequire } from "node:module";
import { expect, it } from "vitest";

const lintRequire = createRequire(require.resolve("eslint/package.json"));
const configRequire = createRequire(lintRequire.resolve("@eslint/eslintrc"));
const yaml = configRequire("js-yaml") as {
  load: (source: string, options?: { maxTotalMergeKeys?: number }) => unknown;
  loadAll: (source: string) => unknown[];
  dump: (value: unknown) => string;
};

// Small real inputs demonstrate rejection, without causing CPU or heap exhaustion.
/** Даже пустые источники слияния должны расходовать вычислительный бюджет. */
it("charges empty merge sources against the configured processing budget", () => {
  expect(() =>
    yaml.load("sources: &sources [{}, {}, {}, {}]\ntarget: {<<: *sources}", {
      maxTotalMergeKeys: 3,
    }),
  ).toThrow(/merge keys exceeded maxTotalMergeKeys/);
});

/** Отключение одного бюджета не должно убирать предел длины merge-последовательности. */
it("rejects oversized merge sequences even if the key budget is disabled", () => {
  const source = `sources: &sources [${Array(101).fill("{}").join(",")}]
target: {<<: *sources}`;
  expect(() => yaml.load(source, { maxTotalMergeKeys: -1 })).toThrow(
    /merge sequence/,
  );
});

/** Глубокий малый ввод должен завершаться контролируемой YAML-ошибкой. */
it("rejects excessive nesting with a YAML error rather than unbounded recursion", () => {
  const source = "[".repeat(105) + "0" + "]".repeat(105);
  expect(() => yaml.load(source)).toThrow(/nesting exceeded maxDepth/);
});

/** Проверяем обычные настройки, precedence слияния, ordered map и несколько документов. */
it("preserves ordinary ESLint YAML, merges, ordered maps and document round trips", () => {
  const config = {
    root: true,
    env: { browser: true, es2022: true },
    extends: ["eslint:recommended"],
    rules: { "no-console": "warn", quotes: ["error", "double"] },
  };
  expect(yaml.load(yaml.dump(config))).toEqual(config);
  expect(
    yaml.load("base: &base {a: 1, b: 2}\ntarget: {<<: *base, b: 3}"),
  ).toEqual({ base: { a: 1, b: 2 }, target: { a: 1, b: 3 } });
  const orderedMap: Record<string, number>[] = [
    { constructor: 1 },
    { toString: 2 },
  ];
  expect(yaml.load("!!omap [{constructor: 1}, {toString: 2}]")).toEqual(
    orderedMap,
  );
  expect(yaml.loadAll("---\na: 1\n---\nb: 2\n")).toEqual([{ a: 1 }, { b: 2 }]);
});
