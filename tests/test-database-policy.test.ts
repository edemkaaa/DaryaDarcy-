/** Guard одноразовой БД не позволяет тестовым флагам открыть production или изменить параметры подключения. */
import { afterEach, expect, it, vi } from "vitest";
import { assertTestDatabase } from "../tooling/scripts/test-database-policy";
/** Убираем CI-флаги после каждого сценария. */
afterEach(() => vi.unstubAllEnvs());
/** Схема backend_test и разрешённый локальный/CI host обязательны одновременно. */
it("refuses non-test and external databases even with the CI service flag", () => {
  vi.stubEnv("CI", "true");
  vi.stubEnv("BACKEND_TEST_CI_SERVICE", "true");
  for (const uri of [
    "mysql://user:pass@production.example/backend_test",
    "mysql://user:pass@127.0.0.1/production",
    "mysql://user:pass@backend-mysql/production",
    "http://127.0.0.1/backend_test",
  ])
    expect(() => assertTestDatabase(uri)).toThrow();
});
/** Имя backend-mysql разрешается лишь при двух явных CI-флагах; loopback остаётся допустим. */
it("accepts a CI service only when both explicit CI conditions are set", () => {
  vi.stubEnv("CI", "false");
  vi.stubEnv("BACKEND_TEST_CI_SERVICE", "true");
  expect(() =>
    assertTestDatabase("mysql://root:test@backend-mysql/backend_test"),
  ).toThrow();
  vi.stubEnv("CI", "true");
  vi.stubEnv("BACKEND_TEST_CI_SERVICE", "false");
  expect(() =>
    assertTestDatabase("mysql://root:test@backend-mysql/backend_test"),
  ).toThrow();
  vi.stubEnv("BACKEND_TEST_CI_SERVICE", "true");
  expect(
    assertTestDatabase("mysql://root:test@backend-mysql/backend_test").hostname,
  ).toBe("backend-mysql");
  expect(
    assertTestDatabase("mysql://root:test@127.0.0.1/backend_test").hostname,
  ).toBe("127.0.0.1");
});

/** Query, encoded socketPath и fragment запрещены, чтобы драйвер не сменил фактическую цель после проверки URL. */
it.each([
  "?socketPath=/tmp/other-mysql.sock",
  "?%73ocketPath=%2Ftmp%2Fother-mysql.sock",
  "?socketPath=%22%2Ftmp%2Fother-mysql.sock%22",
  "?multipleStatements=true",
  "?charset=utf8mb4",
  "#other-database",
])(
  "refuses extra connection settings on an otherwise permitted test URL: %s",
  (suffix) => {
    expect(() =>
      assertTestDatabase(
        `mysql://fixture:fixture@127.0.0.1/backend_test${suffix}`,
      ),
    ).toThrow();
    vi.stubEnv("CI", "true");
    vi.stubEnv("BACKEND_TEST_CI_SERVICE", "true");
    expect(() =>
      assertTestDatabase(
        `mysql://fixture:fixture@backend-mysql/backend_test${suffix}`,
      ),
    ).toThrow();
  },
);
