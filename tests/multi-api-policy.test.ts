import { expect, it } from "vitest";
import { inspectMultiApiDeployment } from "../tooling/scripts/multi-api-policy";

function fixture() {
  const environment = {
    API_REPLICA_COUNT: "2",
    API_COORDINATION_MODE: "mysql",
    ENABLE_SMS_LOGIN: "false",
    DATABASE_URL: "mysql://fixture:private-db-secret@mysql/backend_test",
    JWT_SECRET: "private-session-secret".padEnd(32, "!"),
    AUTH_LINK_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
  };
  return {
    services: {
      api: {
        environment: { ...environment, API_DB_BURST_QUEUE_ENABLED: "true" },
        deploy: { replicas: 2 },
        mem_limit: String(1536 * 1024 ** 2),
        restart: "unless-stopped",
        stop_grace_period: "15s",
        ports: [] as unknown[],
      },
      "prodamus-test": {
        environment: { ...environment },
        mem_limit: String(256 * 1024 ** 2),
        restart: "unless-stopped",
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
it.each([undefined, "no", "on-failure:2"])(
  "requires persistent API restart, got %s",
  (restart) => {
    const config = fixture();
    const api = { ...config.services.api, restart };
    expect(
      inspectMultiApiDeployment(
        { services: { ...config.services, api } },
        capacity,
      ).issues,
    ).toContain("api-automatic-restart-required");
  },
);
it("refuses an overriding deploy restart policy", () => {
  const config = fixture();
  const api = {
    ...config.services.api,
    deploy: {
      ...config.services.api.deploy,
      restart_policy: { condition: "none" },
    },
  };
  expect(
    inspectMultiApiDeployment(
      { services: { ...config.services, api } },
      capacity,
    ).issues,
  ).toContain("api-automatic-restart-required");
});
it.each(["host", "service:edge"])(
  "refuses API network namespace overrides without published ports: %s",
  (network_mode) => {
    const config = fixture();
    const api = { ...config.services.api, network_mode };
    expect(
      inspectMultiApiDeployment(
        { services: { ...config.services, api } },
        capacity,
      ).issues,
    ).toContain("api-network-mode-override");
  },
);
it("rejects short JWT secrets after the same normalization as API startup", () => {
  const config = fixture();
  const jwt = ` ${"a".repeat(15)}\r${"a".repeat(16)} `;
  config.services.api.environment.JWT_SECRET = jwt;
  config.services["prodamus-test"].environment.JWT_SECRET = jwt;
  expect(inspectMultiApiDeployment(config, capacity).issues).toContain(
    "invalid-api-jwt-secret",
  );
});
it.each([
  "synthetic-invalid-key",
  Buffer.alloc(32, 1).toString("base64").trimEnd().slice(0, -1),
])(
  "rejects an invalid or noncanonical link key (%#) without printing it",
  (key) => {
    const config = fixture();
    config.services.api.environment.AUTH_LINK_ENCRYPTION_KEY = key;
    config.services["prodamus-test"].environment.AUTH_LINK_ENCRYPTION_KEY = key;
    const result = inspectMultiApiDeployment(config, capacity);
    expect(result.issues).toContain("invalid-api-link-encryption-key");
    expect(JSON.stringify(result)).not.toContain(key);
  },
);
it("requires the tested 40-waiter profile for the public API", () => {
  const config = fixture();
  config.services.api.environment.API_DB_BURST_QUEUE_ENABLED = "false";
  expect(inspectMultiApiDeployment(config, capacity).issues).toContain(
    "api-burst-queue-required",
  );
});
it.each([0, -1, 1.5, Infinity])("refuses invalid capacity %s", (value) => {
  expect(
    inspectMultiApiDeployment(fixture(), { ...capacity, hostMemoryMiB: value })
      .ok,
  ).toBe(false);
});
