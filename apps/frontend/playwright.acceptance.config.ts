/** Проверяем выбранные сценарии в мобильных профилях Chromium/WebKit; эмуляция не подтверждает работу физического iPhone или установленной PWA. */
import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

// Mobile browser profiles. These do not certify physical devices or installed PWA.
export default defineConfig({
  ...base,
  outputDir: "test-results/acceptance",
  testMatch: [
    "article-request-states.spec.ts",
    "vk-editor.spec.ts",
    "vk-video.spec.ts",
    "media-failure-lifecycle.spec.ts",
    "image-loading.spec.ts",
    "image-hung-response.spec.ts",
    "media-upload-contract.spec.ts",
    "auth-keyboard.spec.ts",
    "post-inline-links.spec.ts",
    "post-draft-recovery.spec.ts",
    "post-editor-typing.spec.ts",
    "post-editor-keyboard.spec.ts",
    "post-photo-layout.spec.ts",
    "accessibility-actions.spec.ts",
    "cache-and-resume.spec.ts",
    "navigation-layout.spec.ts",
    "long-lists.spec.ts",
    "editor-safety.spec.ts",
  ],
  projects: [
    {
      name: "chromium-mobile",
      use: {
        ...devices["Pixel 7"],
        launchOptions: process.env.PLAYWRIGHT_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
          : {},
      },
    },
    {
      name: "webkit-mobile",
      use: {
        ...devices["iPhone 13"],
        launchOptions: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE_PATH }
          : {},
      },
    },
  ],
});
