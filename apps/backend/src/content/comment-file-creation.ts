/** Связываем создание комментария и квитанции его закрытых фото в одной операции. */
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { commentCreationRequests, postComments } from "../../../../packages/database/src/schema";
import type { ContentTransaction } from "./post-deletion";
import type { ContentWriteActor } from "./content-write-actor";
import { digest } from "../media/private-upload-object";
import { assertContentRecoveryWindow } from "./recovery-window";

export async function requireCommentFileSchema(tx: Pick<ContentTransaction, "select" | "execute">) {
  await tx.select().from(commentCreationRequests).limit(0);
  const [indexes] = await tx.execute(sql`SELECT s.COLUMN_NAME AS name,s.SUB_PART AS prefix,t.ENGINE AS engine FROM information_schema.STATISTICS s
    JOIN information_schema.TABLES t ON t.TABLE_SCHEMA=s.TABLE_SCHEMA AND t.TABLE_NAME=s.TABLE_NAME
    WHERE s.TABLE_SCHEMA=DATABASE() AND s.TABLE_NAME='comment_creation_requests' AND s.INDEX_NAME='PRIMARY' AND s.NON_UNIQUE=0`);
  if (!Array.isArray(indexes) || indexes.length !== 1 || indexes[0].name !== "requestKey" || indexes[0].prefix !== null || indexes[0].engine !== "InnoDB") throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
}
/** Фиксируем ключ создания комментария и его файлы как одно принятое намерение. */
export async function claimCommentFileCreation(tx: ContentTransaction, actor: ContentWriteActor,
  data: { postId: number; text: string; parentId?: number | null; photos: string[]; idempotencyKey?: string }) {
  if (!data.idempotencyKey) throw new TRPCError({ code: "BAD_REQUEST", message: "Для закрытых фото нужен ключ создания комментария" });
  await requireCommentFileSchema(tx);
  const requestKey = digest(JSON.stringify(["private.comment.create:v1", actor.id, data.idempotencyKey]));
  const payloadHash = digest(JSON.stringify([data.postId, data.text, data.parentId ?? null, data.photos]));
  const claimToken = randomUUID();
  await tx.insert(commentCreationRequests).values({ requestKey, actorUserId: actor.id, payloadHash, claimToken })
    .onDuplicateKeyUpdate({ set: { requestKey: sql`${commentCreationRequests.requestKey}` } });
  const [row] = await tx.select().from(commentCreationRequests).where(eq(commentCreationRequests.requestKey, requestKey)).for("update");
  if (!row || row.actorUserId !== actor.id || row.payloadHash !== payloadHash) throw new TRPCError({ code: "CONFLICT" });
  assertContentRecoveryWindow(row.createdAt);
  if (row.commentId !== null) {
    const [comment] = await tx.select().from(postComments).where(eq(postComments.id, row.commentId)).for("share");
    if (!comment || comment.userId !== actor.id || comment.postId !== data.postId) throw new TRPCError({ code: "CONFLICT", message: "Комментарий удалён или недоступен" });
    return { requestKey, commentId: comment.id };
  }
  if (row.claimToken !== claimToken) throw new TRPCError({ code: "SERVICE_UNAVAILABLE" });
  return { requestKey, commentId: null };
}
