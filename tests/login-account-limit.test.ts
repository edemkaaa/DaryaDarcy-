import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LoginAccountLimiter } from "../apps/backend/src/identity/login-account-limit";

let limiter: LoginAccountLimiter;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-28T12:00:00Z"));
  limiter = new LoginAccountLimiter();
});
afterEach(() => vi.useRealTimers());
const burst = (email = "member@example.test") => {
  for (let i = 0; i < 5; i++) expect(limiter.begin(email).ok).toBe(true);
};

it("shares quota across case and whitespace variants but isolates another account", () => {
  burst();
  expect(limiter.begin("  MEMBER@EXAMPLE.TEST ")).toEqual({
    ok: false,
    retryAfterSec: 1,
  });
  expect(limiter.begin("other@example.test").ok).toBe(true);
});
it("increases cooldown to 30 seconds without a permanent lock or server-side sleep", () => {
  burst();
  for (const seconds of [1, 2, 4, 8, 16, 30, 30]) {
    expect(limiter.begin("member@example.test")).toEqual({
      ok: false,
      retryAfterSec: seconds,
    });
    vi.advanceTimersByTime(seconds * 1000 - 1);
    expect(limiter.begin("member@example.test")).toEqual({
      ok: false,
      retryAfterSec: 1,
    });
    vi.advanceTimersByTime(1);
    expect(limiter.begin("member@example.test").ok).toBe(true);
  }
});
it("refused retries do not move the deadline", () => {
  burst();
  for (let i = 0; i < 100; i++)
    expect(limiter.begin("member@example.test").ok).toBe(false);
  vi.advanceTimersByTime(1000);
  expect(limiter.begin("member@example.test").ok).toBe(true);
});
it("forgets old attempts after a fixed 15 minute observation window", () => {
  burst();
  vi.advanceTimersByTime(15 * 60_000);
  burst();
});
it("a completed successful sign-in clears its quota", () => {
  const attempt = limiter.begin("member@example.test");
  expect(attempt.ok).toBe(true);
  if (attempt.ok) attempt.succeeded();
  burst();
});
it("a slow earlier success cannot clear newer reservations", () => {
  const first = limiter.begin("member@example.test");
  for (let i = 0; i < 4; i++)
    expect(limiter.begin("member@example.test").ok).toBe(true);
  if (first.ok) first.succeeded();
  expect(limiter.begin("member@example.test").ok).toBe(false);
});
it("a stale completion cannot clear a new observation window", () => {
  const first = limiter.begin("member@example.test");
  vi.advanceTimersByTime(15 * 60_000);
  burst();
  if (first.ok) first.succeeded();
  expect(limiter.begin("member@example.test").ok).toBe(false);
});
it("bounds distinct accounts, preserves active quotas and reclaims expired capacity", () => {
  burst();
  for (let i = 1; i < 10_000; i++)
    expect(limiter.begin(`capacity-${i}@example.test`).ok).toBe(true);
  expect(limiter.begin("overflow@example.test")).toEqual({
    ok: false,
    retryAfterSec: 60,
  });
  expect(limiter.begin("member@example.test").ok).toBe(false);
  vi.advanceTimersByTime(15 * 60_000);
  expect(limiter.begin("overflow@example.test").ok).toBe(true);
});
