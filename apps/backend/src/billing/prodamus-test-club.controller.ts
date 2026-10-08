import { Controller, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { ProdamusTestClubService } from "./prodamus-test-club.service";

@Controller("api/prodamus/test/webhook")
export class ProdamusTestClubController {
  private readonly service = new ProdamusTestClubService();
  @Post()
  async notification(@Req() request: Request, @Res() response: Response) {
    if (Object.keys(request.query).length || request.headers.cookie) {
      response.status(400).send("invalid test notification");
      return;
    }
    const type = (request.headers["content-type"] || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (
      !["application/json", "application/x-www-form-urlencoded"].includes(type)
    ) {
      response.status(415).send("unsupported test content type");
      return;
    }
    const result = await this.service.notification(
      request.body,
      request.headers.sign,
    );
    response.status(result.status).send(result.body);
  }
}
