/** Точка запуска API: проверка конфигурации, listener, запуск работников и обработка завершения. */
﻿import "./load-env";
import type { Server } from "node:http";
import net from "net";
import { createBackendApplication } from "./application";
import { WorkerJobs } from "../workers/worker-jobs.service";
import { registerApiShutdown } from "./api-shutdown";

/** Пробует занять TCP-порт и сразу освобождает его; ошибка bind означает занятый или недоступный порт. */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

/** Для локального запуска ищет свободный порт среди двадцати последовательных, иначе завершает подбор ошибкой. */
async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

/** После сборки приложения выбирает адрес, ограничивает HTTP-таймауты и включает workers только после успешного listen. */
async function startServer() {
  const application = await createBackendApplication();
  const server = application.getHttpServer() as Server;

  const preferredPort = parseInt(process.env.PORT || "3000", 10);
  const host =
    process.env.HOST ||
    (process.env.NODE_ENV === "production" ? "127.0.0.1" : "0.0.0.0");
  const port =
    process.env.NODE_ENV === "production"
      ? preferredPort
      : await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.on("error", (err) => {
    console.error(`[api] failed to bind ${host}:${port}`, err);
    process.exit(1);
  });

  server.timeout = 180_000;
  server.headersTimeout = 185_000;
  server.requestTimeout = 180_000;

  await application.listen(port, host);
  console.log(`[api] server listening on ${host}:${port}`);
  const jobs = application.get(WorkerJobs);
  registerApiShutdown(application, server, jobs);
  jobs.start();
}

startServer().catch((error) => {
  console.error("[api] startup failed", error);
  process.exitCode = 1;
});
