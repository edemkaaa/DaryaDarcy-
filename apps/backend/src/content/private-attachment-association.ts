import { asc, eq, inArray, max } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  privateAttachmentUploads,
  postMedia,
} from "../../../../packages/database/src/schema";
import {
  privateAttachmentObjectKey,
  privateStorageNamespace,
} from "../media/private-upload-object";
import { isRawMediaFilename } from "../../../../packages/shared/src/media-label";
import {
  lockPrivateAttachmentActor,
  requirePrivateAttachmentSchema,
  requirePrivateUploadEnabled,
  type PrivateAttachmentActor,
  type PrivateAttachmentTransaction,
} from "./private-attachment-uploads";

export type PrivateAttachmentChanges = {
  privateAssetIds?: string[];
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
  if (!changes.privateAssetIds?.length) return;
  requirePrivateUploadEnabled();
  if (!changes.actor) throw new TRPCError({ code: "UNAUTHORIZED" });
  await lockPrivateAttachmentActor(tx, changes.actor);
  await requirePrivateAttachmentSchema(tx);
}
/** Called under the post lock in its save transaction; never touches storage. */
export async function bindPrivateAttachments(
  tx: Pick<MySql2Database, "select" | "insert" | "update">,
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
  for (const asset of assets) {
    if (
      asset.actorUserId !== changes.actor.id ||
      asset.state !== "ready" ||
      !asset.etag ||
      asset.namespaceHash !== namespace.hash
    )
      throw conflict();
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
  const [last] = await tx
    .select({ order: max(postMedia.sortOrder) })
    .from(postMedia)
    .where(eq(postMedia.postId, postId));
  let sortOrder = (last?.order ?? -1) + 1;
  for (const id of ids) {
    const asset = assets.find((row) => row.assetId === id)!;
    if (asset.mediaId !== null) continue;
    const [result] = await tx
      .insert(postMedia)
      .values({
        postId,
        type: asset.type,
        url: `private-asset:${asset.assetId}`,
        filename: isRawMediaFilename(asset.filename) ? null : asset.filename,
        mimeType: asset.mimeType,
        fileSize: asset.fileSize,
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
