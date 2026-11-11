/** Проверяем единую публичную точку API и приватных медиа без сетевых запросов. */
import { afterEach, expect, it, vi } from "vitest";
/** Сбрасываем env, window и module cache, чтобы настройки origin перечитывались независимо. */
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});
/** Раздельный публичный API-host отклоняется раньше построения URL, иначе cookie/медиа могли бы расходиться. */
it("rejects a split public API origin before JSON and private media use different hosts", async () => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://api.example.test");
  vi.stubGlobal("window", { location: { origin: "https://web.example.test" } });
  vi.resetModules();
  const api = await import("../apps/frontend/src/shared/config/api");
  expect(() => api.getApiBaseUrl()).toThrow("один публичный домен");
  expect(() => api.apiUrl("/api/auth/me")).toThrow();
});
/** Совпадающий публичный origin допускается независимо от внутреннего upstream прокси. */
it("allows the same public origin with a private proxy behind it", async () => {
  vi.stubEnv("NEXT_PUBLIC_API_BASE_URL", "https://web.example.test");
  vi.stubGlobal("window", { location: { origin: "https://web.example.test" } });
  vi.resetModules();
  const api = await import("../apps/frontend/src/shared/config/api");
  expect(api.apiUrl("/api/auth/me")).toBe(
    "https://web.example.test/api/auth/me",
  );
});
