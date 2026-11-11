/** Отдельная HTTP-квота проверки возврата из оплаты; не меняет обработку webhook. */
import { TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import { z } from "zod";
import { checkRequestRateLimit } from "../../_core/request-rate-limit";
import { clientIp } from "../../sms-auth";
import { billingKey } from "../protocol";

/** Только HTTP-квота проверки возврата; settlement webhook и создание оплаты — отдельные потоки. */
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
  // Bearer-ключ intent не должен попадать даже в краткоживущие ключи счётчика памяти.
  const keyLimit = await checkRequestRateLimit(
    `yookassa-return-intent:${billingKey([key.data.toLowerCase()])}`,
    12,
    60_000,
  );
  refuse(keyLimit, res);
}

/** Преобразует отказ квоты в 429 и Retry-After, не продолжая провайдерскую проверку. */
function refuse(limit: Awaited<ReturnType<typeof checkRequestRateLimit>>, res: Response): void {
  if (limit.ok) return;
  res.setHeader("Retry-After", limit.retryAfterSec);
  throw new TRPCError({
    code: "TOO_MANY_REQUESTS",
    message: "Слишком много проверок оплаты. Попробуйте позже",
  });
}
