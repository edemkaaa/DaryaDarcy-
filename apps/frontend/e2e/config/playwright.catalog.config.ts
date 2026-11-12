/** Тестовые ожидания каталога должны совпадать со сборочными VK/thumbnail-флагами; конфигурация сама frontend не пересобирает. */
import { defineConfig } from "@playwright/test";
import base from "../../playwright.config";

// Focused catalog suite: use a build with NEXT_PUBLIC_VK_CATALOG_ENABLED=true.
// Pass VIDEO_THUMBNAILS_UI_ENABLED to match that build's optional cover flag.
process.env.VK_CATALOG_UI_ENABLED = "true";
process.env.VIDEO_THUMBNAILS_UI_ENABLED ??=
  process.env.NEXT_PUBLIC_VIDEO_THUMBNAILS_ENABLED ?? "false";

export default defineConfig({
  ...base,
  testMatch: [
    "video-catalog.spec.ts",
    "vk-catalog-revisions.spec.ts",
    "vk-video.spec.ts",
    "content-refresh.spec.ts",
    "media-failure-lifecycle.spec.ts",
    "status-notice-layout.spec.ts",
  ],
  outputDir: "../../test-results/catalog",
});
