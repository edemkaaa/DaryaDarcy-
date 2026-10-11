import { createRequire } from "node:module";
import { expect, it } from "vitest";

const postcssRequire = createRequire(require.resolve("postcss"));
const { SourceMapConsumer } = postcssRequire(
  "source-map-js",
) as typeof import("source-map-js");

function indexedMap(line: number) {
  // Upstream runtime supports indexed maps; its declarations only expose flat
  // RawSourceMap. Keep this compatibility cast at the synthetic fixture boundary.
  return {
    version: 3,
    sections: [
      {
        offset: { line, column: 0 },
        map: {
          version: 3,
          sources: ["fixture.ts"],
          names: [],
          mappings: "AAAA",
        },
      },
    ],
  } as unknown as ConstructorParameters<typeof SourceMapConsumer>[0];
}

// Characterize the installed PostCSS dependency, not an app exploit.
// Construction only: never flatten the malicious offsets into a huge string.
it.each([-1, 0.5, Infinity, 100_000_000])(
  "rejects unsafe indexed-map line offset %s before serialization",
  (line) => {
    expect(() => new SourceMapConsumer(indexedMap(line))).toThrow();
  },
);

it("keeps valid indexed-map source positions intact", () => {
  const consumer = new SourceMapConsumer(indexedMap(2));
  const mappings: unknown[] = [];
  consumer.eachMapping((mapping) => mappings.push(mapping));
  expect(mappings).toEqual([
    {
      source: "fixture.ts",
      generatedLine: 3,
      generatedColumn: 0,
      originalLine: 1,
      originalColumn: 0,
      name: null,
    },
  ]);
});
