/** Дочерний CLI проверяется только на синтетических sandbox-настройках, без платежа. */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const fixture = {
  PRODAMUS_SANDBOX_ENABLED: "true",
  PRODAMUS_SANDBOX_PAYFORM_URL: "https://testpage1.payform.ru",
  PRODAMUS_SANDBOX_SECRET: "a".repeat(64),
  PRODAMUS_SANDBOX_ORDER_ID: "dd-demo-83be933e-a277-41f3-801d-45771c12b051",
  PRODAMUS_SANDBOX_SYS: "daryadarcy",
  PUBLIC_APP_URL: "https://daryadarcy.dev.reeskeen.ru",
};
/** Запускаем локальный генератор ссылки с изолированным env и ограничением времени. */
function run(env = fixture, args: string[] = []) {
  return spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      resolve("tooling/scripts/prodamus-sandbox-link.ts"),
      ...args,
    ],
    {
      env,
      encoding: "utf8",
      timeout: 5000,
    },
  );
}
/** Детерминированный вывод содержит demo URL и accessGranted:false, без секрета и реального email. */
it("prints only a synthetic demo link and an explicit no-access result", () => {
  const result = run();
  expect(result.status).toBe(0);
  expect(result.stderr).toBe("");
  const output = JSON.parse(result.stdout);
  expect(output).toMatchObject({ mode: "demo", accessGranted: false });
  const link = new URL(output.checkoutUrl);
  expect(link.origin).toBe("https://testpage1.payform.ru");
  expect(link.searchParams.get("demo_mode")).toBe("1");
  expect(link.searchParams.get("customer_email")).toBe(
    "prodamus-demo@example.test",
  );
  expect(result.stdout).not.toContain(fixture.PRODAMUS_SANDBOX_SECRET);
  expect(run().stdout).toBe(result.stdout);
});
/** Выключенный sandbox возвращает только безопасное сообщение и ненулевой exit. */
it("refuses disabled mode without leaking configuration or a stack", () => {
  const result = run({ ...fixture, PRODAMUS_SANDBOX_ENABLED: "false" });
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toBe("Prodamus sandbox is not configured\n");
});
/** CLI не разрешает подменить синтетического получателя произвольным аргументом. */
it("refuses user input overrides rather than taking an email or a live merchant", () => {
  const result = run(fixture, ["--email=real@gmail.com"]);
  expect(result.status).toBe(1);
  expect(result.stdout).toBe("");
  expect(result.stderr).toBe(
    "Sandbox link does not accept command-line overrides\n",
  );
});
