/** Реальный Express HTTP проверяет CORS/origin/body policy; webhook handlers здесь лишь markers, не настоящая signature проверка. */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { gzipSync } from "node:zlib";
import { registerHttpSecurity } from "../apps/backend/src/_core/http-security";
let server: Server;
let base: string;
/** Поднимаем отдельный loopback server с security middleware до parser и успешных fixture handlers. */
beforeAll(async () => {
  vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
  const app = express(); registerHttpSecurity(app);
  app.use(express.json({ limit: "16kb" }));
  app.post("/api/write", (_req, res) => res.json({ saved: true }));
  app.post("/api/prodamus/webhook", (_req, res) => res.json({ checkedByWebhook: true }));
  app.post("/api/prodamus/return", (_req, res) => res.redirect(303, "/club"));
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
/** Закрываем server и возвращаем PUBLIC_APP_URL. */
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); vi.unstubAllEnvs(); });
/** Security отказывает до handler, сохраняя одобренные browser/native/provider пути. */
describe("HTTP policy preserves supported browser/native access", () => {
  /** Сжатый request body запрещён415 даже для webhook/return/отсутствующего route, следующий обычный запрос работает. */
  it.each(["/api/write", "/api/prodamus/webhook", "/api/prodamus/return", "/api/not-found"])("rejects compressed bodies before parsing or handling %s", async path => {
    const response = await fetch(`${base}${path}`, {
      method: "POST", redirect: "manual",
      headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" },
      body: new Uint8Array(gzipSync('{"probe":true}')),
    });
    expect(response.status).toBe(415);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.json()).toEqual({ error: "Сжатые запросы не поддерживаются" });
    const healthy = await fetch(`${base}/api/write`, { method: "POST" });
    expect(healthy.status).toBe(200);
  });
  /** Br/deflate/смешанный/неизвестный encoding не обходят body limit через распаковку. */
  it.each(["br", "deflate", "gzip, identity", "unknown"])("rejects unsupported Content-Encoding %s", async encoding => {
    const response = await fetch(`${base}/api/write`, {
      method: "POST", headers: { "Content-Encoding": encoding }, body: "probe",
    });
    expect(response.status).toBe(415);
  });
  /** Identity body остаётся допустимым JSON. */
  it("keeps explicit identity encoding supported", async () => {
    const response = await fetch(`${base}/api/write`, {
      method: "POST", headers: { "Content-Type": "application/json", "Content-Encoding": "identity" }, body: "{}",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ saved: true });
  });
  /** Точный app Origin получает credentials и Idempotency-Key permission. */
  it("allows credentialed preflight from the configured frontend", async () => {
    const response = await fetch(`${base}/api/write`, { method: "OPTIONS", headers: { Origin: "https://club.example.test", "Access-Control-Request-Method": "POST" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://club.example.test");
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
    expect(response.headers.get("access-control-allow-headers")).toContain("Idempotency-Key");
  });
  /** Отсутствие browser Origin само по себе не запрещает native JSON. */
  it("accepts native JSON requests without an Origin header", async () => {
    const response = await fetch(`${base}/api/write`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ saved: true });
  });
  /** Чужой/null/похожий host не отражается в allow-origin. */
  it.each(["https://evil.example", "null", "https://club.example.test.evil.example"])("rejects untrusted Origin %s before mutation", async (origin) => {
    const response = await fetch(`${base}/api/write`, { method: "POST", headers: { Origin: origin, Cookie: "app_session=fake", "Content-Type": "application/json" }, body: "{}" });
    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });
  /** Недоверенный OPTIONS не получает credentials permission. */
  it("rejects foreign preflight instead of reflecting credentials", async () => {
    const response = await fetch(`${base}/api/write`, { method: "OPTIONS", headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "POST" } });
    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-credentials")).toBeNull();
  });
  /** Cookie form без Origin не считается native исключением. */
  it("rejects cookie-bearing form submissions without an Origin", async () => {
    const response = await fetch(`${base}/api/write`, { method: "POST", headers: { Cookie: "app_session=fake", "Content-Type": "application/x-www-form-urlencoded" }, body: "a=b" });
    expect(response.status).toBe(403);
  });
  /** Sec-Fetch-Site:cross-site сохраняет отказ при отсутствующем Origin. */
  it("rejects cross-site fetch metadata even if Origin is omitted", async () => {
    const response = await fetch(`${base}/api/write`, { method: "POST", headers: { "Sec-Fetch-Site": "cross-site", "Content-Type": "application/json" }, body: "{}" });
    expect(response.status).toBe(403);
  });
  /** Provider-path исключение только допускает последующую HMAC-проверку, не даёт browser CORS. */
  it("lets provider callbacks reach signature verification without trusting their Origin", async () => {
    const response = await fetch(`${base}/api/prodamus/webhook`, { method: "POST", headers: { Origin: "https://payform.example", "Content-Type": "application/x-www-form-urlencoded" }, body: "signed=fixture" });
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    const returned = await fetch(`${base}/api/prodamus/return`, { method: "POST", headers: { Origin: "https://payform.example" }, redirect: "manual" });
    expect(returned.status).toBe(303);
  });
  /** Обязательные API security headers выставляются без X-Powered-By. */
  it("sends no-sniff, no-referrer and anti-framing headers on API responses", async () => {
    const response = await fetch(`${base}/api/write`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("x-powered-by")).toBeNull();
    expect(response.headers.get("vary")).toContain("Origin");
  });
});
