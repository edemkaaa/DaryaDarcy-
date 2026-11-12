/** Выбираем только guest/NORMAL recovery и отключаем TEST-ожидания; нужны соответствующие флаги уже собранного клиента. */
import { defineConfig } from "@playwright/test";
import base from "../../playwright.config";

// Match a build with NEXT_PUBLIC_GUEST_CHECKOUT_RECOVERY_ENABLED=true,
// NEXT_PUBLIC_NORMAL_CHECKOUT_RECOVERY_ENABLED=true and both TEST flags=false.
process.env.PRODAMUS_RETURN_UI_ENABLED = "false";
process.env.GUEST_CHECKOUT_UI_ENABLED = "true";
process.env.NORMAL_CHECKOUT_UI_ENABLED = "true";
export default defineConfig({
  ...base,
  testMatch: [
    "guest-checkout-recovery.spec.ts",
    "normal-checkout-recovery.spec.ts",
  ],
  outputDir: "../../test-results/guest-checkout",
});
