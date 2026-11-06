import { Controller, HttpCode, Inject, Post, Req, Res } from "@nestjs/common";
import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import type { Request, Response } from "express";
import { SessionService } from "../identity/session.service";
import { releaseVideoUpload } from "../_core/video-upload-admission";
import {
  normalizeMediaContentType,
  resolveMediaContentType,
} from "./media-content-type";
import { storePrivateAttachment } from "./private-attachment-uploads";
import {
  privateVideoMetadata,
  privateVideoUploadEnabled,
} from "./private-video-input";

@Controller("api/admin")
export class PrivateVideoUploadController {
  constructor(
    @Inject(SessionService) private readonly identity: SessionService,
  ) {}

  @Post("private-video-uploads")
  @HttpCode(200)
  async upload(@Req() req: Request, @Res() res: Response) {
    res.setHeader("Cache-Control", "no-store");
    const controller = new AbortController();
    // Тело уже прочитано raw-парсером: req.close здесь не означает отмену.
    // Прерываем S3 только при незавершённом ответе клиенту.
    const disconnect = () => {
      if (!res.writableFinished) controller.abort();
    };
    res.once("close", disconnect);
    if (res.destroyed) disconnect();
    try {
      controller.signal.throwIfAborted();
      if (!privateVideoUploadEnabled())
        throw new TRPCError({ code: "NOT_FOUND" });
      const actor = await this.identity.optionalUser(req);
      if (!actor) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      if (!this.identity.isAdministrator(actor))
        throw new TRPCError({ code: "FORBIDDEN" });
      const parsed = privateVideoMetadata.safeParse({
        query: req.query,
        idempotencyKey: req.headers["idempotency-key"],
        mimeType: req.headers["content-type"] ?? "application/octet-stream",
      });
      if (!parsed.success || !Buffer.isBuffer(req.body) || !req.body.length)
        throw new TRPCError({ code: "BAD_REQUEST" });
      if (req.body.length > 80 * 1024 * 1024)
        throw new TRPCError({ code: "PAYLOAD_TOO_LARGE" });
      const declared = normalizeMediaContentType("video", parsed.data.mimeType);
      const mimeType = await resolveMediaContentType(
        "video",
        declared,
        req.body,
      );
      if (
        !["video/mp4", "video/webm", "video/quicktime"].includes(
          mimeType.split(";")[0],
        )
      )
        throw new TRPCError({ code: "BAD_REQUEST" });
      const receipt = await storePrivateAttachment(
        actor,
        {
          idempotencyKey: parsed.data.idempotencyKey,
          filename: parsed.data.query.filename,
          type: "video",
          mimeType,
        },
        req.body,
        controller.signal,
      );
      if (!res.destroyed && !controller.signal.aborted) res.json(receipt);
    } catch (error) {
      const known =
        error instanceof TRPCError
          ? error
          : new TRPCError({ code: "SERVICE_UNAVAILABLE" });
      if (!res.destroyed && !controller.signal.aborted)
        res
          .status(getHTTPStatusCodeFromError(known))
          .json({ error: known.code });
    } finally {
      res.off("close", disconnect);
      // Слот освобождаем после завершения работы, включая отмену S3.
      // Само закрытие сокета ещё не гарантирует освобождения тела загрузки.
      releaseVideoUpload(req);
    }
  }
}
