/** Транспортная граница рабочего webhook; проверкой подписи и settlement владеет подключённый обработчик. */
import { Controller, Get, Inject, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";

export const PRODAMUS_WEBHOOK_HANDLER = Symbol("PRODAMUS_WEBHOOK_HANDLER");
export type ProdamusWebhookHandler = {
  handle(request: Request, response: Response): Promise<void>;
};

/** Только транспортный вход; проверкой и settlement владеет существующий обработчик. */
@Controller("api/prodamus/webhook")
export class ProdamusWebhookController {
  constructor(
    @Inject(PRODAMUS_WEBHOOK_HANDLER)
    private readonly webhook: ProdamusWebhookHandler,
  ) {}

  @Get()
  get(@Req() request: Request, @Res() response: Response) {
    return this.webhook.handle(request, response);
  }

  @Post()
  post(@Req() request: Request, @Res() response: Response) {
    return this.webhook.handle(request, response);
  }
}
