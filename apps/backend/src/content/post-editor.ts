import { eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  posts,
  type InsertPost,
} from "../../../../packages/database/src/schema";
import type { PostPublication } from "./publication";
import { replacePostVideoRows } from "./post-videos";
import {
  savePostAttachments,
  type PostAttachmentChanges,
} from "./post-attachments";
import { TRPCError } from "@trpc/server";
import { authorizePrivateAttachmentChanges } from "./private-attachment-association";
import { assertContentWriteActor } from "./content-write-actor";

/** Save a normalized partial edit and optional videos as one committed change. */
export async function savePostEdit(
  database: MySql2Database,
  postId: number,
  data: Partial<InsertPost>,
  videos?: string[],
  attachments: PostAttachmentChanges = {},
): Promise<PostPublication | undefined> {
  return database.transaction(async (tx) => {
    await assertContentWriteActor(tx,attachments.actor);
    await authorizePrivateAttachmentChanges(tx, attachments);
    const [post] = await tx
      .select({
        id: posts.id,
        text: posts.text,
        target: posts.target,
        status: posts.status,
        published: posts.published,
        publishedAt: posts.publishedAt,
      })
      .from(posts)
      .where(eq(posts.id, postId))
      .for("update");
    if (!post) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Публикация не найдена",
      });
    }

    const updateData = { ...data };
    if (data.status !== undefined)
      updateData.published = data.status === "published";
    if (
      data.status === "published" &&
      data.publishedAt === undefined &&
      !post.publishedAt
    )
      updateData.publishedAt = new Date();
    if (Object.values(updateData).some((value) => value !== undefined))
      await tx.update(posts).set(updateData).where(eq(posts.id, postId));
    if (videos !== undefined) await replacePostVideoRows(tx, postId, videos);
    await savePostAttachments(tx, postId, attachments);

    // The locked previous visibility picks one owner, shared with manual/timed
    // publication. Plain corrections and legacy flag-only edits are not a push.
    if (
      data.status !== "published" ||
      (post.status === "published" && post.published)
    )
      return undefined;
    return {
      id: post.id,
      text: data.text ?? post.text,
      target: data.target ?? post.target,
    };
  });
}
