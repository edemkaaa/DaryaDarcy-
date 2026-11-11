/** HTTP-выдача закрытых фото и файлов с авторизацией через серверный сервис. */
import { Controller, Get, Inject, Param, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { PrivateContentFilesService } from "./private-content-files.service";
import { sendPrivateFile } from "./private-files.controller";

@Controller("api/media/content-files")
export class PrivateContentFilesController {
  /** Подключаем единую проверку актуальной приватной привязки вместо самостоятельной выдачи по assetId. */
  constructor(@Inject(PrivateContentFilesService) private readonly files: PrivateContentFilesService) {}
  /** Принимаем только точный UUIDv4 без параметров и включённый контракт; авторизацию и передачу байтов делегируем сервису и общему потоковому обработчику. */
  @Get(":assetId")
  read(@Param("assetId") assetId: string, @Req() req: Request, @Res() res: Response) {
    return sendPrivateFile(req, res, async () => {
      if (process.env.PRIVATE_CONTENT_FILES_ENABLED !== "true" || Object.keys(req.query).length ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(assetId)) return;
      return this.files.authorizedFile(assetId, req);
    });
  }
}
