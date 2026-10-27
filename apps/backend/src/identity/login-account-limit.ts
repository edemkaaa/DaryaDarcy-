import { createHash } from "node:crypto";
import { normalizeEmail } from "../_core/password";

type Bucket = { attempts: number; expiresAt: number; nextAllowedAt: number };
type Admission =
  | { ok: true; succeeded(): void }
  | { ok: false; retryAfterSec: number };

/** Shared by login requests in this API process, independently of source IP.
 * Multiple workers require a shared atomic store before scaling out.
 */
export class LoginAccountLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private lastCleanup = 0;

  begin(email: string): Admission {
    const now = Date.now();
    if (now - this.lastCleanup >= 60_000) {
      for (const [key, bucket] of this.buckets)
        if (bucket.expiresAt <= now) this.buckets.delete(key);
      this.lastCleanup = now;
    }
    // No raw email/password in keys or logs, including for nonexistent accounts.
    const key = createHash("sha256")
      .update(normalizeEmail(email))
      .digest("hex");
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.expiresAt <= now) {
      // Never evict live quotas to admit attacker-controlled addresses.
      if (!bucket && this.buckets.size >= 10_000)
        return { ok: false, retryAfterSec: 60 };
      bucket = {
        attempts: 0,
        expiresAt: now + 15 * 60_000,
        nextAllowedAt: now,
      };
      this.buckets.set(key, bucket);
    }
    if (bucket.nextAllowedAt > now)
      return {
        ok: false,
        retryAfterSec: Math.ceil((bucket.nextAllowedAt - now) / 1000),
      };

    // Reserve before any asynchronous password check: parallel requests cannot
    // all see the same remaining burst. Refusals never extend the cooldown.
    const attempt = ++bucket.attempts;
    bucket.nextAllowedAt =
      now +
      (attempt < 5
        ? 0
        : Math.min(30_000, 1000 * 2 ** Math.min(attempt - 5, 5)));
    const admitted = bucket;
    return {
      ok: true,
      succeeded: () => {
        // A slow earlier success must not clear a newer attempt's quota.
        if (this.buckets.get(key) === admitted && admitted.attempts === attempt)
          this.buckets.delete(key);
      },
    };
  }
}

export const loginAccountLimiter = new LoginAccountLimiter();
