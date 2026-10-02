import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { registerPasswordRoutes } from "../apps/backend/src/identity/routes";
import { publicAccessUrl } from "../apps/backend/src/identity/urls";
let server: Server, base: string;
beforeAll(async () => {
  const app = express();
  registerPasswordRoutes(app);
  server = await new Promise<Server>((resolve) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});
afterEach(() => vi.unstubAllEnvs());
it("links from the backend password page to the configured frontend login", async () => {
  vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
  vi.stubEnv("PUBLIC_AUTH_URL", "https://api.example.test");
  const response = await fetch(`${base}/api/auth/password`);
  expect(response.status).toBe(200);
  expect(await response.text()).toContain(
    'href="https://club.example.test/login"',
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it.each([
  "javascript:alert(1)",
  "ftp://localhost",
  "http://club.example.test",
  "https://user:PRIVATE_PASSWORD@club.example.test",
])("fails safely for an unsafe configured frontend %s", async (url) => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("PUBLIC_APP_URL", url);
  const response = await fetch(`${base}/api/auth/password`);
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("PRIVATE_PASSWORD");
});
it("uses the backend for setup links and the frontend for login, without retaining query parameters", () => {
  vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test/unused?tracking=1");
  vi.stubEnv("PUBLIC_AUTH_URL", "https://api.example.test/unused?tracking=1");
  const token = "A".repeat(43);
  expect(publicAccessUrl(token).toString()).toBe(
    `https://api.example.test/api/auth/password#token=${token}`,
  );
  expect(publicAccessUrl().toString()).toBe("https://club.example.test/login");
});
it("supports local HTTP in development, but never another local scheme", () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("PUBLIC_APP_URL", "http://localhost:8081");
  vi.stubEnv("PUBLIC_AUTH_URL", "http://127.0.0.1:3000");
  expect(publicAccessUrl("local-test-token").protocol).toBe("http:");
  vi.stubEnv("PUBLIC_AUTH_URL", "ftp://localhost");
  expect(() => publicAccessUrl("local-test-token")).toThrow(
    "Invalid public access URL",
  );
});
it("rejects credentials in the mail-link origin without exposing their value", () => {
  vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
  vi.stubEnv(
    "PUBLIC_AUTH_URL",
    "https://member:PRIVATE_PASSWORD@api.example.test",
  );
  expect(() => publicAccessUrl("local-test-token")).toThrow(
    "Invalid public access URL",
  );
});
