/** HTTP-граница TEST-уведомлений YooKassa с последующей серверной проверкой платежа. */
import { Controller, Inject, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from "zod";
import { paymentIdSchema } from "./client";
import { YookassaClubService } from "./club.service";

const notification = z.object({
  type: z.literal("notification"),
  event: z.enum(["payment.succeeded", "payment.canceled"]),
  object: z.object({ id: paymentIdSchema }),
});

@Controller("api/yookassa/webhook")
export class YookassaWebhookController {
  /** Получает TEST-оркестратор через Nest вместо собственной логики выдачи доступа. */
  constructor(
    @Inject(YookassaClubService) private readonly payments: YookassaClubService,
  ) {}

  /** Валидирует notification/event/payment UUID, затем ждёт серверную проверку payment; временный отказ возвращает 503 для повторной доставки. */
  @Post()
  async post(
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    response.setHeader("Cache-Control", "no-store");
    const parsed = notification.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "Некорректное уведомление" });
      return;
    }
    try {
      await this.payments.handleNotification(parsed.data.object.id);
      response.status(200).json({ accepted: true });
    } catch {
      // Non-200 keeps genuine early callbacks/provider outages retriable.
      // Never expose untrusted provider bodies, errors or credentials.
      response
        .status(503)
        .json({ error: "Подтверждение оплаты временно недоступно" });
    }
  }
}
