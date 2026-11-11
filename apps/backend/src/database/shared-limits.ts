/** Общие лимиты нескольких API хранят хеши ключей и поколение попытки, не исходные email или секреты. */
import { createHash, randomUUID } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { normalizeEmail } from "../_core/password";
import { coordinationUnavailable, withDatabaseLock } from "./coordination";

export type LimitDecision = { ok: true } | { ok: false; retryAfterSec: number };
type Reservation =
  | { ok: true; key: string; generation: string; attempt: number }
  | { ok: false; retryAfterSec: number };
type Kind = "rate" | "login";
const query = <T extends RowDataPacket[]>(
  connection: PoolConnection,
  sql: string,
  values: unknown[] = [],
) => connection.query<T>({ sql, values, timeout: 5000 });

/** Проверка вместимости и изменение счётчика используют одну named lock для вида лимита.
 * В таблице остаётся хеш ключа, исходный контакт и секрет не сохраняются.
 */
async function reserve(
  kind: Kind,
  rawKey: string,
  max: number,
  windowMs: number,
): Promise<Reservation> {
  const key = createHash("sha256").update(rawKey).digest("hex");
  try {
    const result = await withDatabaseLock(
      `limits:${kind}`,
      1,
      async (connection) => {
        const [clock] = await query<RowDataPacket[]>(
          connection,
          "SELECT FLOOR(UNIX_TIMESTAMP(CURRENT_TIMESTAMP(3))*1000) AS now",
        );
        const now = Number(clock[0]?.now);
        if (!Number.isSafeInteger(now) || now <= 0)
          throw coordinationUnavailable();
        await connection.query({
          sql: "DELETE FROM api_rate_limits WHERE kind=? AND expiresAt<=? LIMIT 100",
          values: [kind, now],
          timeout: 5000,
        });
        const [rows] = await query<RowDataPacket[]>(
          connection,
          "SELECT attempts,expiresAt,nextAllowedAt,generation FROM api_rate_limits WHERE kind=? AND keyHash=?",
          [kind, key],
        );
        const existing = rows[0];
        let attempt = 1,
          expiresAt = now + windowMs,
          generation = randomUUID();
        if (existing && Number(existing.expiresAt) > now) {
          if (kind === "rate" && Number(existing.attempts) >= max)
            return {
              ok: false as const,
              retryAfterSec: Math.max(
                1,
                Math.ceil((Number(existing.expiresAt) - now) / 1000),
              ),
            };
          if (kind === "login" && Number(existing.nextAllowedAt) > now)
            return {
              ok: false as const,
              retryAfterSec: Math.ceil(
                (Number(existing.nextAllowedAt) - now) / 1000,
              ),
            };
          attempt = Number(existing.attempts) + 1;
          expiresAt = Number(existing.expiresAt);
          generation = existing.generation;
        } else if (!existing) {
          const [size] = await query<RowDataPacket[]>(
            connection,
            "SELECT COUNT(*) AS n FROM api_rate_limits WHERE kind=?",
            [kind],
          );
          if (Number(size[0].n) >= 10_000)
            return { ok: false as const, retryAfterSec: 60 };
        }
        const delay =
          kind === "login" && attempt >= 5
            ? Math.min(30_000, 1000 * 2 ** Math.min(attempt - 5, 5))
            : 0;
        await connection.query({
          sql: "INSERT INTO api_rate_limits(kind,keyHash,attempts,expiresAt,nextAllowedAt,generation) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE attempts=VALUES(attempts),expiresAt=VALUES(expiresAt),nextAllowedAt=VALUES(nextAllowedAt),generation=VALUES(generation)",
          values: [kind, key, attempt, expiresAt, now + delay, generation],
          timeout: 5000,
        });
        return { ok: true as const, key, generation, attempt };
      },
    );
    if (!result.acquired) throw coordinationUnavailable();
    return result.value;
  } catch {
    throw coordinationUnavailable();
  }
}

/** Резервирует попытку в общем окне; отказ хранилища не превращает квоту в разрешение. */
export async function checkSharedRateLimit(
  key: string,
  max: number,
  windowMs: number,
): Promise<LimitDecision> {
  if (
    key.length > 512 ||
    !Number.isSafeInteger(max) ||
    max <= 0 ||
    !Number.isSafeInteger(windowMs) ||
    windowMs <= 0 ||
    !Number.isSafeInteger(Date.now() + windowMs)
  )
    return { ok: false, retryAfterSec: 60 };
  const result = await reserve("rate", key, max, windowMs);
  return result.ok ? { ok: true } : result;
}

/** Возвращает завершение только этой попытки: старый успешный вход не обнуляет новое поколение лимита. */
export async function beginSharedLogin(
  email: string,
): Promise<
  | { ok: true; succeeded(): Promise<void> }
  | { ok: false; retryAfterSec: number }
> {
  const admission = await reserve(
    "login",
    normalizeEmail(email),
    0,
    15 * 60_000,
  );
  if (!admission.ok) return admission;
  return {
    ok: true,
    succeeded: async () => {
      try {
        const result = await withDatabaseLock(
          "limits:login",
          1,
          async (connection) => {
            await connection.query({
              sql: "DELETE FROM api_rate_limits WHERE kind='login' AND keyHash=? AND generation=? AND attempts=?",
              values: [admission.key, admission.generation, admission.attempt],
              timeout: 5000,
            });
          },
        );
        if (!result.acquired) throw coordinationUnavailable();
      } catch {
        throw coordinationUnavailable();
      }
    },
  };
}
