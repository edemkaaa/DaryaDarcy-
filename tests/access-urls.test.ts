import { afterAll, afterEach, beforeAll, expect, it, vi } from "vitest";
import type { INestApplication } from "@nestjs/common";
import type { AddressInfo } from "node:net";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import { publicAccessUrl } from "../apps/backend/src/identity/urls";
let application: INestApplication, base: string;
beforeAll(async () => {
  application = await createBackendApplication();
  await application.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${(application.getHttpServer().address() as AddressInfo).port}`;
});
afterAll(async () => {
  await application.close();
});
afterEach(() => vi.unstubAllEnvs());
it("links from the backend password page to the configured frontend login", async () => {
  vi.stubEnv("PUBLIC_APP_URL", "https://club.example.test");
  vi.stubEnv("PUBLIC_AUTH_URL", "https://api.example.test");
  const response = await fetch(`${base}/api/auth/password`);
  expect(response.status).toBe(200);
  const page = await response.text();
  expect(page).toContain('href="https://club.example.test/login"');
  expect(response.headers.get("cache-control")).toBe("no-store");
  const nonce = page.match(/<script nonce="([^"]+)"/)![1];
  expect(page).toContain("history.replaceState(null,'',location.pathname)");
  expect(response.headers.get("content-security-policy")).toContain(
    `script-src 'nonce-${nonce}'`,
  );
  expect(nonce).not.toBe("");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
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
