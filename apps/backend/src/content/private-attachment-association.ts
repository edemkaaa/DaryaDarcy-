import { asc, eq, inArray, max } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  privateAttachmentUploads,
  postMedia,
  posts,
} from "../../../../packages/database/src/schema";
import {
  privateAttachmentObjectKey,
  privateStorageNamespace,
} from "../media/private-upload-object";
import { isRawMediaFilename } from "../../../../packages/shared/src/media-label";
import { assertContentRecoveryWindow } from "./recovery-window";
import { assertContentRecoveryNotSpent } from "./recovery-markers";
import { contentFileUrl } from "./private-content-uploads";
import {
  lockPrivateAttachmentActor,
  requirePrivateAttachmentSchema,
  requirePrivateUploadEnabled,
  type PrivateAttachmentActor,
  type PrivateAttachmentTransaction,
} from "./private-attachment-uploads";

export type PrivateAttachmentChanges = {
  privateAssetIds?: string[];
  privateVideoPosters?: { videoAssetId: string; posterAssetId: string }[];
  actor?: PrivateAttachmentActor;
};
export const privateMediaUrl = (id: number) =>
  `/api/media/post-attachments/${id}`;
const conflict = () =>
  new TRPCError({
    code: "CONFLICT",
    message: "Вложение недоступно для привязки. Обновите редактор.",
  });

/** Lock actor before post/intent/asset locks. Legacy saves have no new dependency. */
export async function authorizePrivateAttachmentChanges(
  tx: PrivateAttachmentTransaction,
  changes: PrivateAttachmentChanges,
) {
  const posters = changes.privateVideoPosters ?? [];
  if (
    new Set(posters.map((row) => row.videoAssetId)).size !== posters.length ||
    new Set(posters.map((row) => row.posterAssetId)).size !== posters.length ||
    posters.some((row) => !changes.privateAssetIds?.includes(row.videoAssetId))
  )
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Постер требует явного закрытого видео",
    });
  if (!changes.privateAssetIds?.length) return;
  requirePrivateUploadEnabled();
  if (!changes.actor) throw new TRPCError({ code: "UNAUTHORIZED" });
  await lockPrivateAttachmentActor(tx, changes.actor);
  await requirePrivateAttachmentSchema(tx);
}
/** Called under the post lock in its save transaction; never touches storage. */
export async function bindPrivateAttachments(
  tx: Pick<MySql2Database, "select" | "insert" | "update" | "execute">,
  postId: number,
  changes: PrivateAttachmentChanges,
) {
  const ids = changes.privateAssetIds ?? [];
  if (!ids.length) return;
  if (!changes.actor || new Set(ids).size !== ids.length) throw conflict();
  const assets = await tx
    .select()
    .from(privateAttachmentUploads)
    .where(inArray(privateAttachmentUploads.assetId, ids))
    .orderBy(asc(privateAttachmentUploads.assetId))
    .for("update");
  if (assets.length !== ids.length) throw conflict();
  const namespace = privateStorageNamespace();
  const posters = new Map(
    (changes.privateVideoPosters ?? []).map((row) => [
      row.videoAssetId,
      contentFileUrl(row.posterAssetId),
    ]),
  );
  for (const asset of assets) {
    if (posters.has(asset.assetId) && asset.type !== "video")
      throw new TRPCError({ code: "BAD_REQUEST" });
    if (
      asset.actorUserId !== changes.actor.id ||
      asset.state !== "ready" ||
      !asset.etag ||
      asset.namespaceHash !== namespace.hash
    )
      throw conflict();
    if (asset.postId === null && asset.mediaId === null)
      assertContentRecoveryWindow(asset.createdAt);
    if (asset.postId !== null || asset.mediaId !== null) {
      if (asset.postId !== postId || asset.mediaId === null) throw conflict();
      const [media] = await tx
        .select()
        .from(postMedia)
        .where(eq(postMedia.id, asset.mediaId))
        .for("update");
      if (
        !media ||
        media.postId !== postId ||
        media.url !== privateMediaUrl(media.id)
      )
        throw conflict();
    }
  }
  await assertContentRecoveryNotSpent(
    tx,
    "private_attachment",
    assets
      .filter((asset) => asset.postId === null && asset.mediaId === null)
      .map((asset) => asset.requestKey),
    changes.actor.id,
  );
  const [last] = await tx
    .select({ order: max(postMedia.sortOrder) })
    .from(postMedia)
    .where(eq(postMedia.postId, postId));
  let sortOrder = (last?.order ?? -1) + 1;
  for (const id of ids) {
    const asset = assets.find((row) => row.assetId === id)!;
    const posterUrl = posters.get(id);
    if (asset.mediaId !== null) {
      if (posterUrl !== undefined)
        await tx
          .update(postMedia)
          .set({ posterUrl })
          .where(eq(postMedia.id, asset.mediaId));
      continue;
    }
    const [result] = await tx.insert(postMedia).values({
      postId,
      type: asset.type,
      url: `private-asset:${asset.assetId}`,
      filename: isRawMediaFilename(asset.filename) ? null : asset.filename,
      mimeType: asset.mimeType,
      fileSize: asset.fileSize,
      posterUrl,
      sortOrder: sortOrder++,
    });
    const mediaId = Number(result.insertId);
    await tx
      .update(postMedia)
      .set({ url: privateMediaUrl(mediaId) })
      .where(eq(postMedia.id, mediaId));
    await tx
      .update(privateAttachmentUploads)
      .set({ postId, mediaId })
      .where(eq(privateAttachmentUploads.requestKey, asset.requestKey));
  }
  // Preserve the existing automatic video category for canonical uploads too.
  if (assets.some((asset) => asset.type === "video")) {
    const [post] = await tx
      .select({ tags: posts.tags })
      .from(posts)
      .where(eq(posts.id, postId));
    if (post && !post.tags.includes("video"))
      await tx
        .update(posts)
        .set({ tags: [...post.tags, "video"] })
        .where(eq(posts.id, postId));
  }
}

/** Internal media URL resolves only through a matching committed receipt. */
export async function privateReceiptForMedia(
  reader: Pick<PrivateAttachmentTransaction, "select">,
  media: { id: number; postId: number; type: string },
) {
  const [asset] = await reader
    .select()
    .from(privateAttachmentUploads)
    .where(eq(privateAttachmentUploads.mediaId, media.id))
    .limit(1);
  if (
    !asset ||
    asset.postId !== media.postId ||
    asset.type !== media.type ||
    asset.state !== "ready" ||
    !asset.etag ||
    asset.namespaceHash !== privateStorageNamespace().hash
  )
    return;
  return {
    key: privateAttachmentObjectKey(asset.type, asset.assetId),
    mime: asset.mimeType,
    etag: asset.etag,
  };
}
