import { Injectable } from "@nestjs/common";
import { isRawMediaFilename } from "../../../../packages/shared/src/media-label";
import { createPostMedia } from "../db";
import { uploadPhoto } from "../media/photos";
import { storagePut } from "../storage";
import type { MediaUploadInput } from "./media-upload-input";

/** The adapter authorizes/validates; storage and SQL helpers retain their ownership. */
@Injectable()
export class ContentUploadService {
  uploadPhoto(base64: string): Promise<{ url: string }> {
    return uploadPhoto(base64, "feed/photos");
  }

  async uploadMedia(input: MediaUploadInput) {
    const buffer = Buffer.from(input.base64, "base64");
    const folder =
      input.type === "video"
        ? "videos"
        : input.type === "audio"
          ? "audio"
          : "documents";
    const safeName = isRawMediaFilename(input.filename)
      ? `${input.type}-${Date.now()}`
      : input.filename;
    const storedName = isRawMediaFilename(input.filename)
      ? null
      : input.filename;
    const key = `feed/${folder}/${Date.now()}_${safeName}`;
    const result = await storagePut(key, buffer, input.mimeType);

    // Preserve legacy attachment ordering: storage succeeds before SQL association.
    // This is not an atomic storage/DB write; orphan-object cleanup remains separate.
    let mediaId: number | undefined;
    if (input.postId) {
      mediaId = await createPostMedia({
        postId: input.postId,
        type: input.type,
        url: result.url,
        filename: storedName,
        mimeType: input.mimeType,
        fileSize: buffer.length,
        duration: input.duration ?? null,
        sortOrder: 0,
      });
    }
    return { url: result.url, mediaId };
  }
}
