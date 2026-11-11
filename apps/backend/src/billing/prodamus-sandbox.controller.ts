/** Принимает только диагностический webhook, не создавая заказов, покупок и сессий. */
import { Controller, Inject, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { ProdamusSandboxService } from "./prodamus-sandbox.service";

/** Отдельный диагностический вход без GET, сессий, покупок и settlement. */
@Controller("api/prodamus/sandbox/webhook")
export class ProdamusSandboxController {
  /** Получает диагностический сервис через Nest, без запуска оплаты или подключения БД. */
  constructor(
    @Inject(ProdamusSandboxService)
    private readonly sandbox: ProdamusSandboxService,
  ) {}

  /** Отсекает query/cookie и посторонний MIME, затем передаёт исходные bytes/sign в sandbox-проверку и возвращает её безопасный результат. */
  @Post()
  notification(@Req() request: Request, @Res() response: Response) {
    if (Object.keys(request.query).length || request.headers.cookie) {
      response.status(400).json({ error: "Invalid sandbox notification" });
      return;
    }
    const type = (request.headers["content-type"] || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (
      !["application/json", "application/x-www-form-urlencoded"].includes(type)
    ) {
      response.status(415).json({ error: "Unsupported sandbox content type" });
      return;
    }
    const result = this.sandbox.acceptNotification(
      request.body,
      request.headers.sign,
    );
    response.status(result.status).json(result.body);
  }
}
