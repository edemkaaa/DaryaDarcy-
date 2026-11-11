/** Считает вызовы старого checkout до валидации и внешней работы, включая элементы batch-запроса. */
import { TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import { checkRequestRateLimit } from "../_core/request-rate-limit";
import { clientIp } from "../sms-auth";

/** Каждый вызов, включая batch, учитывается до валидации и работы с провайдером. */
export async function enforceLegacyCheckoutLimit(
  req: Request,
  res: Response,
  userId?: number,
) {
  const windowMs = 15 * 60_000;
  const keys: [string, number][] = [
    [`legacy-checkout:ip:${clientIp(req) || "unknown"}`, 30],
  ];
  if (userId !== undefined) keys.push([`legacy-checkout:user:${userId}`, 5]);
  for (const [key, max] of keys) {
    const limit = await checkRequestRateLimit(key, max, windowMs);
    if (limit.ok) continue;
    res.setHeader(
      "Retry-After",
      Math.max(Number(res.getHeader("Retry-After")) || 0, limit.retryAfterSec),
    );
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Слишком много запросов оплаты. Попробуйте позже",
    });
  }
}
