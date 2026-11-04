import { afterEach, expect, it, vi } from "vitest";
import { validateSessionConfiguration } from "../apps/backend/src/_core/session-config";
import { createBackendApplication } from "../apps/backend/src/_core/application";
import type { AddressInfo } from "node:net";

afterEach(() => vi.unstubAllEnvs());
it.each(["", " ", "short", "x".repeat(31)])(
  "refuses a missing or short production JWT key",
  (key) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("JWT_SECRET", key);
    expect(() => validateSessionConfiguration()).toThrow(/JWT_SECRET/);
  },
);
it("allows local tests without a production signing key", () => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("JWT_SECRET", "");
  expect(() => validateSessionConfiguration()).not.toThrow();
});
it("starts the production API with a sufficiently long synthetic signing key", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("JWT_SECRET", "synthetic-test-only-production-key-32-bytes");
  vi.stubEnv("DATABASE_URL", "");
  vi.stubEnv("API_COORDINATION_MODE", "local");
  vi.stubEnv("API_REPLICA_COUNT", "1");
  const app = await createBackendApplication();
  try {
    await app.listen(0, "127.0.0.1");
    const port = (app.getHttpServer().address() as AddressInfo).port;
    expect((await fetch(`http://127.0.0.1:${port}/api/health`)).status).toBe(
      200,
    );
  } finally {
    await app.close();
  }
});
