import "reflect-metadata";
import {
  createConnection,
  type Pool,
  type PoolConnection,
} from "mysql2/promise";
import type { AddressInfo } from "node:net";
import { createBackendApplication } from "../../apps/backend/src/_core/application";
import { getDb } from "../../apps/backend/src/database/connection";
import { runExclusiveWorker } from "../../apps/backend/src/database/coordination";

async function main() {
  const app = await createBackendApplication();
  await app.listen(0, "127.0.0.1");
  const db = await getDb();
  const pool = (db as typeof db & { $client: Pool }).$client;
  const borrow = pool.getConnection.bind(pool);
  let borrowed: PoolConnection;
  // Только тестовый перехват для fault injection: соединение настоящее,
  // production-код не получает команд освобождать чужую блокировку.
  pool.getConnection = async () => {
    borrowed = await borrow();
    return borrowed;
  };
  let held: PoolConnection;
  let release: (() => void) | undefined;
  let pending: Promise<void> | undefined;
  const effect = async () => {
    const conn = await createConnection(process.env.DATABASE_URL!);
    try {
      await conn.query(
        "INSERT INTO backend_lock_loss_effects(actor) VALUES(?)",
        [process.env.FIXTURE_ACTOR],
      );
    } finally {
      await conn.end();
    }
  };
  process.on("message", (input: { action: string }) => {
    void (async () => {
      switch (input.action) {
        case "hold":
          pending = runExclusiveWorker("lock-loss-fixture", async () => {
            held = borrowed;
            await new Promise<void>((done) => {
              release = done;
              process.send?.({ holding: true, connectionId: held.threadId });
            });
            await effect();
          });
          void pending.catch(() => {});
          break;
        case "release":
          release?.();
          await pending;
          process.send?.({ released: true });
          break;
        case "unlock":
          await held.query("SELECT RELEASE_ALL_LOCKS()");
          process.send?.({ unlocked: true });
          break;
        case "probe": {
          let runs = 0;
          await runExclusiveWorker("lock-loss-fixture", async () => {
            await effect();
            runs++;
          });
          process.send?.({ runs });
          break;
        }
      }
    })().catch(() => process.send?.({ error: "fixture action failed" }));
  });
  process.send?.({
    base: `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`,
  });
}
void main().catch(() => process.exit(1));
