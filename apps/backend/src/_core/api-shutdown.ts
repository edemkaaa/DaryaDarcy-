import type { INestApplication } from "@nestjs/common";
import type { Server } from "node:http";
import type { WorkerJobs } from "../workers/worker-jobs.service";
import { closeDb } from "../db";

/** Executable-only hooks: no signal listeners or timers in application factories. */
export function registerApiShutdown(app: INestApplication, server: Server, jobs: WorkerJobs) {
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    const pending = jobs.stop();
    // Docker's default stop grace is 10 seconds. Bound application draining
    // within it; durable upload/payment intents remain recoverable on timeout.
    const deadline = setTimeout(() => {
      console.warn("[api] shutdown deadline exceeded");
      server.closeAllConnections();
      process.exit(1);
    }, 8000);
    deadline.unref();
    const closed = new Promise<void>((resolve, reject) => {
      server.close(error => { if (error) reject(error); else resolve(); });
    });
    void Promise.all([closed, ...pending.map(job => job.settled)])
      .then(() => app.close())
      .then(() => closeDb())
      .then(() => { clearTimeout(deadline); process.exit(0); })
      .catch(() => {
        console.warn("[api] shutdown failed");
        process.exit(1);
      });
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}
