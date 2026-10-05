import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { isRawMediaFilename } from "../../../../packages/shared/src/media-label";
import { createPostMedia } from "../db";
import { uploadPhoto } from "../media/photos";
import { decodeMediaBase64 } from "../media/media-encoding";
import { storagePut } from "../storage";
import type { MediaUploadInput } from "./media-upload-input";
import { normalizeMediaContentType } from "./media-content-type";

/** The adapter authorizes/validates; storage and SQL helpers retain their ownership. */
@Injectable()
export class ContentUploadService {
  uploadPhoto(base64: string): Promise<{ url: string }> {
    return uploadPhoto(base64, "feed/photos");
  }

  async uploadMedia(input: MediaUploadInput) {
    const mimeType = normalizeMediaContentType(input.type, input.mimeType);
    const buffer = decodeMediaBase64(input.base64);
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
    // Human filenames stay in display metadata; this is not MIME/format detection.
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
    return { url: result.url, mediaId };
  }
}
