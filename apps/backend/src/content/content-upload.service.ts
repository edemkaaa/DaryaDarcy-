import { Injectable } from "@nestjs/common";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import { isRawMediaFilename } from "../../../../packages/shared/src/media-label";
import { createPostMedia } from "../db";
import { uploadPhoto } from "../media/photos";
import { decodeMediaBase64 } from "../media/media-encoding";
import { storagePut } from "../storage";
import type { MediaUploadInput } from "./media-upload-input";
import { blockedVideoPageReason, isOurStorageUrl } from "./video-import-policy";
import {
  normalizeMediaContentType,
  resolveMediaContentType,
} from "./media-content-type";

/** The adapter authorizes/validates; storage and SQL helpers retain their ownership. */
@Injectable()
export class ContentUploadService {
  /**
   * Retains a link without fetching/inspecting/copying its object. Keep optional
   * fileSize in the existing wire type; retaining a URL does not report its size.
   */
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

  uploadPhoto(base64: string): Promise<{ url: string }> {
    return uploadPhoto(base64, "feed/photos");
  }

  async uploadMedia(input: MediaUploadInput) {
    const declaredMime = normalizeMediaContentType(input.type, input.mimeType);
    const buffer = decodeMediaBase64(input.base64);
    const mimeType = await resolveMediaContentType(
      input.type,
      declaredMime,
      buffer,
    );
    const folder =
      input.type === "video"
        ? "videos"
        : input.type === "audio"
          ? "audio"
          : "documents";
    const storedName = isRawMediaFilename(input.filename)
      ? null
      : input.filename;
    // Object identity is independent of client paths, extensions and clock precision.
    // Human filenames stay in display metadata; extensions do not select MIME.
    const key = `feed/${folder}/${randomUUID()}`;
    const result = await storagePut(key, buffer, mimeType);

    // Preserve legacy attachment ordering: storage succeeds before SQL association.
    // This is not an atomic storage/DB write; orphan-object cleanup remains separate.
    let mediaId: number | undefined;
    if (input.postId) {
      mediaId = await createPostMedia({
        postId: input.postId,
        type: input.type,
        url: result.url,
        filename: storedName,
        mimeType,
        fileSize: buffer.length,
        duration: input.duration ?? null,
        sortOrder: 0,
      });
    }
    // Standalone editor uploads need the same canonical metadata as SQL associations.
    return { url: result.url, mediaId, mimeType, fileSize: buffer.length };
  }
}
