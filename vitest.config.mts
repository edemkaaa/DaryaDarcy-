import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "apps/frontend/src"),
      "@shared": path.resolve(import.meta.dirname, "packages/shared/src"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts", "__tests__/**/*.test.ts"],
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
