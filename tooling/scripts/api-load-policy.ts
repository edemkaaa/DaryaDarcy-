import { setTimeout as delay } from "node:timers/promises";

export type LoadFixture = {
  id: string;
  name: string;
  owner: string;
  ports: Record<string, { HostIp: string; HostPort: string }[]>;
  tmpfs: Record<string, string>;
  mounts: unknown[];
};
export function assertLoadFixture(
  uri: string,
  id: string,
  fixture: LoadFixture,
): URL {
  const url = new URL(uri),
    bindings = fixture.ports?.["3306/tcp"];
  if (
    !/^[a-f0-9]{64}$/.test(id) ||
    fixture.id !== id ||
    !/^daryadarcy-fresh-load-[a-z0-9-]+$/.test(fixture.owner) ||
    fixture.name !== `/${fixture.owner}` ||
    !fixture.tmpfs?.["/var/lib/mysql"] ||
    fixture.mounts?.length !== 0 ||
    bindings?.length !== 1 ||
    bindings[0]?.HostIp !== "127.0.0.1" ||
    bindings[0]?.HostPort !== url.port ||
    url.protocol !== "mysql:" ||
    url.hostname !== "127.0.0.1" ||
    !url.port ||
    url.pathname !== "/backend_test" ||
    url.search ||
    url.hash
  )
    throw new Error("Unowned load fixture refused");
  return url;
}

export type LoadSample = {
  ms: number;
  lag: number;
  status: number;
  bytes: number;
  error: string;
};
export function summarizeLoad(samples: LoadSample[]) {
  const times = samples.map((row) => row.ms).sort((a, b) => a - b);
  const percentile = (values: number[], p: number) =>
    values.length
      ? Math.round(values[Math.ceil(values.length * p) - 1]! * 100) / 100
      : null;
  const statuses: Record<string, number> = {};
  for (const row of samples)
    statuses[row.status] = (statuses[row.status] ?? 0) + 1;
  return {
    count: samples.length,
    errors: samples.filter((row) => row.error || row.status !== 200).length,
    p50: percentile(times, 0.5),
    p95: percentile(times, 0.95),
    p99: percentile(times, 0.99),
    max: times.at(-1) ?? null,
    lagP95: percentile(
      samples.map((row) => row.lag).sort((a, b) => a - b),
      0.95,
    ),
    bytes: samples.reduce((total, row) => total + row.bytes, 0),
    statuses,
  };
}

/** Open arrivals: do not silently lower offered load when requests become slow. */
export async function runArrivalStage(
  rps: number,
  seconds: number,
  cap: number,
  request: (index: number, lag: number) => Promise<void>,
  stopped = () => false,
) {
  if (
    !(
      rps > 0 &&
      rps <= 50 &&
      seconds > 0 &&
      seconds <= 300 &&
      cap >= 1 &&
      cap <= 50
    )
  )
    throw new Error("Unsafe load bounds");
  const planned = Math.round(rps * seconds),
    start = performance.now(),
    pending = new Set<Promise<void>>();
  let started = 0,
    dropped = 0,
    maxInflight = 0;
  for (let index = 0; index < planned && !stopped(); index++) {
    const due = start + (index * 1000) / rps;
    if (due > performance.now()) await delay(due - performance.now());
    if (stopped()) break;
    if (pending.size >= cap) {
      dropped++;
      continue;
    }
    const lag = Math.max(0, performance.now() - due);
    started++;
    const task = request(index, lag).finally(() => pending.delete(task));
    pending.add(task);
    maxInflight = Math.max(maxInflight, pending.size);
  }
  await Promise.all(pending);
  return {
    planned,
    started,
    dropped,
    unstarted: planned - started - dropped,
    maxInflight,
    wallMs: performance.now() - start,
  };
}
