/** Создание поста и медиа с журналом операции; повтор исходного ключа восстанавливает сохранённый результат. */
import type { MySql2Database } from "drizzle-orm/mysql2";
import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  posts,
  postCreationRequests,
  type InsertPost,
} from "../../../../packages/database/src/schema";
import { replacePostVideoRows } from "./post-videos";
import { resolveVkPostPosters } from "./vk-post-posters";
import {
  savePostAttachments,
  type PostAttachmentChanges,
} from "./post-attachments";
import type { PostCreationIntent } from "./post-creation-request";
import { authorizePrivateAttachmentChanges } from "./private-attachment-association";
import { assertContentRecoveryWindow } from "./recovery-window";
import { assertContentRecoveryNotSpent } from "./recovery-markers";
import { assertContentWriteActor } from "./content-write-actor";
import { assertPostHasBody } from "./post-body";
import { bindContentFiles, hasPrivateContent, postPhotoReferences, postFileReferences } from "./private-content-binding";

/** В общей транзакции создаём пост, видео, вложения и приватные привязки, затем проверяем непустое итоговое содержимое; ID нельзя возвращать до коммита вызывающей транзакции. */
async function insertPost(
  writer: Pick<MySql2Database, "insert" | "delete" | "select" | "update" | "execute">,
  data: InsertPost,
  videos: string[],
  attachments: PostAttachmentChanges,
  posters: ReadonlyMap<string, string>,
): Promise<number> {
  const [result] = await writer.insert(posts).values(data);
  const postId = Number(result.insertId);
  if (videos.length > 0) await replacePostVideoRows(writer, postId, videos, posters);
  await savePostAttachments(writer, postId, attachments);
  await bindContentFiles(writer, "post", postId, await postFileReferences(writer, postId, data.photos ?? []), [], attachments.actor);
  await assertPostHasBody(writer, postId, data.text, data.photos ?? []);
  return postId;
}

/** Return the new ID only after the post and its initial videos have committed. */
/** Совместимый путь создания разрешает приватные вложения по квитанциям, но для новых приватных фото требует идемпотентный контракт; обложки VK разрешаются до SQL-блокировок. */
export async function createPostWithVideos(
  database: MySql2Database,
  data: InsertPost,
  videos: string[],
  attachments: PostAttachmentChanges = {},
): Promise<number> {
  if (hasPrivateContent(postPhotoReferences(data.photos ?? []))) throw new TRPCError({ code: "BAD_REQUEST", message: "Для новых закрытых фото нужен ключ создания" });
  const posters = data.photos?.length ? new Map<string, string>() : await resolveVkPostPosters(videos);
  return database.transaction(async (tx) => {
    await assertContentWriteActor(tx,attachments.actor);
    await authorizePrivateAttachmentChanges(tx, attachments);
    return insertPost(tx, data, videos, attachments, posters);
  });
}

/** Один ключ принятого намерения восстанавливает прежний результат, вместо создания дубля. */
/** Под блокировкой исполнителя захватываем уникальный ключ намерения, проверяем окно восстановления и отпечаток; пост и его результат коммитятся вместе, поэтому повтор не создаёт дубль. */
export async function createPostOnce(
  database: MySql2Database,
  data: InsertPost,
  videos: string[],
  attachments: PostAttachmentChanges,
  intent: PostCreationIntent,
): Promise<{ postId: number; created: boolean }> {
  const posters = data.photos?.length ? new Map<string, string>() : await resolveVkPostPosters(videos);
  return database.transaction(async (tx) => {
    await assertContentWriteActor(tx,attachments.actor);
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
    await assertContentRecoveryNotSpent(
      tx,
      "post",
      [intent.requestKey],
      intent.actorUserId,
    );
    if (
      request.actorUserId !== intent.actorUserId ||
      request.payloadHash !== intent.payloadHash
    )
      throw new TRPCError({
        code: "CONFLICT",
        message: "Ключ запроса уже использован для другого содержимого",
      });
    assertContentRecoveryWindow(request.createdAt);
    if (request.postId !== null)
      return { postId: request.postId, created: false };
    const postId = await insertPost(tx, data, videos, attachments, posters);
    await tx
      .update(postCreationRequests)
      .set({ postId })
      .where(eq(postCreationRequests.requestKey, intent.requestKey));
    return { postId, created: true };
  });
}
