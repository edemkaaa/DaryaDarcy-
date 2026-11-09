import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { createConnection, type RowDataPacket } from "mysql2/promise";
import { createBackendApplication } from "../../apps/backend/src/_core/application";
import { WorkerJobs } from "../../apps/backend/src/workers/worker-jobs.service";
import {
  WORKER_OPERATIONS,
  type WorkerOperations,
} from "../../apps/backend/src/workers/worker-operations";

async function main() {
  const url = process.env.DATABASE_URL!;
  if (
    process.env.NODE_ENV !== "test" ||
    new URL(url).pathname !== "/backend_test"
  )
    throw new Error("Disposable fixture database required");
  const app = await createBackendApplication();
  const actor = process.env.FIXTURE_ACTOR!;
  const boot = randomUUID();
  const control = await createConnection(url);
  await control.query(
    "INSERT INTO backend_restart_boots(actor,boot) VALUES(?,?)",
    [actor, boot],
  );
  const [boots] = await control.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM backend_restart_boots WHERE actor=?",
    [actor],
  );
  const generation = Number(boots[0].n);
  const event = async (phase: string) => {
    await control.query(
      "INSERT INTO backend_restart_events(actor,boot,phase) VALUES(?,?,?)",
      [actor, boot, phase],
    );
  };
  const production = app.get<WorkerOperations>(WORKER_OPERATIONS);
  // Настоящие Nest HTTP, WorkerJobs/IntervalJobs и production lock. Доменные
  // эффекты заменены одной транзакцией; платежи, письма и S3 не вызываются.
  const operations: WorkerOperations = {
    ...production,
    runExclusiveJob: async (name, run) => {
      if (name !== "publication") return;
      await event("attempt");
      await production.runExclusiveJob(name, run);
      await event("settled");
    },
    publishDueScheduledPosts: async () => {
      const connection = await createConnection(url);
      try {
        await connection.beginTransaction();
        await connection.query(
          "UPDATE backend_restart_work SET commits=commits+1,actor=?,boot=? WHERE id=1 AND commits=0",
          [actor, boot],
        );
        await event("entered");
        if (generation === 1) await new Promise<void>(() => {});
        await connection.commit();
        await event("completed");
        return [];
      } finally {
        await connection.end();
      }
    },
  };
  const jobs = new WorkerJobs(operations);
  const container = process.env.WORKER_RESTART_CONTAINER === "1";
  await app.listen(container ? 3000 : 0, container ? "0.0.0.0" : "127.0.0.1");
  if (actor === "a") jobs.start();
  process.send?.({
    base: `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`,
    boot,
    generation,
  });
}
void main().catch(() => process.exit(1));
