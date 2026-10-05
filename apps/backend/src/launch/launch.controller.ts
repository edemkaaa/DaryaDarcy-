import { Controller, Get, Header, Inject, Put, Req, Res } from "@nestjs/common";
import { TRPCError } from "@trpc/server";
import type { Request, Response } from "express";
import { SessionService } from "../identity/session.service";
import { LaunchService } from "./launch.service";

@Controller("api")
export class LaunchController {
  // esbuild does not emit TypeScript's constructor type metadata.
  constructor(
    @Inject(LaunchService) private readonly launch: LaunchService,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  @Get("launch-config")
  @Header("Cache-Control", "no-store")
  async publicConfiguration(@Res() res: Response) {
    try {
      res.json(await this.launch.publicConfiguration());
    } catch (error) {
      this.failure(res, error);
    }
  }

  @Get("admin/launch-settings")
  @Header("Cache-Control", "no-store")
  async configuration(@Req() req: Request, @Res() res: Response) {
    const actor = await this.adminActor(req, res);
    if (!actor) return;
    try {
      res.json(await this.launch.configuration());
    } catch (error) {
      this.failure(res, error);
    }
  }

  @Put("admin/launch-settings")
  @Header("Cache-Control", "no-store")
  async save(@Req() req: Request, @Res() res: Response) {
    // Preserve content-type/auth ordering and the legacy plain-text 415 response.
    if (!req.is("application/json")) {
      res.sendStatus(415);
      return;
    }
    const actor = await this.adminActor(req, res);
    if (!actor) return;
    try {
      res.json(
        await this.launch.save(
          actor.id,
          req.body?.expectedRevision,
          req.body?.config,
        ),
      );
    } catch (error) {
      this.failure(res, error);
    }
  }

  private async adminActor(req: Request, res: Response) {
    let actor;
    try {
      actor = await this.sessions.authenticateRequest(req);
    } catch {
      res.sendStatus(401);
      return null;
    }
    if (!this.sessions.isAdministrator(actor)) {
      res.sendStatus(403);
      return null;
    }
    return actor;
  }

  private failure(res: Response, error: unknown) {
    const status =
      error instanceof TRPCError
        ? ((
            { BAD_REQUEST: 400, FORBIDDEN: 403, CONFLICT: 409 } as Partial<
              Record<TRPCError["code"], number>
            >
          )[error.code] ?? 503)
        : 503;
    res
      .status(status)
      .json({
        error:
          status === 409
            ? "Настройки изменились. Обновите страницу"
            : "Запрос недоступен",
      });
  }
}
