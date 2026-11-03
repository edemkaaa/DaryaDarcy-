import { build } from "esbuild";
import { expect, it } from "vitest";

it("content persistence compiles without importing the aggregate database facade", async () => {
  // Writers receive a transaction. Importing them must not load the facade
  // which itself composes those writers, pool, billing and unrelated features.
  const result = await build({
    stdin: {
      resolveDir: process.cwd(),
      loader: "ts",
      contents: `
        export * from "./apps/backend/src/content/post-creator";
        export * from "./apps/backend/src/content/post-editor";
        export * from "./apps/backend/src/content/article-writes";
      `,
    },
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    write: false,
    logLevel: "silent",
    plugins: [
      {
        name: "forbid-aggregate-db-in-content-writer",
        setup(builder) {
          builder.onResolve({ filter: /^\.\.\/db(?:\.js)?$/ }, () => ({
            errors: [
              {
                text: "Content writers must not import the composing db facade",
              },
            ],
          }));
        },
      },
    ],
  });
  expect(result.outputFiles[0].text).toContain("export");
});
