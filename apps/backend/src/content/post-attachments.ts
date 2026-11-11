/** Сохраняем изменение списка вложений под правилами родительского поста. */
import { and, eq, inArray, max } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { postMedia, privateAttachmentUploads } from "../../../../packages/database/src/schema";
import { isRawMediaFilename } from "../../../../packages/shared/src/media-label";
import { bindPrivateAttachments, privateMediaUrl, type PrivateAttachmentChanges } from "./private-attachment-association";
import { privateStorageNamespace } from "../media/private-upload-object";

// Administrators may attach uploaded public media, as with existing photos/videos.
// These URLs are stored, never fetched by the server. Do not accept executable URLs.
export const postAttachmentInput = z.object({
  type: z.enum(["audio", "document"]),
  url: z
    .string()
    .max(2048)
    .url()
    .refine((value) => {
      const url = new URL(value);
      let reserved = false;
      try { reserved = /\/feed\/(audio|documents)\/private-v1\//.test(decodeURIComponent(url.pathname)); } catch { /* Legacy URL validation remains unchanged. */ }
      return (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password && !reserved
      );
    }),
  filename: z.string().min(1).max(512),
  mimeType: z.string().min(1).max(128),
  fileSize: z
    .number()
    .int()
    .min(0)
    .max(32 * 1024 * 1024),
});
export type PostAttachmentInput = z.infer<typeof postAttachmentInput>;
export type PostAttachmentChanges = PrivateAttachmentChanges & {
  attachments?: PostAttachmentInput[];
  removedMediaIds?: number[];
  /** Internal compatibility path only, never accepted from the editor schema. */
  allowLegacyVideoRemoval?: boolean;
};
type AttachmentWriter = Pick<MySql2Database, "select" | "insert" | "delete" | "update" | "execute">;

/** Caller holds the post lock; attachment changes share its save transaction. */
/** В транзакции заблокированного поста проверяем принадлежность удаляемых вложений и квитанции приватных видео, дописываем новые аудио/документы по порядку и связываем готовые приватные assetId. */
export async function savePostAttachments(
  writer: AttachmentWriter,
  postId: number,
  changes: PostAttachmentChanges,
): Promise<void> {
  const { attachments = [], removedMediaIds = [] } = changes;
  const ids = [...new Set(removedMediaIds)];
// Удаление проверяется по полному набору уникальных ID: чужое, отсутствующее или неоднозначное старое видео отклоняет всю правку.
  if (ids.length) {
    const rows = await writer
      .select({ id: postMedia.id, type: postMedia.type, url: postMedia.url })
      .from(postMedia)
      .where(
        and(
          eq(postMedia.postId, postId),
          inArray(postMedia.id, ids),
        ),
      )
      .for("update");
    const videos = rows.filter(row => row.type === "video" && row.url === privateMediaUrl(row.id));
    const legacyVideo = rows.some(row => row.type === "video" && row.url !== privateMediaUrl(row.id));
    const receipts = videos.length
      ? await writer.select().from(privateAttachmentUploads)
          .where(inArray(privateAttachmentUploads.mediaId, videos.map(row => row.id)))
          .for("update")
      : [];
    const byMediaId = new Map(receipts.map(asset => [asset.mediaId, asset]));
    const namespace = videos.length ? privateStorageNamespace().hash : undefined;
    const invalidVideo = videos.some(video => {
      const asset = byMediaId.get(video.id);
      return video.url !== privateMediaUrl(video.id) || !asset ||
        asset.postId !== postId || asset.type !== "video" ||
        asset.state !== "ready" || !asset.etag || asset.namespaceHash !== namespace;
    });
    if (rows.length !== ids.length || (legacyVideo && !changes.allowLegacyVideoRemoval) || invalidVideo)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Вложение отсутствует или не принадлежит этой публикации. Обновите редактор.",
      });
    await writer
      .delete(postMedia)
      .where(and(eq(postMedia.postId, postId), inArray(postMedia.id, ids)));
  }
// Публичные URL здесь лишь сохраняются, сервер их не скачивает; новый sortOrder начинается после текущего максимума.
  if (attachments.length) {
    const [last] = await writer
      .select({ order: max(postMedia.sortOrder) })
      .from(postMedia)
      .where(eq(postMedia.postId, postId));
    await writer.insert(postMedia).values(
      attachments.map((attachment, index) => ({
        ...attachment,
        filename: isRawMediaFilename(attachment.filename)
          ? null
          : attachment.filename,
        postId,
        sortOrder: (last?.order ?? -1) + index + 1,
      })),
    );
  }
  if (changes.privateAssetIds?.length)
    await bindPrivateAttachments(writer, postId, changes);
}
