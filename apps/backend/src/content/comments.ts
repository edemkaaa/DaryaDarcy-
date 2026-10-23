import { alias } from "drizzle-orm/mysql-core";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  commentLikes,
  commentReports,
  postComments,
  posts,
  users,
  commentCreationRequests,
  type PostComment,
} from "../../../../packages/database/src/schema";
import { getDb } from "../db";
import { bindContentFiles, hasPrivateContent, type ContentFileReference } from "./private-content-binding";
import { requireCommentFilePost } from "./private-comment-actor";
import { requirePrivateContentEnabled } from "./private-content-uploads";
import { claimCommentFileCreation } from "./comment-file-creation";
import type { ContentWriteActor } from "./content-write-actor";
import { requireContentDatabase } from "./read-database";

export type PostCommentRow = PostComment & {
  authorName: string | null;
  authorAvatarUrl: string | null;
  likeCount: number;
  likedByMe: boolean;
};

export async function commentLikeCounts(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  commentIds: number[],
) {
  if (commentIds.length === 0) return new Map<number, number>();
  const rows = await db
    .select({ commentId: commentLikes.commentId, likeCount: count() })
    .from(commentLikes)
    .where(inArray(commentLikes.commentId, commentIds))
    .groupBy(commentLikes.commentId);
  return new Map(rows.map((row) => [row.commentId, Number(row.likeCount)]));
}

export async function viewerLikedCommentIds(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  userId: number,
  commentIds: number[],
) {
  if (commentIds.length === 0) return new Set<number>();
  const rows = await db
    .select({ commentId: commentLikes.commentId })
    .from(commentLikes)
    .where(
      and(
        eq(commentLikes.userId, userId),
        inArray(commentLikes.commentId, commentIds),
      ),
    );
  return new Set(rows.map((row) => row.commentId));
}

export async function listPostCommentsV2(
  postId: number,
  viewerUserId?: number | null,
): Promise<PostCommentRow[]> {
  const db = await getDb();
  requireContentDatabase(db);
  const rows = await db
    .select({
      comment: postComments,
      authorName: users.name,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(postComments)
    .leftJoin(users, eq(users.id, postComments.userId))
    .where(eq(postComments.postId, postId))
    .orderBy(asc(postComments.createdAt));
  const commentIds = rows.map((row) => row.comment.id);
  const [likeCounts, likedSet] = await Promise.all([
    commentLikeCounts(db, commentIds),
    viewerUserId
      ? viewerLikedCommentIds(db, viewerUserId, commentIds)
      : Promise.resolve(new Set<number>()),
  ]);
  return rows.map((row) => ({
    ...row.comment,
    authorName: row.authorName ?? null,
    authorAvatarUrl: row.authorAvatarUrl ?? null,
    likeCount: likeCounts.get(row.comment.id) ?? 0,
    likedByMe: likedSet.has(row.comment.id),
  }));
}

export async function getPostCommentById(
  id: number,
): Promise<PostComment | null> {
  const db = await getDb();
  requireContentDatabase(db);
  const rows = await db
    .select()
    .from(postComments)
    .where(eq(postComments.id, id))
    .limit(1);
  return rows[0] ?? null;
}

type CommentWriteInput = {
  postId: number;
  userId: number;
  text: string;
  parentId?: number | null;
  photos?: string[];
  actor?: ContentWriteActor;
  idempotencyKey?: string;
};
export async function addPostCommentV2(data: CommentWriteInput): Promise<number> {
  return (await addPostCommentWithResult(data)).id;
}
export async function addPostCommentWithResult(data: CommentWriteInput): Promise<{ id: number; created: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const photos = (data.photos || []).slice(0, 2);
  const references: ContentFileReference[] = photos.map(url => ({ url, usage: "commentPhoto" }));
  const privatePhotos = hasPrivateContent(references);
  const recoverable = privatePhotos || data.idempotencyKey !== undefined;
  return db.transaction(async (tx) => {
    let intent: Awaited<ReturnType<typeof claimCommentFileCreation>> | undefined;
    if (recoverable) {
      requirePrivateContentEnabled();
      if (!data.actor || data.actor.id !== data.userId) throw new TRPCError({ code: "UNAUTHORIZED" });
      await requireCommentFilePost(tx, data.actor, data.postId);
      intent = await claimCommentFileCreation(tx, data.actor, { ...data, photos });
      if (intent.commentId !== null) return { id: intent.commentId, created: false };
    }
    const [post] = await tx
      .select({
        id: posts.id,
        published: posts.published,
        status: posts.status,
      })
      .from(posts)
      .where(eq(posts.id, data.postId))
      .for("share");
    if (!post || !post.published || post.status !== "published")
      throw new TRPCError({ code: "NOT_FOUND", message: "Пост не найден" });
    if (data.parentId != null) {
      const parent = await lockComment(tx, data.parentId);
      if (parent.postId !== data.postId)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ответ должен относиться к тому же посту",
        });
    }
    const result = await tx.insert(postComments).values({
      postId: data.postId,
      parentId: data.parentId ?? null,
      userId: data.userId,
      text: data.text,
      photos: photos.length ? photos : null,
    });
    const id = Number(result[0].insertId);
    if (recoverable) {
      if (privatePhotos) await bindContentFiles(tx, "comment", id, references, [], data.actor, data.postId);
      await tx.update(commentCreationRequests).set({ commentId: id }).where(eq(commentCreationRequests.requestKey, intent!.requestKey));
    }
    return { id, created: true };
  });
}

type CommentTransaction = Parameters<
  Parameters<NonNullable<Awaited<ReturnType<typeof getDb>>>["transaction"]>[0]
>[0];
async function lockComment(tx: CommentTransaction, id: number) {
  const [comment] = await tx
    .select()
    .from(postComments)
    .where(eq(postComments.id, id))
    .for("update");
  if (!comment)
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Комментарий не найден",
    });
  return comment;
}

export async function deletePostCommentV2(
  id: number,
  userId: number,
  asStaff = false,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction((tx) =>
    deletePostCommentInTransaction(tx, id, userId, asStaff),
  );
}

/** Reuse the locked cascade when a caller must commit additional effects atomically. */
export async function deletePostCommentInTransaction(
  tx: CommentTransaction,
  id: number,
  userId: number,
  asStaff = false,
): Promise<void> {
  const comment = await lockComment(tx, id);
  if (!asStaff && comment.userId !== userId)
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Можно удалить только свой комментарий",
    });
  await tx
    .update(postComments)
    .set({ parentId: null })
    .where(eq(postComments.parentId, id));
  await tx.delete(commentLikes).where(eq(commentLikes.commentId, id));
  await tx.delete(commentReports).where(eq(commentReports.commentId, id));
  await tx.delete(postComments).where(eq(postComments.id, id));
}

export async function updatePostCommentV2(
  id: number,
  userId: number,
  text: string,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    const comment = await lockComment(tx, id);
    if (comment.userId !== userId)
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Можно изменить только свой комментарий",
      });
    await tx.update(postComments).set({ text }).where(eq(postComments.id, id));
  });
}

export async function toggleCommentLike(
  userId: number,
  commentId: number,
): Promise<{ liked: boolean; likeCount: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async (tx) => {
    await lockComment(tx, commentId);
    const existing = await tx
      .select({ id: commentLikes.id })
      .from(commentLikes)
      .where(
        and(
          eq(commentLikes.userId, userId),
          eq(commentLikes.commentId, commentId),
        ),
      )
      .limit(1);
    if (existing.length > 0) {
      await tx
        .delete(commentLikes)
        .where(
          and(
            eq(commentLikes.userId, userId),
            eq(commentLikes.commentId, commentId),
          ),
        );
    } else {
      await tx.insert(commentLikes).values({ userId, commentId });
    }
    const countRows = await tx
      .select({ likeCount: count() })
      .from(commentLikes)
      .where(eq(commentLikes.commentId, commentId));
    return {
      liked: existing.length === 0,
      likeCount: Number(countRows[0]?.likeCount ?? 0),
    };
  });
}

export async function reportComment(
  commentId: number,
  reporterUserId: number,
  reason: string,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.transaction(async (tx) => {
    await lockComment(tx, commentId);
    await tx
      .insert(commentReports)
      .values({
        commentId,
        reporterUserId,
        reason: reason.slice(0, 512),
      })
      .onDuplicateKeyUpdate({ set: { reason: reason.slice(0, 512) } });
  });
}

export type CommentReportInboxRow = {
  id: number;
  commentId: number;
  reason: string;
  createdAt: Date;
  commentText: string;
  commentPhotos: string[] | null;
  postId: number;
  authorUserId: number;
  authorName: string | null;
  reporterUserId: number;
  reporterName: string | null;
};

export async function listCommentReports(
  limit = 100,
): Promise<CommentReportInboxRow[]> {
  const db = await getDb();
  requireContentDatabase(db);
  const author = alias(users, "comment_author");
  const reporter = alias(users, "comment_reporter");
  const rows = await db
    .select({
      id: commentReports.id,
      commentId: commentReports.commentId,
      reason: commentReports.reason,
      createdAt: commentReports.createdAt,
      commentText: postComments.text,
      commentPhotos: postComments.photos,
      postId: postComments.postId,
      authorUserId: postComments.userId,
      authorName: author.name,
      reporterUserId: commentReports.reporterUserId,
      reporterName: reporter.name,
    })
    .from(commentReports)
    .innerJoin(postComments, eq(postComments.id, commentReports.commentId))
    .leftJoin(author, eq(author.id, postComments.userId))
    .leftJoin(reporter, eq(reporter.id, commentReports.reporterUserId))
    .orderBy(desc(commentReports.createdAt))
    .limit(limit);
  return rows;
}

export async function dismissCommentReport(reportId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(commentReports).where(eq(commentReports.id, reportId));
}

export async function deleteCommentAndReports(
  commentId: number,
): Promise<void> {
  await deletePostCommentV2(commentId, 0, true);
}

/** One bounded batch per maintenance tick; retain a full 365 days. */
export async function purgeOldPostComments(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  return db.transaction(async (tx) => {
    const expired = await tx
      .select({ id: postComments.id })
      .from(postComments)
      .where(
        sql`${postComments.createdAt} < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 365 DAY)`,
      )
      .orderBy(asc(postComments.id))
      .limit(500)
      .for("update", { skipLocked: true });
    if (!expired.length) return 0;
    const ids = expired.map((row) => row.id);
    // Retain newer replies, but turn them into roots rather than orphaning them.
    await tx
      .update(postComments)
      .set({ parentId: null })
      .where(inArray(postComments.parentId, ids));
    await tx.delete(commentLikes).where(inArray(commentLikes.commentId, ids));
    await tx
      .delete(commentReports)
      .where(inArray(commentReports.commentId, ids));
    const result = await tx
      .delete(postComments)
      .where(inArray(postComments.id, ids));
    return Number(result[0]?.affectedRows ?? 0);
  });
}
