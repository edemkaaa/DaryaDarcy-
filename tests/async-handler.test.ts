/** Проверяем адаптацию async Express-обработчиков на реальных loopback HTTP-запросах. */
import express, { type ErrorRequestHandler } from "express";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { expect, it } from "vitest";
import { asyncHandler } from "../apps/backend/src/_core/async-handler";

/** Сверяем reject, обычный ответ, next и синхронный throw; каждое исключение попадает в middleware ровно один раз. */
it("forwards rejected promises once and leaves successful requests intact", async () => {
  const app = express();
  const failures: unknown[] = [];
  const failure = new Error("synthetic failure");
  app.get("/reject", asyncHandler(async () => {
    await Promise.resolve();
    throw failure;
  }));
  app.get("/success", asyncHandler(async (_req, res) => {
    await Promise.resolve();
    res.json({ ok: true });
  }));
  app.get("/next", asyncHandler(async (_req, _res, next) => {
    await Promise.resolve();
    next();
  }), (_req, res) => { res.sendStatus(204); });
  // Express must retain its normal synchronous-error handling as well.
  app.get("/throw", asyncHandler(() => { throw failure; }));
  /** Фиксирует принятые ошибки и завершает запрос безопасным тестовым ответом 500. */
  const onError: ErrorRequestHandler = (error, _req, res, _next) => {
    failures.push(error);
    res.status(500).json({ error: "unavailable" });
  };
  app.use(onError);
  const server = app.listen(0, "127.0.0.1");
  try {
    await once(server, "listening");
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const rejected = await fetch(`${base}/reject`, { signal: AbortSignal.timeout(2000) });
    expect(rejected.status).toBe(500);
    expect(await rejected.json()).toEqual({ error: "unavailable" });
    expect(failures).toEqual([failure]);
    const success = await fetch(`${base}/success`);
    expect(await success.json()).toEqual({ ok: true });
    expect((await fetch(`${base}/next`)).status).toBe(204);
    expect((await fetch(`${base}/throw`)).status).toBe(500);
    expect(failures).toEqual([failure, failure]);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
