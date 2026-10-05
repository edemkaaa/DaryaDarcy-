import "reflect-metadata";
import express, { type Express } from "express";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import type { INestApplication } from "@nestjs/common";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { AppModule } from "../app.module";
import { appRouter } from "../routers";
import { registerProdamusRoutes, handleProdamusWebhook } from "../prodamus";
import { registerYoutubeStream } from "../youtube-stream";
import { registerPasswordRoutes } from "../identity/routes";
import { createContext } from "./context";
import { registerOAuthRoutes } from "./oauth";
import { registerHttpSecurity } from "./http-security";
import { registerRequestBodies } from "./request-bodies";

/** Composition only: no environment files, listener or scheduled side effects. */
export async function createBackendApplication(): Promise<INestApplication> {
  const adapter = new ExpressAdapter();
  const http = adapter.getInstance<Express>();
  http.set("trust proxy", "loopback");
  registerHttpSecurity(http);
  // Nest's defaults must not parse a webhook or allocate an upload before auth.
  http.post(
    "/api/prodamus/webhook",
    express.raw({ type: () => true, limit: "2mb" }),
    (req, res) => {
      void handleProdamusWebhook(req, res);
    },
  );
  http.get("/api/prodamus/webhook", (req, res) => {
    void handleProdamusWebhook(req, res);
  });
  registerRequestBodies(http);

  // Transitional adapters: replace one domain at a time behind the same API.
  registerOAuthRoutes(http);
  registerPasswordRoutes(http);
  registerProdamusRoutes(http);
  registerYoutubeStream(http);
  http.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ path, error }) {
        const safePath =
          path && /^[a-zA-Z0-9._-]{1,128}$/.test(path) ? path : "?";
        console.error(`[trpc] ${safePath}: ${error.code}`);
      },
    }),
  );

  const application = await NestFactory.create(AppModule, adapter, {
    bodyParser: false,
    logger: false,
    abortOnError: false,
  });
  try {
    await application.init();
    return application;
  } catch (error) {
    await application.close();
    throw error;
  }
}
