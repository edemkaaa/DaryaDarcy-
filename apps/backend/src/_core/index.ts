import "./load-env";
import type { Server } from "node:http";
import net from "net";
import { createBackendApplication } from "./application";
import { cancelProdamusSubscription } from "../prodamus";
import { processCancellations } from "../billing/cancellation";
import { sendMarketingPostNotification as sendNewPostNotification } from "../push";
import { processPendingShopDeliveryEmails } from "../shop-delivery";
import * as platformDb from "../platform-db";
import * as db from "../db";
import { runMysqlBackupIfDue } from "./backup";
import { processAccessEmails } from "../identity/access";
import { sendTransactionalEmail } from "./email";

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
  const tick = async () => {
    try {
      const published = await db.publishDueScheduledPosts();
      for (const post of published) {
        console.log(`[schedule] published post #${post.id}`);
        void sendNewPostNotification(post.text, post.id, post.target);
      }
    } catch (error) {
      console.warn("[schedule] publish tick failed:", error);
    }
  };
  void tick();
  setInterval(() => {
    void tick();
  }, 60_000);

  const billingTick = async () => {
    const database = await db.getDb();
    if (!database) return;
    await Promise.allSettled([
      processCancellations(database, cancelProdamusSubscription).catch(() =>
        console.warn("[billing] cancellation worker failed"),
      ),
      processAccessEmails(database, sendTransactionalEmail).catch(() =>
        console.warn("[billing] email worker failed"),
      ),
    ]);
  };
  void billingTick();
  setInterval(() => {
    void billingTick();
  }, 30000);

  const maintenance = async () => {
    try {
      await processPendingShopDeliveryEmails();
      await platformDb.runDataRetentionMaintenance();
    } catch (error) {
      console.warn("[maintenance] tick failed:", error);
    }
  };
  void maintenance();
  setInterval(() => {
    void maintenance();
  }, 5 * 60_000);

  void runMysqlBackupIfDue().catch((error) =>
    console.warn("[backup] initial run failed:", error),
  );
  setInterval(
    () => {
      void runMysqlBackupIfDue().catch((error) =>
        console.warn("[backup] scheduled run failed:", error),
      );
    },
    6 * 60 * 60_000,
  );
}

startServer().catch((error) => {
  console.error("[api] startup failed", error);
  process.exitCode = 1;
});
