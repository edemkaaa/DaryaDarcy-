/** Разделяет публичное оформление и административное чтение/сохранение настроек запуска. */
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
import { SEASON_IMAGE_SHARING_PAGE_MESSAGE } from "./settings";

@Controller("api")
export class LaunchController {
  // esbuild does not emit TypeScript's constructor type metadata.
  /** Явно внедряем сервис оформления через Inject, поскольку сборщик не создаёт метаданные типов конструктора Nest. */
  constructor(@Inject(LaunchService) private readonly launch: LaunchService) {}

  /** Возвращаем публичную проекцию текущего оформления без кеширования, не раскрывая полный административный документ. */
  @Get("launch-config")
  @Header("Cache-Control", "no-store")
  async publicConfiguration(@Res() res: Response) {
    try {
      res.json(await this.launch.publicConfiguration());
    } catch (error) {
      this.failure(res, error);
    }
  }

  /** После административного guard выдаём полный снимок настроек вместе с ревизией для редактора. */
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

  /** Передаём подтверждённого guard исполнителя, ожидаемую ревизию и новый документ в атомарное сохранение. */
  @Put("admin/launch-settings")
  @Header("Cache-Control", "no-store")
  @UseGuards(AdministratorGuard)
  @UseFilters(SessionAccessFilter)
  async save(@Req() req: AuthenticatedRequest, @Res() res: Response) {
    try {
      res.json(
        await this.launch.save(
          req.authenticatedUser,
          req.body?.expectedRevision,
          req.body?.config,
        ),
      );
    } catch (error) {
      this.failure(res, error);
    }
  }

  /** Сохраняем статусы ввода, прав и конфликта, показывая только согласованные пояснения о share-ссылке и устаревшей ревизии; остальные детали скрываем. */
  private failure(res: Response, error: unknown) {
    const status =
      error instanceof TRPCError
        ? ((
            {
              BAD_REQUEST: 400,
              UNAUTHORIZED: 401,
              FORBIDDEN: 403,
              CONFLICT: 409,
            } as Partial<Record<TRPCError["code"], number>>
          )[error.code] ?? 503)
        : 503;
    res.status(status).json({
      error:
        status === 400 &&
        error instanceof TRPCError &&
        error.message === SEASON_IMAGE_SHARING_PAGE_MESSAGE
          ? SEASON_IMAGE_SHARING_PAGE_MESSAGE
          : status === 409
            ? "Настройки изменились. Обновите страницу"
            : "Запрос недоступен",
    });
  }
}
