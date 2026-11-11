/** Конфигурация архивной сборки Vite. Результат web-dist отделён от действующей Next-сборки. */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: dir,
  plugins: [react()],
  resolve: {
    alias: {
      "@site": path.resolve(dir, "src"),
    },
  },
  build: {
    outDir: path.resolve(dir, "../../web-dist"),
    emptyOutDir: true,
    target: "es2020",
    cssMinify: true,
    rollupOptions: {
      output: {
        /** Выносит React и транспорт запросов в общие chunks по прежней эвристике путей зависимостей. */
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("react-dom") || id.includes("react-router")) {
            return "react";
          }
          if (id.includes("@tanstack") || id.includes("@trpc") || id.includes("superjson")) {
            return "query";
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:3000",
    },
  },
});
