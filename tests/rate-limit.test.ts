import { afterEach, beforeEach, expect, it, vi } from "vitest";
let checkRateLimit: typeof import("../apps/backend/src/_core/rate-limit").checkRateLimit;
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
  ({ checkRateLimit } = await import("../apps/backend/src/_core/rate-limit"));
});
afterEach(() => vi.useRealTimers());

it("allows exactly the configured number of attempts and resets only at expiry", () => {
  expect(checkRateLimit("member", 2, 10000)).toEqual({ ok: true });
  expect(checkRateLimit("member", 2, 10000)).toEqual({ ok: true });
  expect(checkRateLimit("member", 2, 10000)).toEqual({ ok: false, retryAfterSec: 10 });
  vi.advanceTimersByTime(9999);
  expect(checkRateLimit("member", 2, 10000)).toEqual({ ok: false, retryAfterSec: 1 });
  vi.advanceTimersByTime(1);
  expect(checkRateLimit("member", 2, 10000)).toEqual({ ok: true });
});

it("bounds distinct keys and refuses new keys without evicting active limits", () => {
  for (let index = 0; index < 10000; index++) expect(checkRateLimit(`ip:${index}`, 1, 900000).ok).toBe(true);
  const refused = checkRateLimit("new-ip", 1, 900000);
  expect(refused.ok).toBe(false);
  if (!refused.ok) expect(refused.retryAfterSec).toBeGreaterThan(0);
  expect(checkRateLimit("ip:0", 1, 900000).ok).toBe(false);
});

it("reclaims expired keys so capacity exhaustion does not disable the service permanently", () => {
  for (let index = 0; index < 10000; index++) checkRateLimit(`email:${index}`, 1, 1000);
  expect(checkRateLimit("new-key", 1, 1000).ok).toBe(false);
  vi.advanceTimersByTime(60000);
  expect(checkRateLimit("new-key", 1, 1000).ok).toBe(true);
});

it("rejects oversized keys and invalid quotas instead of storing unbounded or unusable entries", () => {
  expect(checkRateLimit("x".repeat(513), 1, 1000).ok).toBe(false);
  expect(checkRateLimit("zero", 0, 1000).ok).toBe(false);
  expect(checkRateLimit("infinite", 1, Infinity).ok).toBe(false);
});
