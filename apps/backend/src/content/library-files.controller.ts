/** HTTP-граница списков и скачивания Библиотеки; клиентский интерфейс не заменяет проверку доступа. */
import { Controller, Get, Inject, Param, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { SessionService } from "../identity/session.service";
import { userHasClubAccess } from "../identity/club-access";
import { HttpError } from "../../../../packages/shared/src/_core/errors";
import { sendPrivateFile } from "./private-files.controller";
import {
  libraryFile,
  libraryFileKey,
  libraryFilesEnabled,
  libraryMaterialKey,
  listLibraryFiles,
} from "./library-files";

@Controller("api")
export class LibraryFilesController {
  /** Получаем сервис сессий, чтобы доступ к Библиотеке проверялся по текущему пользователю на каждом запросе. */
  constructor(
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}
  /** Проверяем оба флага, известный материал, наличие сессии и клубный доступ; недействительная сессия закрывает файл, инфраструктурная ошибка поднимается выше. */
  private async allowed(req: Request, material: string) {
    if (
      !libraryFilesEnabled() ||
      !libraryMaterialKey(material) ||
      (!req.headers.cookie && !req.headers.authorization)
    )
      return false;
    try {
      return await userHasClubAccess(
        await this.sessions.authenticateRequest(req),
      );
    } catch (error) {
      if (error instanceof HttpError && error.statusCode === 403) return false;
      throw error;
    }
  }
  /** Разбираем ограниченный курсор sortOrder:id, запрещаем лишние параметры и кеширование; недоступность скрываем за 404, временный сбой за 503. */
  @Get("library/materials/:materialKey/files")
  async list(
    @Param("materialKey") material: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const cursor =
      typeof req.query.cursor === "string" &&
      /^(0|[1-9]\d*):[1-9]\d*$/.test(req.query.cursor)
        ? (req.query.cursor.split(":").map(Number) as [number, number])
        : null;
    try {
      if (
        Object.keys(req.query).some((key) => key !== "cursor") ||
        (req.query.cursor !== undefined &&
          (!cursor ||
            cursor.some(
              (value) => !Number.isSafeInteger(value) || value > 2147483647,
            ))) ||
        !(await this.allowed(req, material))
      )
        return res.status(404).json({ error: "Файл недоступен." });
      return res.json(await listLibraryFiles(material, cursor));
    } catch {
      return res.status(503).json({ error: "Файл временно недоступен." });
    }
  }
  /** Передаём скачивание общему обработчику приватных файлов с повторной проверкой материала, ключа и членства; произвольные параметры не допускаются. */
  @Get("media/library-files/:materialKey/:fileKey")
  read(
    @Param("materialKey") material: string,
    @Param("fileKey") key: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return sendPrivateFile(
      req,
      res,
      async () => {
        if (
          Object.keys(req.query).length ||
          !libraryFileKey(key) ||
          !(await this.allowed(req, material))
        )
          return;
        return libraryFile(material, key);
      },
      key,
    );
  }
}
