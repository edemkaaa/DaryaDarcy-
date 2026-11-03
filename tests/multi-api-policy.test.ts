import { expect, it } from "vitest";
import { inspectMultiApiDeployment } from "../tooling/scripts/multi-api-policy";

function fixture() {
  const environment = {
    API_REPLICA_COUNT: "2",
    API_COORDINATION_MODE: "mysql",
    ENABLE_SMS_LOGIN: "false",
    DATABASE_URL: "mysql://fixture:private-db-secret@mysql/backend_test",
    JWT_SECRET: "private-session-secret",
    AUTH_LINK_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
  };
  return {
    services: {
      api: {
        environment,
        deploy: { replicas: 2 },
        mem_limit: String(1536 * 1024 ** 2),
        stop_grace_period: "15s",
        ports: [] as unknown[],
      },
      "prodamus-test": {
        environment: { ...environment },
        mem_limit: String(256 * 1024 ** 2),
      },
      mysql: { mem_limit: String(2048 * 1024 ** 2) },
      web: { mem_limit: String(2048 * 1024 ** 2) },
      edge: { mem_limit: String(32 * 1024 ** 2) },
    },
  };
}
const capacity = { hostMemoryMiB: 16384, mysqlMaxConnections: 50 };
it("accounts for every API replica, the TEST ingress, and an operator connection reserve", () => {
  const result = inspectMultiApiDeployment(fixture(), capacity);
  expect(result).toMatchObject({
    ok: true,
    apiProcesses: 3,
    requiredConnections: 40,
  });
  expect(result.requiredMemoryMiB).toBe(
    2 * 1536 + 256 + 2048 + 2048 + 32 + 1024,
  );
  expect(JSON.stringify(result)).not.toMatch(
    /private-db-secret|private-session-secret|mysql:\/\//,
  );
});
it("refuses the former 8GiB budget after scaling the API", () => {
  expect(
    inspectMultiApiDeployment(fixture(), { ...capacity, hostMemoryMiB: 8192 })
      .issues,
  ).toContain("host-memory-budget-exceeded");
});
it("refuses the old 30-connection limit when TEST ingress also shares MySQL", () => {
  expect(
    inspectMultiApiDeployment(fixture(), {
      ...capacity,
      mysqlMaxConnections: 30,
    }).issues,
  ).toContain("mysql-connection-budget-exceeded");
});
it("does not let the optional TEST ingress silently keep local quotas", () => {
  const config = fixture();
  config.services["prodamus-test"].environment.API_COORDINATION_MODE = "local";
  expect(inspectMultiApiDeployment(config, capacity).issues).toContain(
    "shared-coordination-required",
  );
});
it.each(["DATABASE_URL", "JWT_SECRET", "AUTH_LINK_ENCRYPTION_KEY"] as const)(
  "refuses inconsistent %s without exposing either value",
  (key) => {
    const config = fixture();
    config.services["prodamus-test"].environment[key] = "private-mismatch";
    const result = inspectMultiApiDeployment(config, capacity);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("private-mismatch");
  },
);
it("refuses incomplete memory ceilings, public API ports and too-short stop grace", () => {
  const config = fixture();
  config.services.api.mem_limit = "0";
  config.services.api.ports = [{ published: "3000", target: 3000 }];
  config.services.api.stop_grace_period = "5s";
  expect(inspectMultiApiDeployment(config, capacity).issues).toEqual(
    expect.arrayContaining([
      "service-memory-limit-required",
      "api-published-port",
      "api-drain-grace-too-short",
    ]),
  );
});
it.each([0, -1, 1.5, Infinity])("refuses invalid capacity %s", (value) => {
  expect(
    inspectMultiApiDeployment(fixture(), { ...capacity, hostMemoryMiB: value })
      .ok,
  ).toBe(false);
});
