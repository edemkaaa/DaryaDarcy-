import { z } from "zod";

// Accept resolved `docker compose config --format json`, never raw env files.
// Results contain issue codes and budgets only, never addresses or secrets.
const service = z.object({
  environment: z.record(z.string(), z.unknown()).optional(),
  deploy: z
    .object({
      replicas: z.number().int().positive().optional(),
      restart_policy: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
  scale: z.number().int().positive().optional(),
  mem_limit: z.union([z.string(), z.number()]).optional(),
  network_mode: z.string().optional(),
  ports: z.array(z.unknown()).optional(),
  restart: z.string().optional(),
  stop_grace_period: z.string().optional(),
});
const model = z.object({ services: z.record(z.string(), service) });
const poolSize = 10,
  connectionReserve = 10,
  hostReserveMiB = 1024;
function seconds(value = "10s") {
  if (!/^(?:\d+(?:\.\d+)?(?:ms|s|m|h))+$/.test(value)) return 0;
  return [...value.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h)/g)].reduce(
    (sum, m) =>
      sum + Number(m[1]) * ({ ms: 0.001, s: 1, m: 60, h: 3600 }[m[2]] ?? 0),
    0,
  );
}
export function inspectMultiApiDeployment(
  input: unknown,
  capacity: { hostMemoryMiB: number; mysqlMaxConnections: number },
) {
  const parsed = model.safeParse(input);
  const issues = new Set<string>();
  const result = (
    apiProcesses = 0,
    requiredConnections = 0,
    requiredMemoryMiB = 0,
  ) => ({
    ok: issues.size === 0,
    issues: [...issues],
    apiProcesses,
    requiredConnections,
    requiredMemoryMiB,
    productionApproval: false as const,
  });
  if (!parsed.success) {
    issues.add("invalid-resolved-compose");
    return result();
  }
  if (
    ![capacity.hostMemoryMiB, capacity.mysqlMaxConnections].every(
      (n) => Number.isSafeInteger(n) && n > 0,
    )
  ) {
    issues.add("invalid-host-capacity");
    return result();
  }
  const services = parsed.data.services;
  const replicas = (value: z.infer<typeof service>) =>
    value.scale ?? value.deploy?.replicas ?? 1;
  if (!services.api || replicas(services.api) < 2) {
    issues.add("multiple-api-replicas-required");
    return result();
  }
  // Candidate environments have separate rollout and database ownership rules.
  // Do not silently approve an unknown extra API topology through this gate.
  if (services["candidate-api"])
    issues.add("candidate-service-requires-separate-review");
  let memory = hostReserveMiB,
    count = 0;
  const expected = services.api.environment ?? {};
  for (const name of [
    "DATABASE_URL",
    "JWT_SECRET",
    "AUTH_LINK_ENCRYPTION_KEY",
  ]) {
    if (typeof expected[name] !== "string" || !String(expected[name]).trim())
      issues.add("shared-api-identity-required");
  }
  const jwtSecret = expected.JWT_SECRET;
  if (
    typeof jwtSecret === "string" &&
    Buffer.byteLength(jwtSecret.replace(/\r/g, "").trim(), "utf8") < 32
  )
    issues.add("invalid-api-jwt-secret");
  const linkSecret = expected.AUTH_LINK_ENCRYPTION_KEY;
  if (typeof linkSecret === "string") {
    const key = Buffer.from(linkSecret, "base64");
    if (key.length !== 32 || key.toString("base64") !== linkSecret)
      issues.add("invalid-api-link-encryption-key");
  }
  if (expected.API_DB_BURST_QUEUE_ENABLED !== "true")
    issues.add("api-burst-queue-required");
  for (const [name, value] of Object.entries(services)) {
    const instances = replicas(value);
    const bytes = Number(value.mem_limit);
    if (!Number.isSafeInteger(bytes) || bytes <= 0)
      issues.add("service-memory-limit-required");
    else memory += Math.ceil(bytes / 1024 ** 2) * instances;
    if (!["api", "prodamus-test"].includes(name)) continue;
    count += instances;
    const env = value.environment ?? {};
    if (
      env.API_COORDINATION_MODE !== "mysql" ||
      Number(env.API_REPLICA_COUNT) !== replicas(services.api)
    )
      issues.add("shared-coordination-required");
    if (env.ENABLE_SMS_LOGIN === "true")
      issues.add("legacy-sms-must-stay-disabled");
    if (
      ["DATABASE_URL", "JWT_SECRET", "AUTH_LINK_ENCRYPTION_KEY"].some(
        (key) => env[key] !== expected[key],
      )
    )
      issues.add("shared-api-identity-mismatch");
    if (value.ports?.length) issues.add("api-published-port");
    if (value.network_mode !== undefined)
      issues.add("api-network-mode-override");
    // Этот Compose-профиль использует restart сервиса. Deploy override может
    // переопределить политику, от которой зависит возврат API после аварии.
    if (
      (value.restart !== "unless-stopped" && value.restart !== "always") ||
      value.deploy?.restart_policy !== undefined
    )
      issues.add("api-automatic-restart-required");
    if (seconds(value.stop_grace_period) < 10)
      issues.add("api-drain-grace-too-short");
  }
  const connections = count * poolSize + connectionReserve;
  if (connections > capacity.mysqlMaxConnections)
    issues.add("mysql-connection-budget-exceeded");
  if (memory > capacity.hostMemoryMiB)
    issues.add("host-memory-budget-exceeded");
  return result(count, connections, memory);
}
