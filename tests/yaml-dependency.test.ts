/** Проверяем YAML-зависимость Vite на ограничении глубины и сохранении обычных конфигураций. */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { expect, it } from "vitest";

const toolingRequire = createRequire(require.resolve("vite/package.json"));
const yamlPath = toolingRequire.resolve("yaml");

/** Три parser API должны дать контролируемый RESOURCE_EXHAUSTION в ограниченном дочернем процессе. */
it.each(["parse", "parseDocument", "parseAllDocuments"])(
  "%s reports a YAML error for deeply nested collections",
  (method) => {
    const output = execFileSync(
      process.execPath,
      [
        "--max-old-space-size=64",
        "-e",
        `const yaml = require(process.argv[1]);
       const input = '['.repeat(5000) + '1' + ']'.repeat(5000);
       try {
         const result = yaml[process.argv[2]](input);
         const document = Array.isArray(result) ? result[0] : result;
         const error = document.errors?.[0];
         console.log(JSON.stringify({ kind: error?.name, code: error?.code }));
       } catch (error) {
         console.log(JSON.stringify({ kind: error.name, code: error.code }));
       }`,
        yamlPath,
        method,
      ],
      { encoding: "utf8", timeout: 2000, maxBuffer: 4096 },
    );
    expect(JSON.parse(output)).toEqual({
      kind: "YAMLParseError",
      code: "RESOURCE_EXHAUSTION",
    });
  },
);

/** Положительные проверки сохраняют значения, несколько документов и flow-форматирование. */
it("preserves ordinary tooling configuration, documents and flow formatting", () => {
  const yaml = toolingRequire("yaml") as typeof import("yaml");
  expect(yaml.parse("name: local\nflags: [one, two]\nenabled: true\n")).toEqual(
    { name: "local", flags: ["one", "two"], enabled: true },
  );
  expect(
    yaml
      .parseAllDocuments("name: first\n---\nname: second\n")
      .map((doc) => doc.toJS()),
  ).toEqual([{ name: "first" }, { name: "second" }]);
  const doc = yaml.parseDocument("[one, two]");
  expect(doc.toString()).toBe("[ one, two ]\n");
});
