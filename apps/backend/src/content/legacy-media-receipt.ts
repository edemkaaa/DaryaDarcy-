/** Квитанции переноса связывают исходный файл, закрытую копию и родительский материал. */
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  privateContentFiles as files,
  privateAttachmentUploads as media,
} from "../../../../packages/database/src/schema";
import {
  privateStorageNamespace,
  ensurePrivateUploadObject,
} from "../media/private-upload-object";
import {
  requirePrivateContentEnabled,
  requirePrivateContentSchema,
} from "./private-content-uploads";
import {
  requirePrivateUploadEnabled,
  requirePrivateAttachmentSchema,
  type PrivateAttachmentTransaction as Tx,
  type PrivateAttachmentActor as Actor,
} from "./private-attachment-uploads";
import { assertContentRecoveryWindow } from "./recovery-window";
import type { LegacyMediaPlan } from "./legacy-media-manifest";
import { legacyConflict, type LegacyTarget } from "./legacy-media-target";
import { TRPCError } from "@trpc/server";
import { ensurePrivateTransferredObject } from "../media/private-transfer-object";

export type LegacyReceipt =
  | { content: true; row: typeof files.$inferSelect }
  | { content: false; row: typeof media.$inferSelect };
/** Выбирает content-file receipt для фото/статьи и attachment receipt только для postMedia. */
const content = (plan: LegacyMediaPlan) => plan.subject.kind !== "postMedia";
/** Проверяем возможность переноса перед внешними и SQL-операциями. */
/** Проверяет соответствующий приватный upload-флаг и, для postMedia, отдельный delivery-флаг до переноса. */
export function requireLegacyEnabled(plan: LegacyMediaPlan) {
  if (content(plan)) requirePrivateContentEnabled();
  else {
    requirePrivateUploadEnabled();
    if (process.env.PRIVATE_POST_MEDIA_DELIVERY_ENABLED !== "true")
      throw new TRPCError({ code: "NOT_FOUND" });
  }
}
/** Проверяет ровно выбранную content либо attachment схему без runtime DDL. */
export async function requireLegacySchema(tx: Tx, plan: LegacyMediaPlan) {
  if (content(plan)) await requirePrivateContentSchema(tx);
  else await requirePrivateAttachmentSchema(tx);
}
/** Читаем сохранённое свидетельство переноса по ключу операции. */
/** Блокирует существующий receipt по requestKey в выбранной таблице, сохраняя его явный content/media вид. */
export async function readLegacyReceipt(
  tx: Tx,
  plan: LegacyMediaPlan,
  key: string,
): Promise<LegacyReceipt | undefined> {
  if (content(plan)) {
    const [row] = await tx
      .select()
      .from(files)
      .where(eq(files.requestKey, key))
      .for("update");
    return row ? { content: true, row } : undefined;
  }
  const [row] = await tx
    .select()
    .from(media)
    .where(eq(media.requestKey, key))
    .for("update");
  return row ? { content: false, row } : undefined;
}
/** Регистрируем намерение переноса отдельно от последующего состояния готовности объекта. */
/** Создаёт unbound receipt со случайным assetId и точными actor/payload/namespace/mime/size метаданными, затем перечитывает под блокировкой. */
export async function insertLegacyReceipt(
  tx: Tx,
  plan: LegacyMediaPlan,
  key: string,
  actor: Actor,
  target: LegacyTarget,
) {
  const base = {
    requestKey: key,
    actorUserId: actor.id,
    assetId: randomUUID(),
    payloadHash: plan.payloadHash,
    namespaceHash: privateStorageNamespace().hash,
    filename: plan.filename,
    mimeType: plan.mimeType,
    fileSize: plan.expectedSourceBytes,
  };
  if (content(plan))
    await tx.insert(files).values({ ...base, usage: target.usage! });
  else {
    if (plan.type === "photo") throw legacyConflict();
    await tx.insert(media).values({ ...base, type: plan.type });
  }
  return (await readLegacyReceipt(tx, plan, key))!;
}
/** Content считается отозванным по retiredAt, attachment — по orphanedAt либо recoveryCompactedAt. */
export const retiredLegacyReceipt = (asset: LegacyReceipt) =>
  asset.content
    ? Boolean(asset.row.retiredAt)
    : Boolean(asset.row.orphanedAt || asset.row.recoveryCompactedAt);
/** Сверяем квитанцию с исходным намерением, а не только с существованием ключа. */
/** Требует совпадения actor/payload/storage namespace и ready ETag; при известной цели дополнительно сверяет usage/type. */
export function checkLegacyReceipt(
  asset: LegacyReceipt,
  plan: LegacyMediaPlan,
  actor: Actor,
  target?: LegacyTarget,
) {
  const row = asset.row;
  if (
    row.actorUserId !== actor.id ||
    row.payloadHash !== plan.payloadHash ||
    row.namespaceHash !== privateStorageNamespace().hash ||
    (row.state === "ready" && !row.etag) ||
    (target &&
      (asset.content
        ? asset.row.usage !== target.usage
        : asset.row.type !== plan.type))
  )
    throw legacyConflict();
}
/** Возвращаем состояние уже привязанного результата переноса. */
/** Отличает полностью unbound receipt от привязки к этой же цели; частичная или чужая parent/media связь даёт CONFLICT. */
export function attachedLegacyReceipt(
  asset: LegacyReceipt,
  target: LegacyTarget,
) {
  if (asset.content) {
    if (asset.row.parentId === null && asset.row.parentKind === null)
      return false;
    if (
      asset.row.parentKind !== target.parentKind ||
      asset.row.parentId !== target.parentId
    )
      throw legacyConflict();
  } else {
    if (asset.row.postId === null && asset.row.mediaId === null) return false;
    if (
      asset.row.postId !== target.parentId ||
      asset.row.mediaId !== target.mediaId
    )
      throw legacyConflict();
  }
  return true;
}
/** Использованная или отозванная квитанция не разрешает новую привязку. */
/** Перед новой привязкой отвергает retired/compacted receipt и истёкшее окно восстановления. */
export function requireUnspentLegacyReceipt(asset: LegacyReceipt) {
  if (retiredLegacyReceipt(asset)) throw legacyConflict();
  assertContentRecoveryWindow(asset.row.createdAt);
}
/** Создаём отдельную копию объекта для согласованного переноса. */
/** Для больших media вызывает защищённую потоковую копию, для bytes — immutable private PUT; content receipt не разрешает video-stream путь. */
export async function uploadLegacyObject(
  asset: LegacyReceipt,
  plan: LegacyMediaPlan,
) {
  if (plan.transport === "s3Stream") {
    if (asset.content) throw legacyConflict();
    return (
      await ensurePrivateTransferredObject(asset.row, plan.transferSource)
    ).etag;
  }
  return asset.content
    ? ensurePrivateUploadObject(
        { ...asset.row, type: "document", scope: "content" },
        plan.bytes,
      )
    : ensurePrivateUploadObject(asset.row, plan.bytes);
}
/** Отмечаем готовность после подтверждённой записи копии. */
/** Сохраняет ready/ETag после внешней записи; уже ready допускается только с тем же ETag. */
export async function markLegacyObjectReady(
  tx: Tx,
  asset: LegacyReceipt,
  etag: string,
) {
  if (asset.row.state === "ready") {
    if (asset.row.etag !== etag) throw legacyConflict();
    return;
  }
  if (asset.content)
    await tx
      .update(files)
      .set({ state: "ready", etag })
      .where(eq(files.requestKey, asset.row.requestKey));
  else
    await tx
      .update(media)
      .set({ state: "ready", etag })
      .where(eq(media.requestKey, asset.row.requestKey));
}
/** Связываем проверенную копию с текущим родительским материалом. */
/** Под receipt/media-блокировкой запрещает чужую квитанцию на тот же mediaId и фиксирует точные postId/mediaId. */
export async function bindLegacyMediaReceipt(
  tx: Tx,
  asset: LegacyReceipt,
  target: LegacyTarget,
) {
  if (asset.content || !target.mediaId) throw legacyConflict();
  const [other] = await tx
    .select()
    .from(media)
    .where(eq(media.mediaId, target.mediaId))
    .for("update");
  if (other && other.requestKey !== asset.row.requestKey)
    throw legacyConflict();
  await tx
    .update(media)
    .set({ postId: target.parentId, mediaId: target.mediaId })
    .where(eq(media.requestKey, asset.row.requestKey));
}
/** Отзываем дальнейшее использование квитанции, сохраняя историю результата. */
/** Записывает content-retired либо attachment-orphaned с очисткой его parent IDs, сохраняя техническую историю вместо удаления S3. */
export async function retireLegacyReceipt(tx: Tx, asset: LegacyReceipt) {
  if (asset.content)
    await tx
      .update(files)
      .set({ retiredAt: new Date() })
      .where(eq(files.requestKey, asset.row.requestKey));
  else
    await tx
      .update(media)
      .set({ orphanedAt: new Date(), postId: null, mediaId: null })
      .where(eq(media.requestKey, asset.row.requestKey));
}
