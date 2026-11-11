/** Квота регистрации push срабатывает до валидации, SQL и обработки отдельных элементов batch. */
import { TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import { checkRequestRateLimit } from "../_core/request-rate-limit";
import { clientIp } from "../sms-auth";

/** Каждый вызов процедуры, включая batch и неверный ввод, учитывается до валидации и SQL.
 * Ограниченное хранилище в mysql-режиме общее для нескольких API.
 */
export async function enforcePushRegistrationLimit(
  req: Request,
  res: Response,
  userId?: number,
): Promise<void> {
  const window = 15 * 60_000;
  refuse(
    await checkRequestRateLimit(
      `push-register:ip:${clientIp(req) || "unknown"}`,
      30,
      window,
    ),
    res,
  );
  if (userId !== undefined)
    refuse(await checkRequestRateLimit(`push-register:user:${userId}`, 10, window), res);
}

function refuse(limit: Awaited<ReturnType<typeof checkRequestRateLimit>>, res: Response): void {
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
