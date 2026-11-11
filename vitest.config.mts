/** Разделяем независимые unit/HTTP проверки и suites, меняющие общую одноразовую MySQL: изоляция JS-модулей не изолирует SQL. */
import { configDefaults, defineConfig } from "vitest/config";
import path from "path";

// Старые имена тоже относятся к SQL-проекту: их нельзя случайно запустить параллельно как unit.
const mysqlTests = [
  "tests/**/*.mysql.test.ts",
  "tests/mysql-backup.test.ts",
  "tests/private-library.browser.test.ts",
];

export default defineConfig({
  // Alias совпадают с TypeScript/frontend: тестируется production-модуль, а не отдельная копия.
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "apps/frontend/src"),
      "@shared": path.resolve(import.meta.dirname, "packages/shared/src"),
    },
  },
  test: {
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    projects: [
      {
        extends: true,
        test: {
          // Unit-файлы идут параллельно до SQL-группы; реальный test URL принудительно очищен.
          name: "unit",
          include: ["tests/**/*.test.ts"],
          exclude: [...configDefaults.exclude, ...mysqlTests],
          env: { BACKEND_TEST_DATABASE_URL: "" },
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          // Отдельный globalSetup валидирует цель до исполнения любого SQL suite.
          name: "mysql",
          include: mysqlTests,
          globalSetup: [
            path.resolve(
              import.meta.dirname,
              "tooling/scripts/sql-test-setup.ts",
            ),
          ],
          // Fault-фикстуры меняют таблицы, engines и triggers общей backend_test.
          // Поэтому файлы идут по одному, даже при независимых globals каждого worker.
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
