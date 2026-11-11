/** Частичная правка поста сохраняется вместе с изменениями медиа и проверкой ожидаемой ревизии. */
import { eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  posts,
  postMedia,
  type InsertPost,
} from "../../../../packages/database/src/schema";
import type { PostPublication } from "./publication";
import { replacePostVideoRows } from "./post-videos";
import { resolveVkPostPosters } from "./vk-post-posters";
import {
  savePostAttachments,
  type PostAttachmentChanges,
} from "./post-attachments";
import { TRPCError } from "@trpc/server";
import { authorizePrivateAttachmentChanges } from "./private-attachment-association";
import { assertContentWriteActor } from "./content-write-actor";
import { bindContentFiles, postFileReferences } from "./private-content-binding";
import { assertPostHasBody } from "./post-body";
import { assertEditRevision, expectedEditRevision, postEditRevision, type ContentEditPrecondition } from "./content-edit-revision";

/** Save a normalized partial edit and optional videos as one committed change. */
/** Разрешаем обложки до SQL, затем под блокировками исполнителя, поста и медиа сверяем ревизию и атомарно сохраняем частичную правку с приватными привязками; уведомление возвращаем лишь для первого перехода в публикацию. */
export async function savePostEdit(
  database: MySql2Database,
  postId: number,
  data: Partial<InsertPost>,
  videos?: string[],
  attachments: PostAttachmentChanges = {},
  condition?: ContentEditPrecondition,
): Promise<PostPublication | undefined> {
  // Provider requests must finish before taking actor/post row locks.
  const posters = data.photos?.length ? new Map<string, string>() : await resolveVkPostPosters(videos ?? []);
  return database.transaction(async (tx) => {
    await assertContentWriteActor(tx,attachments.actor);
    const expectedRevision = expectedEditRevision(condition);
    await authorizePrivateAttachmentChanges(tx, attachments);
    const [post] = await tx
      .select()
      .from(posts)
      .where(eq(posts.id, postId))
      .for("update");
    if (!post) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Публикация не найдена",
      });
    }
    if (expectedRevision !== undefined) {
      // A locking child read stays current even if an earlier authorization read
      // established a REPEATABLE READ snapshot before the parent lock was acquired.
      const media = await tx.select().from(postMedia).where(eq(postMedia.postId, postId)).for("update");
      assertEditRevision(expectedRevision, postEditRevision(post, media));
    }

// Старые ссылки фиксируются до замены фото или постеров; после изменений привязки пересчитываются в той же транзакции.
    const filesChanged = data.photos !== undefined ||
      Boolean(attachments.privateVideoPosters?.length) || Boolean(attachments.removedMediaIds?.length);
    const previousFiles = filesChanged
      ? await postFileReferences(tx, postId, post.photos ?? []) : [];
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
    if (videos !== undefined) await replacePostVideoRows(tx, postId, videos,
      (data.photos ?? post.photos ?? []).length ? new Map() : posters);
    await savePostAttachments(tx, postId, attachments);
    if (filesChanged) await bindContentFiles(tx, "post", postId,
      await postFileReferences(tx, postId, data.photos ?? post.photos ?? []),
      previousFiles, attachments.actor);

// Непустое содержимое проверяется по итоговой версии, включая удаления и новые вложения, чтобы не сохранить пустой пост.
    const bodyChanged =
      data.text !== undefined ||
      data.photos !== undefined ||
      videos !== undefined ||
      Boolean(attachments.attachments?.length) ||
      Boolean(attachments.privateAssetIds?.length) ||
      Boolean(attachments.removedMediaIds?.length);
    if (bodyChanged)
      await assertPostHasBody(
        tx, postId, data.text ?? post.text, data.photos ?? post.photos ?? [],
      );

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
