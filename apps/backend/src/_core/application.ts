/** Собирает Nest и HTTP-границы; фабрика не запускает listener, cron и загрузку файлов окружения. */
import "reflect-metadata";
import { validateSessionConfiguration } from "./session-config";
import express, { type Express } from "express";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import type { INestApplication } from "@nestjs/common";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { AppModule } from "../app.module";
import { registerProdamusRoutes } from "../prodamus";
import { registerYoutubeStream } from "../youtube-stream";
import { TrpcService } from "./trpc.service";
import { registerHttpSecurity } from "./http-security";
import { MEDIA_JSON_BODY_LIMIT, registerRequestBodies } from "./request-bodies";
import { registerProdamusSandboxBody } from "../billing/prodamus-sandbox.ingress";
import { SessionService } from "../identity/session.service";
import { verifyApiCoordination } from "../database/coordination";

/** Только композиция приложения: без чтения env-файлов, открытия listener и запуска расписания. */
export async function createBackendApplication(
  options: { allowedPostPaths?: readonly string[] } = {},
): Promise<INestApplication> {
  validateSessionConfiguration();
  await verifyApiCoordination();
  const adapter = new ExpressAdapter();
  const http = adapter.getInstance<Express>();
  // The API has no published port: its only external ingress is the private
  // edge container. Trust that one hop, not a client-supplied XFF chain.
  http.set("trust proxy", 1);
  registerHttpSecurity(http);
  if (options.allowedPostPaths) {
    const allowed = new Set(options.allowedPostPaths);
    http.use((req, res, next) => {
      if (req.method !== "POST" || !allowed.has(req.path)) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      next();
    });
  }
  // Nest's defaults must not parse a webhook or allocate an upload before auth.
  http.post(
    "/api/prodamus/webhook",
    express.raw({ type: () => true, limit: "2mb" }),
  );
  http.post("/api/yookassa/webhook", (req, res, next) => {
    express.json({ limit: "64kb" })(req, res, error => {
      if (error) { res.status(error.status === 413 ? 413 : 400).json({ error: "Некорректное уведомление" }); return; }
      next();
    });
  });
  registerProdamusSandboxBody(http);
  http.post("/api/prodamus/test/webhook", (req, res, next) => {
    express.raw({ type: () => true, limit: "64kb" })(req, res, error => {
      if (error) { res.status(error.status === 413 ? 413 : 400).send("invalid test notification"); return; }
      next();
    });
  });
  const application = await NestFactory.create(AppModule, adapter, {
    bodyParser: false,
    logger: false,
    abortOnError: false,
  });
  try {
    // Providers are constructed, but routes/listener are not initialized yet.
    // Preserve ingress order while sharing the same session policy as HTTP/tRPC.
    registerRequestBodies(http, application.get(SessionService));
    registerProdamusRoutes(http);
    registerYoutubeStream(http);
    // Resolve only at the composition root, after Nest creates its providers.
    // Mount before init so security/parsers/tRPC still precede native routes.
    const trpc = application.get(TrpcService);
    http.use(
      "/api/trpc",
      createExpressMiddleware({
        maxBodySize: MEDIA_JSON_BODY_LIMIT,
        router: trpc.router,
        createContext: trpc.createContext,
        onError({ path, error }) {
          const safePath =
            path && /^[a-zA-Z0-9._-]{1,128}$/.test(path) ? path : "?";
          console.error(`[trpc] ${safePath}: ${error.code}`);
        },
      }),
    );
    await application.init();
    return application;
  } catch (error) {
    await application.close();
    throw error;
  }
}
