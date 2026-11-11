/** Проверяем безопасность цели нагрузки и честность измерений, включая отброшенные запросы. */
import { describe, expect, it } from "vitest";
import * as policy from "../tooling/scripts/api-load-policy";

// Missing safety/stats would permit targeting a working DB or hiding dropped load.
const id = "a".repeat(64),
  owner = "daryadarcy-fresh-load-fixture";
const uri = "mysql://fixture:only@127.0.0.1:54123/backend_test";
const fixture = {
  id,
  name: `/${owner}`,
  owner,
  ports: { "3306/tcp": [{ HostIp: "127.0.0.1", HostPort: "54123" }] },
  tmpfs: { "/var/lib/mysql": "rw,size=1g" },
  mounts: [],
};

/** Допуск требует совпадения loopback URI, ID, labels, порта и одноразового tmpfs-контейнера. */
describe("local load target and measurement safety", () => {
  /** Меняем каждый признак владения отдельно; чужой volume, публичный порт и иной URI должны давать отказ. */
  it("accepts only the exact labelled loopback tmpfs fixture", () => {
    expect(typeof policy.assertLoadFixture).toBe("function");
    expect(policy.assertLoadFixture(uri, id, fixture).port).toBe("54123");
    for (const change of [
      { owner: "someone-else" },
      { id: "b".repeat(64) },
      { name: "/other" },
      { tmpfs: {} },
      { mounts: [{ Type: "volume" }] },
      { ports: { "3306/tcp": [{ HostIp: "0.0.0.0", HostPort: "54123" }] } },
    ])
      expect(() =>
        policy.assertLoadFixture(uri, id, { ...fixture, ...change }),
      ).toThrow();
    for (const target of [
      uri.replace("127.0.0.1", "localhost"),
      uri.replace("backend_test", "working"),
      uri + "?x=1",
      uri.replace("54123", "50130"),
    ]) {
      expect(() => policy.assertLoadFixture(target, id, fixture)).toThrow();
    }
  });
  /** Timeout остаётся в максимуме и счётчике ошибок; пустая выборка не получает выдуманный p95. */
  it("uses tail latency and counts failures rather than filtering them out", () => {
    expect(typeof policy.summarizeLoad).toBe("function");
    const samples = Array.from({ length: 100 }, (_, i) => ({
      ms: i + 1,
      lag: 2,
      status: 200,
      bytes: 3,
      error: "",
    }));
    samples[99] = { ms: 5000, lag: 12, status: 0, bytes: 0, error: "timeout" };
    expect(policy.summarizeLoad(samples)).toMatchObject({
      count: 100,
      errors: 1,
      p50: 50,
      p95: 95,
      p99: 99,
      max: 5000,
      bytes: 297,
      statuses: { "200": 99, "0": 1 },
    });
    expect(policy.summarizeLoad([])).toMatchObject({ count: 0, p95: null });
  });
  /** Слишком медленный исполнитель не скрывает запланированные arrivals: started и dropped должны составить весь план. */
  it("records scheduled requests dropped at the concurrency cap", async () => {
    expect(typeof policy.runArrivalStage).toBe("function");
    const result = await policy.runArrivalStage(50, 0.2, 1, async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    expect(result.planned).toBe(10);
    expect(result.started + result.dropped).toBe(10);
    expect(result.dropped).toBeGreaterThan(0);
    expect(result.maxInflight).toBe(1);
  });
});
