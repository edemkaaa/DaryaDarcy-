// Архив Expo. Собирает ограниченный TAR полностью в памяти без записи и извлечения файлов.
import { createRequire } from "node:module";
import { gzipSync } from "node:zlib";
import { expect, it } from "vitest";

// Resolve the copies actually used by consumers, not a test-only direct install.
const requireConcurrent = createRequire(require.resolve("concurrently/package.json"));
const quote = requireConcurrent("shell-quote") as { quote(input: unknown[]): string; parse(input: string): unknown[] };
const requireExpo = createRequire(require.resolve("expo/package.json"));
const requireCli = createRequire(requireExpo.resolve("@expo/cli/package.json"));
const tar = requireCli("tar");

it("rejects line terminators in shell operator objects rather than producing another command", () => {
    // Сценарий: Отклоняет перевод строки в shell-операторе ограниченной фикстуры.

  expect(() => quote.quote(["printf", { op: "\nprintf INJECTED" }])).toThrow();
});
it("preserves ordinary quoted development-command arguments", () => {
    // Сценарий: Проверяет обратимость quoting обычных аргументов, включая пробелы и буквальный доллар.

  const args = ["node", "path with spaces", "it's quoted", "literal $text", "", "line\nbreak"];
  expect(quote.parse(quote.quote(args))).toEqual(args);
});

function archive(contents: Buffer) {
  // Собирает ограниченный TAR полностью в памяти без записи и извлечения файлов.

  const header = Buffer.alloc(512);
  new tar.Header({ path: "fixture.txt", size: contents.length, mode: 0o644, type: "File" }).encode(header);
  return Buffer.concat([header, contents, Buffer.alloc((512 - contents.length % 512) % 512 + 1024)]);
}
async function parse(data: Buffer, options: Record<string, unknown> = {}) {
  // Читает TAR parser в памяти, собирая entries и ожидаемую ошибку ограничения распаковки.

  const entries: { path: string; data: string }[] = [];
  const parser = new tar.Parser(options);
  const error = await new Promise<Error | null>(resolve => {
    parser.on("error", resolve);
    parser.on("end", () => resolve(null));
    parser.on("entry", (entry: { path: string; on: Function }) => {
      const chunks: Buffer[] = [];
      entry.on("data", (chunk: Buffer) => chunks.push(chunk));
      entry.on("end", () => entries.push({ path: entry.path, data: Buffer.concat(chunks).toString() }));
    });
    parser.end(data);
  });
  return { entries, error };
}
it("retains ordinary Expo archive parsing without extracting files", async () => {
    // Сценарий: Проверяет обычный gzip TAR в памяти без распаковки на диск.

  const result = await parse(gzipSync(archive(Buffer.from("fixture"))));
  expect(result.error).toBeNull();
  expect(result.entries).toEqual([{ path: "fixture.txt", data: "fixture" }]);
});
it("stops a bounded local compressed fixture at the configured expansion ratio", async () => {
    // Сценарий: Проверяет остановку ограниченной распаковки по коэффициенту расширения.

  const result = await parse(gzipSync(archive(Buffer.alloc(1024 * 1024))), { maxDecompressionRatio: 2 });
  expect(result.error).toBeInstanceOf(Error);
  expect(result.error?.message).toContain("max decompression ratio exceeded");
});
