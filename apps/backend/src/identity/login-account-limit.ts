/** Добавляет лимит по аккаунту к IP-квоте, сохраняя выбор локального или общего MySQL-режима. */
import { createHash } from "node:crypto";
import { normalizeEmail } from "../_core/password";
import { coordinationMode } from "../database/coordination";
import { beginSharedLogin } from "../database/shared-limits";

type Bucket = { attempts: number; expiresAt: number; nextAllowedAt: number };
type Admission =
  | { ok: true; succeeded(): void }
  | { ok: false; retryAfterSec: number };

/** Локальный лимит аккаунта не зависит от IP.
 * Для нескольких API нужна общая атомарная реализация, выбранная в beginLoginAccount.
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
    // В ключи и журналы не попадает исходный email/пароль, в том числе неизвестного аккаунта.
    const key = createHash("sha256")
      .update(normalizeEmail(email))
      .digest("hex");
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.expiresAt <= now) {
      // Новые адреса не вытесняют действующие квоты: иначе лимит можно было бы обойти.
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

    // Резервируем до асинхронной проверки пароля, чтобы параллельные запросы
    // не делили один остаток попыток. Отказ не продлевает паузу.
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
        // Поздний успех старой попытки не должен обнулять квоту более новой.
        if (this.buckets.get(key) === admitted && admitted.attempts === attempt)
          this.buckets.delete(key);
      },
    };
  }
}

export const loginAccountLimiter = new LoginAccountLimiter();

/** Выбирает тот же режим координации, что и HTTP-квота; при нескольких API используется общая БД. */
export async function beginLoginAccount(email: string) {
  return coordinationMode() === "mysql"
    ? beginSharedLogin(email)
    : loginAccountLimiter.begin(email);
}
