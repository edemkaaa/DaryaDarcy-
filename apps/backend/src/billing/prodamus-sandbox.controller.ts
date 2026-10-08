import { Controller, Inject, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { ProdamusSandboxService } from "./prodamus-sandbox.service";

/** Separate diagnostic ingress: no GET, sessions, purchase or settlement. */
@Controller("api/prodamus/sandbox/webhook")
export class ProdamusSandboxController {
  constructor(
    @Inject(ProdamusSandboxService)
    private readonly sandbox: ProdamusSandboxService,
  ) {}

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
