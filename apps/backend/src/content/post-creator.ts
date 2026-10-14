import type { MySql2Database } from "drizzle-orm/mysql2";
import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  posts,
  postCreationRequests,
  type InsertPost,
} from "../../../../packages/database/src/schema";
import { replacePostVideoRows } from "./post-videos";
import {
  savePostAttachments,
  type PostAttachmentChanges,
} from "./post-attachments";
import type { PostCreationIntent } from "./post-creation-request";
import { authorizePrivateAttachmentChanges } from "./private-attachment-association";

async function insertPost(
  writer: Pick<MySql2Database, "insert" | "delete" | "select" | "update">,
  data: InsertPost,
  videos: string[],
  attachments: PostAttachmentChanges,
): Promise<number> {
  const [result] = await writer.insert(posts).values(data);
  const postId = Number(result.insertId);
  if (videos.length > 0) await replacePostVideoRows(writer, postId, videos);
  await savePostAttachments(writer, postId, attachments);
  return postId;
}

/** Return the new ID only after the post and its initial videos have committed. */
export async function createPostWithVideos(
  database: MySql2Database,
  data: InsertPost,
  videos: string[],
  attachments: PostAttachmentChanges = {},
): Promise<number> {
  return database.transaction(async (tx) => {
    await authorizePrivateAttachmentChanges(tx, attachments);
    return insertPost(tx, data, videos, attachments);
  });
}

export async function createPostOnce(
  database: MySql2Database,
  data: InsertPost,
  videos: string[],
  attachments: PostAttachmentChanges,
  intent: PostCreationIntent,
): Promise<{ postId: number; created: boolean }> {
  return database.transaction(async (tx) => {
    await authorizePrivateAttachmentChanges(tx, attachments);
    // Unique upsert acquires an exclusive key lock; never SELECT-then-INSERT.
    // Keep the winning payload/result unchanged on a concurrent duplicate.
    await tx
      .insert(postCreationRequests)
      .values(intent)
      .onDuplicateKeyUpdate({
        set: { requestKey: sql`${postCreationRequests.requestKey}` },
      });
    const [request] = await tx
      .select()
      .from(postCreationRequests)
      .where(eq(postCreationRequests.requestKey, intent.requestKey))
      .for("update");
    if (
      request.actorUserId !== intent.actorUserId ||
      request.payloadHash !== intent.payloadHash
    )
      throw new TRPCError({
        code: "CONFLICT",
        message: "Ключ запроса уже использован для другого содержимого",
      });
    if (request.postId !== null)
      return { postId: request.postId, created: false };
    const postId = await insertPost(tx, data, videos, attachments);
    await tx
      .update(postCreationRequests)
      .set({ postId })
      .where(eq(postCreationRequests.requestKey, intent.requestKey));
    return { postId, created: true };
  });
}
