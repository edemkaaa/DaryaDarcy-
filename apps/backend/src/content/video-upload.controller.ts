/** Нативный маршрут бинарной видеозагрузки передаёт файл в доменный сервис после граничных проверок. */
import { Controller, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { retiredUploadMessage } from "../media/legacy-upload-policy";

@Controller("api/admin")
export class VideoUploadController {
  /** Оставляем tombstone старого публичного маршрута: даже без раннего admission-обработчика этот контроллер отвечает 404 и не создаёт файл. */
  @Post("upload-video")
  uploadVideo(@Res() res: Response) {
    // Also refuse when mounted without the early body-admission tombstone.
    res.status(404).json({ error: retiredUploadMessage });
  }
}
