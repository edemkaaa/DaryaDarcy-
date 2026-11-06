import "reflect-metadata";
import type { AddressInfo } from "node:net";
import { createConnection } from "mysql2/promise";
import { createBackendApplication } from "../../apps/backend/src/_core/application";
import { registerApiShutdown } from "../../apps/backend/src/_core/api-shutdown";
import { WorkerJobs } from "../../apps/backend/src/workers/worker-jobs.service";
import {
  WORKER_OPERATIONS,
  type WorkerOperations,
} from "../../apps/backend/src/workers/worker-operations";

async function main() {
  const app = await createBackendApplication();
  await app.listen(0, "127.0.0.1");
  const production = app.get<WorkerOperations>(WORKER_OPERATIONS);
  let release: (() => void) | undefined;
  // Настоящие scheduler, shutdown и MySQL-lock; вместо внешней отправки —
  // управляемая транзакция только в таблице одноразового тестового стенда.
  const operations: WorkerOperations = {
    ...production,
    runExclusiveJob: async (name, run) => {
      if (name === "publication") await production.runExclusiveJob(name, run);
    },
    publishDueScheduledPosts: async () => {
      const conn = await createConnection(process.env.DATABASE_URL!);
      try {
        await conn.beginTransaction();
        await conn.query(
          "UPDATE backend_shutdown_probe SET commits=commits+1 WHERE id=1",
        );
        await new Promise<void>((done) => {
          release = done;
          process.send?.({ holding: true });
        });
        await conn.commit();
        return [];
      } finally {
        await conn.end();
      }
    },
  };
  const jobs = new WorkerJobs(operations);
  registerApiShutdown(app, app.getHttpServer(), jobs);
  process.on("message", (input: { action: string }) => {
    void (async () => {
      if (input.action === "start") jobs.start();
      if (input.action === "release") release?.();
      if (input.action === "probe") {
        let runs = 0;
        await production.runExclusiveJob("publication", async () => {
          const conn = await createConnection(process.env.DATABASE_URL!);
          try {
            await conn.query(
              "UPDATE backend_shutdown_probe SET commits=commits+1 WHERE id=1",
            );
            runs++;
          } finally {
            await conn.end();
          }
        });
        process.send?.({ runs });
      }
    })().catch(() => process.send?.({ error: "fixture action failed" }));
  });
  process.send?.({
    base: `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`,
  });
}

void main().catch(() => process.exit(1));
