/** Сервис загрузок связывает административный API с проверкой файлов и существующими хранилищами. */
import { Injectable } from "@nestjs/common";
import { TRPCError } from "@trpc/server";
import { uploadPhoto } from "../media/photos";
import { rejectLegacyUpload } from "../media/legacy-upload-policy";
import type { MediaUploadInput } from "./media-upload-input";
import { blockedVideoPageReason, isOurStorageUrl } from "./video-import-policy";
import { getUserById } from "../db";
import type { User } from "../../../../packages/database/src/schema";

/** The adapter authorizes; storage and SQL helpers retain their ownership. */
@Injectable()
export class ContentUploadService {
  /** Сохраняет старый вызов как явный отказ legacy-загрузки, не создавая новый публичный видеообъект. */
  async uploadRawVideo(
    _buffer: Buffer,
    _filename: string,
    _contentType: string,
  ): Promise<{ url: string }> {
    return rejectLegacyUpload();
  }

  /**
   * Retains a link without fetching/inspecting/copying its object. Keep optional
   * fileSize in the existing wire type; retaining a URL does not report its size.
   */
  /** Сохраняет только ссылку собственного storage без fetch/копирования/проверки размера; внешние share/provider адреса отклоняет для исключения SSRF. */
  async importVideoFromUrl(
    url: string,
  ): Promise<{ url: string; fileSize?: number }> {
    const trimmed = url.trim();
    const blocked = blockedVideoPageReason(trimmed);
    if (blocked) throw new TRPCError({ code: "BAD_REQUEST", message: blocked });
    if (isOurStorageUrl(trimmed)) return { url: trimmed };
    // Do not fetch user-controlled URLs: redirects/DNS can reach internal services.
    // Upload local files instead; provider embeds are a separate publishing path.
    throw new TRPCError({
      code: "BAD_REQUEST",
      message:
        "Импорт с внешнего адреса отключён. Загрузите видео файлом или выберите файл из своего хранилища.",
    });
  }

  /** Разрешает лишь явную publicCover, перед PUT повторно проверяет текущие session/openId/admin/deletion после декодирования фото. */
  uploadPhoto(
    base64: string,
    purpose: "publicCover",
    actor: Pick<User, "id" | "openId" | "sessionVersion">,
    signal?: AbortSignal,
  ): Promise<{ url: string }> {
    if (purpose !== "publicCover")
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Укажите назначение публичной обложки",
      });
    return uploadPhoto(base64, "covers", signal, async () => {
      // Декодирование занимает время. Сверяем сессию и роль перед публичной записью.
      const current = await getUserById(actor.id);
      if (
        !current ||
        current.openId !== actor.openId ||
        current.sessionVersion !== actor.sessionVersion
      ) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }
      if (
        current.blockedAt ||
        current.accountDeletionRequestedAt ||
        current.role !== "admin"
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
    });
  }

  /** Отклоняет старую неоднозначную публичную media-загрузку; приватные вложения используют отдельные receipt-контракты. */
  async uploadMedia(_input: MediaUploadInput): Promise<{
    url: string;
    mediaId: number | undefined;
    mimeType: string;
    fileSize: number;
  }> {
    return rejectLegacyUpload();
  }
}
