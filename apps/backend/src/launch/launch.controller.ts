import {
  Controller,
  Get,
  Header,
  Inject,
  Put,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import { TRPCError } from "@trpc/server";
import type { Response } from "express";
import {
  AdministratorGuard,
  SessionAccessFilter,
  type AuthenticatedRequest,
} from "../identity/http-access";
import { LaunchService } from "./launch.service";

@Controller("api")
export class LaunchController {
  // esbuild does not emit TypeScript's constructor type metadata.
  constructor(@Inject(LaunchService) private readonly launch: LaunchService) {}

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
  @UseGuards(AdministratorGuard)
  @UseFilters(SessionAccessFilter)
  async configuration(@Res() res: Response) {
    try {
      res.json(await this.launch.configuration());
    } catch (error) {
      this.failure(res, error);
    }
  }

  @Put("admin/launch-settings")
  @Header("Cache-Control", "no-store")
  @UseGuards(AdministratorGuard)
  @UseFilters(SessionAccessFilter)
  async save(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    try {
      res.json(
        await this.launch.save(
          req.authenticatedUser.id,
          req.body?.expectedRevision,
          req.body?.config,
        ),
      );
    } catch (error) {
      this.failure(res, error);
    }
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
    res.status(status).json({
      error:
        status === 409
          ? "Настройки изменились. Обновите страницу"
          : "Запрос недоступен",
    });
  }
}
