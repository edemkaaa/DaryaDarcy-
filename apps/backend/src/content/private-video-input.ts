/** Граничная проверка метаданных закрытого видео и параметров восстановления его загрузки. */
import { z } from "zod";
import { privateUploadKey } from "./private-upload-key";

export const privateVideoMetadata = z
  .object({
    query: z
      .object({
        filename: z
          .string()
          .trim()
          .min(1)
          .max(512)
          .refine((value) => !/[\x00-\x1f\x7f]/.test(value)),
      })
      .strict(),
    idempotencyKey: privateUploadKey,
    mimeType: z.string().min(1).max(128),
  })
  .strict();
export const privateVideoUploadEnabled = () =>
  process.env.PRIVATE_POST_MEDIA_UPLOAD_ENABLED === "true" &&
  process.env.PRIVATE_POST_VIDEO_UPLOAD_ENABLED === "true";
