// Собирает независимые варианты TEST и гостевой LIVE-формы и проверяет обязательные браузерные сценарии. Пропуски или flaky-результаты не считаются успешной приёмкой.
// Two separate build-time variants; runtime flags cannot reconfigure Next output.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import { randomUUID } from "node:crypto";

const legacyGuest =
  "guests keep the existing checkout even when the NORMAL integration build is enabled";
const profiles = {
  "prodamus-test": ["prodamus-return.spec.ts", "guest-contact-fields.spec.ts"],
  "guest-normal": [
    "guest-checkout-recovery.spec.ts",
    "normal-checkout-recovery.spec.ts",
  ],
};
try {
  const profile = process.argv[2];
  if (process.argv.length !== 3 || !Object.hasOwn(profiles, profile))
    throw new Error("Choose prodamus-test or guest-normal");
  const files = profiles[profile];
  const report = resolve(
    "apps/frontend/test-results",
    `checkout-${profile}-${randomUUID()}`,
    "report.json",
  );
  mkdirSync(resolve(report, ".."), { recursive: true });
  const env = {
    ...process.env,
    // Do not silently reuse a different locally running Next build.
    CI: "true",
    DATABASE_URL: "",
    BACKEND_TEST_DATABASE_URL: "",
    API_PROXY_TARGET: "",
    NEXT_PUBLIC_API_BASE_URL: "",
    NEXT_PUBLIC_CLUB_TEST_CHECKOUT: "false",
    NEXT_PUBLIC_PRODAMUS_TEST_ENABLED: String(profile === "prodamus-test"),
    NEXT_PUBLIC_NORMAL_CHECKOUT_RECOVERY_ENABLED: "true",
    // TEST must keep precedence even when the guest LIVE build flag is enabled.
    NEXT_PUBLIC_GUEST_CHECKOUT_RECOVERY_ENABLED: "true",
    NEXT_PUBLIC_VK_CATALOG_ENABLED: "false",
    NEXT_PUBLIC_VIDEO_THUMBNAILS_ENABLED: "false",
    NEXT_PUBLIC_PRIVATE_LIBRARY_FILES_ENABLED: "false",
    PRODAMUS_RETURN_UI_ENABLED: String(profile === "prodamus-test"),
    NORMAL_CHECKOUT_UI_ENABLED: String(profile === "guest-normal"),
    GUEST_CHECKOUT_UI_ENABLED: String(profile === "guest-normal"),
    PLAYWRIGHT_JSON_OUTPUT_FILE: report,
  };
  function run(args) {
    // Запускает сборку или Playwright с одним выбранным профилем и прерывает при ошибке до разбора результатов.

    const child = spawnSync("pnpm", args, { env, stdio: "inherit" });
    if (child.error) throw new Error("Cannot start verification command");
    if (child.status !== 0) {
      const error = new Error("Build or browser verification failed");
      error.exitCode = child.status ?? 1;
      throw error;
    }
  }
  run(["build:web"]);
  run([
    "--filter",
    "@daryadarcy/frontend",
    "exec",
    "playwright",
    "test",
    ...(profile === "guest-normal"
      ? ["--config", "playwright.guest-checkout.config.ts"]
      : files),
    "--reporter=list,json",
  ]);
  const data = JSON.parse(readFileSync(report, "utf8"));
  const passed = new Map(files.map((file) => [file, 0]));
  let skipped = 0;
  function inspect(suite) {
    // Рекурсивно проверяет JSON-отчёт: обязательные suites должны действительно пройти без неизвестных skips, retries и flaky.

    for (const spec of suite.specs ?? [])
      for (const test of spec.tests ?? []) {
        const file = basename(spec.file ?? suite.file ?? "");
        const last = test.results?.at(-1)?.status;
        if (!passed.has(file)) throw new Error("Unexpected test suite");
        if (
          last === "skipped" &&
          profile === "guest-normal" &&
          file === "normal-checkout-recovery.spec.ts" &&
          spec.title === legacyGuest &&
          skipped === 0
        )
          skipped++;
        else if (last === "passed" && test.status === "expected")
          passed.set(file, passed.get(file) + 1);
        else throw new Error("Unexpected failure, retry or skipped scenario");
      }
    for (const child of suite.suites ?? []) inspect(child);
  }
  if (
    !Array.isArray(data.suites) ||
    data.stats?.unexpected !== 0 ||
    data.stats?.flaky !== 0
  )
    throw new Error("Invalid or unsuccessful browser report");
  data.suites.forEach(inspect);
  if ([...passed.values()].some((count) => count === 0))
    throw new Error("Required suite did not run");
  console.log(
    JSON.stringify({
      profile,
      passed: Object.fromEntries(passed),
      skipped,
      report,
    }),
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = error.exitCode ?? 1;
}
