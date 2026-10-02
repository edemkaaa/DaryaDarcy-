import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { registerHttpSecurity } from "../apps/backend/src/_core/http-security";
let server: Server;
let base: string;
beforeAll(async () => {
  vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
  const app = express(); registerHttpSecurity(app);
  app.post("/api/write", (_req, res) => res.json({ saved: true }));
  server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { await new Promise<void>(resolve => server.close(() => resolve())); vi.unstubAllEnvs(); });
describe("HTTP policy preserves supported browser/native access", () => {
  it("allows credentialed preflight from the configured frontend", async () => {
    const response = await fetch(`${base}/api/write`, { method: "OPTIONS", headers: { Origin: "https://club.example.test", "Access-Control-Request-Method": "POST" } });
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://club.example.test");
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });
  it("accepts native JSON requests without an Origin header", async () => {
    const response = await fetch(`${base}/api/write`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ saved: true });
  });
});
