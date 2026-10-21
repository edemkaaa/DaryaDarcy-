import { TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import { checkRateLimit } from "../_core/rate-limit";
import { clientIp } from "../sms-auth";

/** Per procedure (including batches/invalid input), before validation and SQL.
 * Reuses the bounded process-local store; multiple API workers need shared quotas.
 */
export function enforcePushRegistrationLimit(
  req: Request,
  res: Response,
  userId?: number,
): void {
  const window = 15 * 60_000;
  refuse(
    checkRateLimit(
      `push-register:ip:${clientIp(req) || "unknown"}`,
      30,
      window,
    ),
    res,
  );
  if (userId !== undefined)
    refuse(checkRateLimit(`push-register:user:${userId}`, 10, window), res);
}

function refuse(limit: ReturnType<typeof checkRateLimit>, res: Response): void {
  if (limit.ok) return;
  res.setHeader(
    "Retry-After",
    Math.max(Number(res.getHeader("Retry-After")) || 0, limit.retryAfterSec),
  );
  throw new TRPCError({
    code: "TOO_MANY_REQUESTS",
    message: "Слишком много регистраций уведомлений. Попробуйте позже",
  });
}
