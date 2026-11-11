/** Проверяем shell-quote, реально используемый concurrently, без выполнения полученных строк как команд. */
import { createRequire } from "node:module";
import { expect, it } from "vitest";

// Resolve the copies actually used by consumers, not a test-only direct install.
const requireConcurrent = createRequire(require.resolve("concurrently/package.json"));
const quote = requireConcurrent("shell-quote") as { quote(input: unknown[]): string; parse(input: string): unknown[] };
/** Оператор с переводом строки должен быть отвергнут до формирования дополнительной shell-команды. */
it("rejects line terminators in shell operator objects rather than producing another command", () => {
  expect(() => quote.quote(["printf", { op: "\nprintf INJECTED" }])).toThrow();
});
/** Пробелы, апострофы, буквальный доллар и переводы строк в обычных аргументах сохраняются после quote/parse. */
it("preserves ordinary quoted development-command arguments", () => {
  const args = ["node", "path with spaces", "it's quoted", "literal $text", "", "line\nbreak"];
  expect(quote.parse(quote.quote(args))).toEqual(args);
});
