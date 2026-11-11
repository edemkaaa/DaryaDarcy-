/** Завершает API в порядке HTTP → фоновые задачи → приложение → общий пул, с конечным временем ожидания. */
import type { INestApplication } from "@nestjs/common";
import type { Server } from "node:http";
import type { WorkerJobs } from "../workers/worker-jobs.service";
import { closeDb } from "../db";

/** Обработчики сигналов принадлежат точке запуска; фабрика приложения не создаёт их и таймеры. */
export function registerApiShutdown(app: INestApplication, server: Server, jobs: WorkerJobs) {
  let stopping = false;
  /** Один раз останавливает новые jobs, ждёт текущие HTTP/job Promise и закрывает пул; по deadline завершает процесс аварийно. */
  /** Один раз останавливает новые jobs, ждёт текущие HTTP/job Promise и закрывает пул; по deadline завершает процесс аварийно. */
  const stop = () => {
    if (stopping) return;
    stopping = true;
    const pending = jobs.stop();
    // Вписываем drain в стандартные 10 секунд Docker stop. По истечении срока
    // незавершённые долговечные загрузки и оплаты восстанавливаются по их журналам.
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
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
