/** Локальное окно ограничения частоты для одного процесса; выбор общего режима выполняется выше. */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10000;
const CLEANUP_INTERVAL_MS = 60000;
let lastCleanup = 0;

/** Считает попытки одного ключа в фиксированном окне процесса; очищает истёкшие записи и отказывает при переполнении, не вытесняя живую квоту. */
export function checkRateLimit(key: string, max: number, windowMs: number): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  if (key.length > 512 || !Number.isSafeInteger(max) || max <= 0 || !Number.isSafeInteger(windowMs) || windowMs <= 0) {
    return { ok: false, retryAfterSec: 60 };
  }
  if (now - lastCleanup >= CLEANUP_INTERVAL_MS) {
    for (const [storedKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(storedKey);
    }
    lastCleanup = now;
  }
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    // Do not evict a live bucket: attackers could reset another account's quota.
    if (!existing && buckets.size >= MAX_BUCKETS) {
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((lastCleanup + CLEANUP_INTERVAL_MS - now) / 1000)) };
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (existing.count >= max) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  existing.count += 1;
  return { ok: true };
}
