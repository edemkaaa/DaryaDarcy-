import { and, eq, inArray, max } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { postMedia } from "../../../../packages/database/src/schema";
import { isRawMediaFilename } from "../../../../packages/shared/src/media-label";

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
      return (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password
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
export type PostAttachmentChanges = {
  attachments?: PostAttachmentInput[];
  removedMediaIds?: number[];
};
type AttachmentWriter = Pick<MySql2Database, "select" | "insert" | "delete">;

/** Caller holds the post lock; attachment changes share its save transaction. */
export async function savePostAttachments(
  writer: AttachmentWriter,
  postId: number,
  { attachments = [], removedMediaIds = [] }: PostAttachmentChanges,
): Promise<void> {
  const ids = [...new Set(removedMediaIds)];
  if (ids.length) {
    const rows = await writer
      .select({ id: postMedia.id })
      .from(postMedia)
      .where(
        and(
          eq(postMedia.postId, postId),
          inArray(postMedia.type, ["audio", "document"]),
          inArray(postMedia.id, ids),
        ),
      )
      .for("update");
    if (rows.length !== ids.length)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Вложение отсутствует или не принадлежит этой публикации. Обновите редактор.",
      });
    await writer
      .delete(postMedia)
      .where(and(eq(postMedia.postId, postId), inArray(postMedia.id, ids)));
  }
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
}
