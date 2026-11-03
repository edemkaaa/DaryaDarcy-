import { Controller, Inject, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { ProdamusTestClubService } from "./prodamus-test-club.service";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { enforceReturnCheckLimit } from "./yookassa/return-check-limit";

const resultInput = z.object({ token: z.string().max(192) }).strict();

@Controller("api/prodamus/test")
export class ProdamusTestClubController {
  constructor(
    @Inject(ProdamusTestClubService)
    private readonly service: ProdamusTestClubService,
  ) {}
  @Post("webhook")
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
  @Post("result")
  async result(@Req() request: Request, @Res() response: Response) {
    if (Object.keys(request.query).length || request.headers.cookie) {
      response.status(400).json({ error: "invalid test result request" });
      return;
    }
    if (!request.is("application/json")) {
      response.status(415).json({ error: "unsupported test content type" });
      return;
    }
    try {
      await enforceReturnCheckLimit(request, response);
      const input = resultInput.safeParse(request.body);
      if (!input.success) {
        response.status(400).json({ error: "invalid test result request" });
        return;
      }
      response.status(200).json(await this.service.result(input.data.token));
    } catch (error) {
      const status =
        error instanceof TRPCError && error.code === "TOO_MANY_REQUESTS"
          ? 429
          : error instanceof TRPCError && error.code === "BAD_REQUEST"
            ? 400
            : 503;
      response.status(status).json({ error: "test result unavailable" });
    }
  }
}
