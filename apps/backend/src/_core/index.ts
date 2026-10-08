import "./load-env";
import type { Server } from "node:http";
import net from "net";
import { createBackendApplication } from "./application";
import { WorkerJobs } from "../workers/worker-jobs.service";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

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
  application.get(WorkerJobs).start();
}

startServer().catch((error) => {
  console.error("[api] startup failed", error);
  process.exitCode = 1;
});
