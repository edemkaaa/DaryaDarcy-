import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "apps/frontend"),
      "@shared": path.resolve(import.meta.dirname, "packages/shared/src"),
    },
  },
  test: {
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
});
