import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      // Media wrappers intentionally use DOM images for measured galleries.
      "@next/next/no-img-element": "off",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // React Compiler is not enabled. Mutable DOM/media/animation handles are
      // intentional; retain the conventional hook-order and dependency checks.
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["src/shared/api/contract.ts"],
    // Generated inputs mirror the backend schema, including its z.any() fields.
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
  globalIgnores([
    ".next/**",
    "next-env.d.ts",
    "test-results/**",
    "playwright-report/**",
  ]),
]);
