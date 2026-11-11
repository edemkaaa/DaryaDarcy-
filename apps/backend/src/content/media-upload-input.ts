/** Граничная схема загрузки медиа: согласуем поля запроса до обращения к хранилищу. */
import { z } from "zod";

// Preserve the existing upload wire contract; stronger media validation is separate.
export const mediaUploadInput = z.object({
  base64: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  type: z.enum(["video", "audio", "document"]),
  postId: z.number().optional(),
  duration: z.number().optional(),
});

export type MediaUploadInput = z.infer<typeof mediaUploadInput>;
