import { afterEach, expect, it, vi } from "vitest";
import { coordinationMode } from "../apps/backend/src/database/coordination";

afterEach(() => vi.unstubAllEnvs());
it("preserves one local process by default", () => {
  vi.stubEnv("API_REPLICA_COUNT", "");
  vi.stubEnv("API_COORDINATION_MODE", "");
  expect(coordinationMode()).toBe("local");
});
it("requires shared coordination for more than one API", () => {
  vi.stubEnv("API_REPLICA_COUNT", "2");
  vi.stubEnv("API_COORDINATION_MODE", "local");
  expect(() => coordinationMode()).toThrow("coordination");
  vi.stubEnv("API_COORDINATION_MODE", "mysql");
  expect(coordinationMode()).toBe("mysql");
});
it.each(["0", "-1", "1.5", "two", "Infinity"])(
  "refuses invalid count %s",
  (value) => {
    vi.stubEnv("API_REPLICA_COUNT", value);
    expect(() => coordinationMode()).toThrow();
  },
);
it("does not silently fall back for an unknown mode", () => {
  vi.stubEnv("API_COORDINATION_MODE", "redis");
  expect(() => coordinationMode()).toThrow();
});

it("refuses multi-process legacy SMS because its code-verification quota is local", () => {
  vi.stubEnv("API_REPLICA_COUNT", "2");
  vi.stubEnv("API_COORDINATION_MODE", "mysql");
  vi.stubEnv("ENABLE_SMS_LOGIN", "true");
  expect(() => coordinationMode()).toThrow();
});

it("refuses an unsafe app configuration before creating a listener", async () => {
  vi.stubEnv("API_REPLICA_COUNT", "2");
  vi.stubEnv("API_COORDINATION_MODE", "local");
  const { createBackendApplication } =
    await import("../apps/backend/src/_core/application");
  await expect(createBackendApplication()).rejects.toThrow("coordination");
});
