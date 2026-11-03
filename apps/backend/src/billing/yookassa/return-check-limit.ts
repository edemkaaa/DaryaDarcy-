import { TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import { z } from "zod";
import { checkRequestRateLimit } from "../../_core/request-rate-limit";
import { clientIp } from "../../sms-auth";
import { billingKey } from "../protocol";

/** HTTP-only quota; webhook settlement and payment creation are separate flows. */
export async function enforceReturnCheckLimit(req: Request, res: Response): Promise<void> {
  if (req.query?.batch !== undefined)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Проверяйте одну платёжную заявку за запрос",
    });
  const ipLimit = await checkRequestRateLimit(
    `yookassa-return-ip:${clientIp(req)}`,
    60,
    60_000,
  );
  refuse(ipLimit, res);
  const key = z.uuid().safeParse(req.headers["idempotency-key"]);
  if (!key.success)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Нужен ключ платёжной заявки",
    });
  // Keep bearer intent keys out of the short-lived in-memory counter keys.
  const keyLimit = await checkRequestRateLimit(
    `yookassa-return-intent:${billingKey([key.data.toLowerCase()])}`,
    12,
    60_000,
  );
  refuse(keyLimit, res);
}

function refuse(limit: Awaited<ReturnType<typeof checkRequestRateLimit>>, res: Response): void {
  if (limit.ok) return;
  res.setHeader("Retry-After", limit.retryAfterSec);
  throw new TRPCError({
    code: "TOO_MANY_REQUESTS",
    message: "Слишком много проверок оплаты. Попробуйте позже",
  });
}
