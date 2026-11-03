import "reflect-metadata";
import type { AddressInfo } from "node:net";
import { createBackendApplication } from "../../apps/backend/src/_core/application";
import {
  checkSharedRateLimit,
  beginSharedLogin,
} from "../../apps/backend/src/database/shared-limits";
import { runExclusiveWorker } from "../../apps/backend/src/database/coordination";

async function main() {
  const app = await createBackendApplication();
  await app.listen(0, "127.0.0.1");
  let release: (() => void) | undefined;
  let holding: Promise<void> | undefined;
  process.on("message", (input: { action: string; key: string }) => {
    void (async () => {
      switch (input.action) {
        case "rate":
          process.send?.(await checkSharedRateLimit(input.key, 2, 60_000));
          break;
        case "login": {
          const admission = await beginSharedLogin(input.key);
          process.send?.(admission.ok ? { ok: true } : admission);
          break;
        }
        case "hold": {
          const gate = new Promise<void>((done) => {
            release = done;
          });
          holding = runExclusiveWorker("shared-fixture", async () => {
            process.send?.({ holding: true });
            await gate;
          });
          break;
        }
        case "release":
          release?.();
          await holding;
          process.send?.({ released: true });
          break;
        case "job": {
          let runs = 0;
          await runExclusiveWorker("shared-fixture", async () => {
            runs++;
          });
          process.send?.({ runs });
          break;
        }
      }
    })().catch(() => {
      process.send?.({ error: "fixture action failed" });
    });
  });
  process.send?.({
    base: `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`,
  });
}
void main().catch(() => {
  process.exitCode = 1;
  process.disconnect?.();
});
