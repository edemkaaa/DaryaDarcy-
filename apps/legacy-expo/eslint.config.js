// Архив Expo. Flat-конфигурация Expo ESLint с исключением собранного dist.
// https://docs.expo.dev/guides/using-eslint/
import { defineConfig } from "eslint/config";
import expoConfig from "eslint-config-expo/flat.js";

export default defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
]);
