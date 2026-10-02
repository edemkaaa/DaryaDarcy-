import type { Express, Response } from "express";
import { TRPCError } from "@trpc/server";
import { getDb } from "../db";
import { sdk } from "../_core/sdk";
import { currentSeason, getLaunchConfiguration, saveLaunchConfiguration } from "./settings";
import { getCapabilities } from "./capabilities";

function failure(res: Response, error: unknown) {
  const status = error instanceof TRPCError ? ({ BAD_REQUEST: 400, FORBIDDEN: 403, CONFLICT: 409 } as Partial<Record<TRPCError["code"], number>>)[error.code] ?? 503 : 503;
  res.status(status).json({ error: status === 409 ? "Настройки изменились. Обновите страницу" : "Запрос недоступен" });
}

export function registerLaunchRoutes(app: Express): void {
  app.get("/api/launch-config", async (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    try {
      const database = await getDb(); if (!database) throw new Error("Database unavailable");
      const snapshot = await getLaunchConfiguration(database);
      const season = currentSeason(snapshot.config);
      res.json({ revision: snapshot.revision, season, appearance: snapshot.config.seasons[season], managerEmail: snapshot.config.managerEmail, orderMethod: "email-client", capabilities: getCapabilities() });
    } catch (error) { failure(res, error); }
  });
  app.get("/api/admin/launch-settings", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    let actor;
    try { actor = await sdk.authenticateRequest(req); } catch { res.sendStatus(401); return; }
    if (actor.role !== "admin") { res.sendStatus(403); return; }
    try {
      const database = await getDb(); if (!database) throw new Error("Database unavailable");
      res.json(await getLaunchConfiguration(database));
    } catch (error) { failure(res, error); }
  });
  app.put("/api/admin/launch-settings", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!req.is("application/json")) { res.sendStatus(415); return; }
    let actor;
    try { actor = await sdk.authenticateRequest(req); } catch { res.sendStatus(401); return; }
    if (actor.role !== "admin") { res.sendStatus(403); return; }
    try {
      const database = await getDb(); if (!database) throw new Error("Database unavailable");
      res.json(await saveLaunchConfiguration(database, actor.id, req.body?.expectedRevision, req.body?.config));
    } catch (error) { failure(res, error); }
  });
}
