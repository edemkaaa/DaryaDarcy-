/** Изолированный дочерний запуск sandbox проверяет отказ при неполных/смешанных настройках. */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, it } from "vitest";

/** Ожидаем ненулевой выход и только общую ошибку: значения тестовых секретов не должны попасть в stdout/stderr. */
it.each([
  {
    PRODAMUS_SANDBOX_ENABLED: "false",
    PRODAMUS_SANDBOX_SECRET: "PRIVATE_FIXTURE",
  },
  { PRODAMUS_SANDBOX_ENABLED: "true", PRODAMUS_SECRET: "PRIVATE_LIVE_FIXTURE" },
])(
  "refuses to start an unconfigured standalone listener without exposing its environment",
  (env) => {
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        "tsx",
        resolve("apps/backend/src/billing/prodamus-sandbox.index.ts"),
      ],
      {
        env: { NODE_ENV: "production", ...env },
        encoding: "utf8",
        timeout: 5000,
      },
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("Prodamus sandbox startup failed\n");
  },
);
