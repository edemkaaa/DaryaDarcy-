/** Линтер активного Nest backend проверяет ошибки promise/finally по собственной TypeScript-программе, не втягивая фронт и тестовые entrypoints. */
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

export default [
  {
/** Область ограничена src backend; отдельный workspace запускает этот конфиг из apps/backend. */
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
/** Типовые правила получают tsconfig.eslint и корень именно backend workspace, независимо от root tsconfig. */
      parserOptions: {
        // Same compiler options; exclude the unrelated frontend/test entrypoints.
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: fileURLToPath(new URL(".", import.meta.url)),
      },
    },
    plugins: { "@typescript-eslint": tseslint.plugin },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    // Start with correctness, not style: no mass formatting or legacy any cleanup.
/** Выбраны проверки потенциально потерянных promise/ошибок; массовое форматирование и переписывание legacy any сюда не входят. */
    rules: {
      "no-async-promise-executor": "error",
      "no-promise-executor-return": "error",
      "no-unsafe-finally": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
    },
  },
];
