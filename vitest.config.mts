import { configDefaults, defineConfig } from "vitest/config";
import path from "path";

// These legacy filenames also use the shared disposable database.
const mysqlTests = [
  "tests/**/*.mysql.test.ts",
  "tests/mysql-backup.test.ts",
  "tests/private-library.browser.test.ts",
];

export default defineConfig({
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
          name: "unit",
          include: ["tests/**/*.test.ts", "__tests__/**/*.test.ts"],
          exclude: [...configDefaults.exclude, ...mysqlTests],
          env: { BACKEND_TEST_DATABASE_URL: "" },
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: "mysql",
          include: mysqlTests,
          globalSetup: [
            path.resolve(
              import.meta.dirname,
              "tooling/scripts/sql-test-setup.ts",
            ),
          ],
          // Fault fixtures rename shared tables/change engines/install triggers.
          // Separate JS globals alone do not isolate their SQL side effects.
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
