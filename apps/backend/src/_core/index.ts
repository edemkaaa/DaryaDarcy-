import "./load-env";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { cancelProdamusSubscription, handleProdamusWebhook, registerProdamusRoutes } from "../prodamus";
import { processCancellations } from "../billing/cancellation";
import { registerYoutubeStream } from "../youtube-stream";
import { handleAdminVideoUpload } from "../admin-video";
import { appRouter, sendNewPostNotification } from "../routers";
import { processPendingShopDeliveryEmails } from "../shop-delivery";
import * as platformDb from "../platform-db";
import { createContext } from "./context";
import * as db from "../db";
import { runMysqlBackupIfDue } from "./backup";
import { registerPasswordRoutes } from "../identity/routes";
import { processAccessEmails } from "../identity/access";
import { sendTransactionalEmail } from "./email";
import { registerCapabilityRoutes } from "../launch/capabilities";
import { registerHttpSecurity } from "./http-security";

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
  const app = express();
  const server = createServer(app);
  // Production nginx is on loopback; public callers cannot declare themselves
  // trusted proxies merely by supplying one forwarded hop.
  app.set("trust proxy", "loopback");

  registerHttpSecurity(app);

  app.post(
    "/api/prodamus/webhook",
    express.raw({ type: () => true, limit: "2mb" }),
    (req, res) => {
      void handleProdamusWebhook(req, res);
    },
  );
  app.get("/api/prodamus/webhook", (req, res) => {
    void handleProdamusWebhook(req, res);
  });

  app.post("/api/admin/upload-video", (req, res) => {
    express.raw({ type: () => true, limit: "80mb" })(req, res, (err) => {
      if (err) {
        res.status(413).json({ error: "Видео больше 80 МБ. Сожмите ролик или загрузите более короткий файл." });
        return;
      }
      void handleAdminVideoUpload(req, res);
    });
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);
  registerCapabilityRoutes(app);
  registerPasswordRoutes(app);
  registerProdamusRoutes(app);
  registerYoutubeStream(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ path, error }) {
        const cause = error.cause;
        const causeMsg = cause instanceof Error ? cause.message : cause ? String(cause) : "";
        console.error(`[trpc] ${path ?? "?"}: ${error.message}${causeMsg ? ` | ${causeMsg}` : ""}`);
      },
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000", 10);
  const host =
    process.env.HOST || (process.env.NODE_ENV === "production" ? "127.0.0.1" : "0.0.0.0");
  const port =
    process.env.NODE_ENV === "production" ? preferredPort : await findAvailablePort(preferredPort);

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

  server.listen(port, host, () => {
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

    const billingTick=async()=>{
      const database=await db.getDb();if(!database) return;
      await Promise.allSettled([
        processCancellations(database,cancelProdamusSubscription).catch(()=>console.warn("[billing] cancellation worker failed")),
        processAccessEmails(database,sendTransactionalEmail).catch(()=>console.warn("[billing] email worker failed")),
      ]);
    };
    void billingTick();
    setInterval(()=>{void billingTick();},30000);

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

    void runMysqlBackupIfDue().catch((error) => console.warn("[backup] initial run failed:", error));
    setInterval(() => {
      void runMysqlBackupIfDue().catch((error) => console.warn("[backup] scheduled run failed:", error));
    }, 6 * 60 * 60_000);
  });
}

startServer().catch(console.error);
