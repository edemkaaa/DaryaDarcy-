import { Controller, HttpCode, Inject, Post, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { SessionService } from "../identity/session.service";
import {
  ContentUploadService,
  InvalidVideoFileError,
} from "./content-upload.service";

const MAX_VIDEO_BYTES = 80 * 1024 * 1024;

@Controller("api/admin")
export class VideoUploadController {
  constructor(
    @Inject(ContentUploadService)
    private readonly uploads: ContentUploadService,
    @Inject(SessionService) private readonly identity: SessionService,
  ) {}

  @Post("upload-video")
  @HttpCode(200)
  async uploadVideo(@Req() req: Request, @Res() res: Response) {
    try {
      // Middleware admits before allocating the body; recheck live access now.
      let user;
      try {
        user = await this.identity.authenticateRequest(req);
      } catch {
        res.status(401).json({ error: "Нужно войти" });
        return;
      }
      if (!this.identity.isAdministrator(user)) {
        res.status(403).json({ error: "Только для администратора" });
        return;
      }
      const body = req.body;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        res.status(400).json({ error: "Пустой файл" });
        return;
      }
      if (body.length > MAX_VIDEO_BYTES) {
        res.status(413).json({
          error:
            "Видео больше 80 МБ. Сожмите ролик или загрузите более короткий файл.",
        });
        return;
      }
      const filename =
        typeof req.query.filename === "string"
          ? req.query.filename
          : "video.mp4";
      const result = await this.uploads.uploadRawVideo(
        body,
        filename,
        req.headers["content-type"] ?? "video/mp4",
      );
      res.json(result);
    } catch (error) {
      if (error instanceof InvalidVideoFileError) {
        res.status(400).json({ error: "Некорректный видеофайл" });
        return;
      }
      console.error("[admin-video] upload failed");
      res.status(500).json({ error: "Не удалось загрузить видео" });
    }
  }
}
