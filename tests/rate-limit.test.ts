/** Процессный fixed-window limiter проверяется управляемыми часами, без реального ожидания. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
let checkRateLimit: typeof import("../apps/backend/src/_core/rate-limit").checkRateLimit;
/** Чистый модуль и fake clock делают начало каждого окна воспроизводимым. */
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-02T12:00:00Z"));
  ({ checkRateLimit } = await import("../apps/backend/src/_core/rate-limit"));
});
/** Возвращаем настоящие таймеры. */
afterEach(() => vi.useRealTimers());

/** Отказ не продлевает окно; Retry-After округляется до оставшихся секунд. */
it("allows exactly the configured number of attempts and resets only at expiry", () => {
  expect(checkRateLimit("member", 2, 10000)).toEqual({ ok: true });
  expect(checkRateLimit("member", 2, 10000)).toEqual({ ok: true });
  expect(checkRateLimit("member", 2, 10000)).toEqual({ ok: false, retryAfterSec: 10 });
  vi.advanceTimersByTime(9999);
  expect(checkRateLimit("member", 2, 10000)).toEqual({ ok: false, retryAfterSec: 1 });
  vi.advanceTimersByTime(1);
  expect(checkRateLimit("member", 2, 10000)).toEqual({ ok: true });
});

/** Предел 10 000 buckets защищает память, не снимая уже действующие ограничения. */
it("bounds distinct keys and refuses new keys without evicting active limits", () => {
  for (let index = 0; index < 10000; index++) expect(checkRateLimit(`ip:${index}`, 1, 900000).ok).toBe(true);
  const refused = checkRateLimit("new-ip", 1, 900000);
  expect(refused.ok).toBe(false);
  if (!refused.ok) expect(refused.retryAfterSec).toBeGreaterThan(0);
  expect(checkRateLimit("ip:0", 1, 900000).ok).toBe(false);
});

/** После истечения старых buckets новая операция снова допускается. */
it("reclaims expired keys so capacity exhaustion does not disable the service permanently", () => {
  for (let index = 0; index < 10000; index++) checkRateLimit(`email:${index}`, 1, 1000);
  expect(checkRateLimit("new-key", 1, 1000).ok).toBe(false);
  vi.advanceTimersByTime(60000);
  expect(checkRateLimit("new-key", 1, 1000).ok).toBe(true);
});

/** Слишком длинный ключ, нулевая квота и бесконечный период не создают запись. */
it("rejects oversized keys and invalid quotas instead of storing unbounded or unusable entries", () => {
  expect(checkRateLimit("x".repeat(513), 1, 1000).ok).toBe(false);
  expect(checkRateLimit("zero", 0, 1000).ok).toBe(false);
  expect(checkRateLimit("infinite", 1, Infinity).ok).toBe(false);
});
