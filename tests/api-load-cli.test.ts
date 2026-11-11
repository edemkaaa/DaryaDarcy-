/** Проверяем, что локальный нагрузочный CLI отказывается наследовать рабочую конфигурацию до Docker и SQL. */
import { describe, expect, it } from "vitest";
import { spawn } from "node:child_process";

/** Запускаем отдельный процесс с искусственным опасным DATABASE_URL; соединение с ним не разрешается. */
describe("local load CLI preflight", () => {
  /** Требуем отказ preflight и отсутствие адреса/пароля в объединённом stdout/stderr. */
  it("refuses inherited working configuration before Docker/SQL without printing it", async () => {
    const result = await new Promise<{ code: number | null; output: string }>(
      (resolve, reject) => {
        const child = spawn(
          process.execPath,
          [
            "--import",
            "tsx",
            "tooling/scripts/api-load-local.ts",
            "--run-owned-local",
          ],
          {
            cwd: new URL("../", import.meta.url),
            timeout: 10000,
            env: {
              PATH: process.env.PATH,
              JWT_SECRET: "load-fixture-local-secret",
              LOAD_DATABASE_URL:
                "mysql://fixture:only@127.0.0.1:54123/backend_test",
              LOAD_DATABASE_CONTAINER_ID: "a".repeat(64),
              DATABASE_URL:
                "mysql://working:private-sentinel@192.0.2.1/working",
            },
          },
        );
        let output = "";
        child.stdout.on("data", (chunk) => (output += chunk));
        child.stderr.on("data", (chunk) => (output += chunk));
        child.once("error", reject);
        child.once("close", (code) => resolve({ code, output }));
      },
    );
    expect(result.code).toBe(1);
    expect(result.output).toContain("Load preflight refused");
    expect(result.output).not.toMatch(
      /private-sentinel|192\.0\.2\.1|mysql:\/\//,
    );
  });
});
