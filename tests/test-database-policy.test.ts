import { afterEach, expect, it, vi } from "vitest";
import { assertTestDatabase } from "../tooling/scripts/test-database-policy";
afterEach(() => vi.unstubAllEnvs());
it("refuses non-test and external databases even with the CI service flag", () => {
  vi.stubEnv("CI", "true"); vi.stubEnv("BACKEND_TEST_CI_SERVICE", "true");
  for (const uri of ["mysql://user:pass@production.example/backend_test", "mysql://user:pass@127.0.0.1/production", "mysql://user:pass@backend-mysql/production", "http://127.0.0.1/backend_test"]) expect(() => assertTestDatabase(uri)).toThrow();
});
it("accepts a CI service only when both explicit CI conditions are set", () => {
  vi.stubEnv("CI", "false"); vi.stubEnv("BACKEND_TEST_CI_SERVICE", "true");
  expect(() => assertTestDatabase("mysql://root:test@backend-mysql/backend_test")).toThrow();
  vi.stubEnv("CI", "true"); vi.stubEnv("BACKEND_TEST_CI_SERVICE", "false");
  expect(() => assertTestDatabase("mysql://root:test@backend-mysql/backend_test")).toThrow();
  vi.stubEnv("BACKEND_TEST_CI_SERVICE", "true");
  expect(assertTestDatabase("mysql://root:test@backend-mysql/backend_test").hostname).toBe("backend-mysql");
  expect(assertTestDatabase("mysql://root:test@127.0.0.1/backend_test").hostname).toBe("127.0.0.1");
});
