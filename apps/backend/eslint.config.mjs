import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

export default [
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        // Same compiler options; exclude the unrelated frontend/test entrypoints.
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: fileURLToPath(new URL(".", import.meta.url)),
      },
    },
    plugins: { "@typescript-eslint": tseslint.plugin },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    // Start with correctness, not style: no mass formatting or legacy any cleanup.
    rules: {
      "no-async-promise-executor": "error",
      "no-promise-executor-return": "error",
      "no-unsafe-finally": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },
];
