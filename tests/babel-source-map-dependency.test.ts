/** Проверяем установленный Babel из styled-jsx на синтетических source maps, не читая пользовательские файлы. */
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const styledJsxRequire = createRequire(
  require.resolve("styled-jsx/package.json"),
);
// Babel ships JS without declarations. Describe only this fixture's boundary;
// do not add a production dependency or a global ambient `any` declaration.
const babel = styledJsxRequire("@babel/core") as {
  transformSync(
    code: string,
    options: {
      filename: string;
      root: string;
      babelrc: false;
      configFile: false;
      sourceMaps: true;
    },
  ): {
    code?: string | null;
    map?: { sourcesContent?: string[] } | null;
  } | null;
};
const fixtureRoot = resolve("tests/fixtures/babel-source-map/project");

// Narrow characterization of Next/styled-jsx's installed compiler dependency.
// Only committed synthetic maps are read; no secrets, temp files or mocks.
/** Компилирует фиксированный JS без внешней Babel-конфигурации и с заданной ссылкой на карту тестового пакета. */
function compileWithMap(mapReference: string) {
  return babel.transformSync(
    `const value = 1;\n//# sourceMappingURL=${mapReference}`,
    {
      filename: resolve(fixtureRoot, "input.js"),
      root: fixtureRoot,
      babelrc: false,
      configFile: false,
      sourceMaps: true,
    },
  );
}

/** Относительный или абсолютный выход за fixture package не должен раскрывать marker соседней карты. */
it.each(["../outside.map", resolve(fixtureRoot, "../outside.map")])(
  "does not disclose another package's map through %s",
  (mapReference) => {
    const result = compileWithMap(mapReference);
    expect(result?.code).toContain("const value = 1");
    expect(JSON.stringify(result?.map)).not.toContain("outside-package-marker");
  },
);

/** Положительный контроль сохраняет допустимую соседнюю карту и её sourcesContent. */
it("preserves an adjacent map within the compiled package", () => {
  expect(compileWithMap("adjacent.map")?.map?.sourcesContent).toEqual([
    "const adjacentFixture = 'adjacent-package-marker';",
  ]);
});
