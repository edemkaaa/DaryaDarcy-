import { afterEach, expect, it, vi } from "vitest";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});
it("rejects a split public API origin before JSON and private media use different hosts", async () => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");
  vi.stubGlobal("window", { location: { origin: "https://web.example.test" } });
  vi.resetModules();
  const api = await import("../apps/frontend/src/shared/config/api");
  expect(() => api.getApiBaseUrl()).toThrow("один публичный домен");
  expect(() => api.apiUrl("/api/auth/me")).toThrow();
});
it("allows the same public origin with a private proxy behind it", async () => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://web.example.test");
  vi.stubGlobal("window", { location: { origin: "https://web.example.test" } });
  vi.resetModules();
  const api = await import("../apps/frontend/src/shared/config/api");
  expect(api.apiUrl("/api/auth/me")).toBe(
    "https://web.example.test/api/auth/me",
  );
});
