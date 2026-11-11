/** Проверяем path-to-regexp из Express с ограниченным дочерним процессом и синтетическим маршрутом. */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { expect, it } from "vitest";

/** Маршрут с несколькими параметрами должен быстро отклонить несовместимый путь; timeout завершает дочерний процесс, а не блокирует worker. */
it("rejects a bounded adversarial multi-parameter path without runaway backtracking", () => {
  const expressRequire = createRequire(require.resolve("express"));
  // Characterize GHSA-37ch-88jc-xwx2 through Express's actual dependency.
  // Keep vulnerable matching in a killed-on-timeout child, not the test worker.
  const result = spawnSync(
    process.execPath,
    [
      "-e",
      `const compile = require(process.argv[1]);
       const pattern = compile("/:a-:b-:c-:d");
       console.log(pattern.test("/" + "a-".repeat(2048) + "a/extra"));`,
      expressRequire.resolve("path-to-regexp"),
    ],
    { encoding: "utf8", timeout: 2000, killSignal: "SIGKILL", maxBuffer: 4096 },
  );
  expect(result.error?.message).toBeUndefined();
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe("false");
  expect(result.stderr).toBe("");
});
