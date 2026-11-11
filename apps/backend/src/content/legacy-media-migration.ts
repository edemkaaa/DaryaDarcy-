/** Применение и откат согласованного переноса старых медиа через сохранённые квитанции. */
import { TRPCError } from "@trpc/server";
import type { PrivateAttachmentActor } from "./private-attachment-uploads";
import { lockPrivateAttachmentActor } from "./private-attachment-uploads";
import { getDb } from "../db";
import { digest } from "../media/private-upload-object";
import {
  prepareLegacyMigration,
  type LegacyMediaPlan,
} from "./legacy-media-manifest";
import {
  lockLegacyTarget,
  legacyConflict,
  type LegacyTarget,
} from "./legacy-media-target";
import { bindContentFiles } from "./private-content-binding";
import { contentFileUrl } from "./private-content-uploads";
import { privateMediaUrl } from "./private-attachment-association";
import {
  requireLegacyEnabled,
  requireLegacySchema,
  readLegacyReceipt,
  insertLegacyReceipt,
  checkLegacyReceipt,
  retiredLegacyReceipt,
  attachedLegacyReceipt,
  requireUnspentLegacyReceipt,
  uploadLegacyObject,
  markLegacyObjectReady,
  bindLegacyMediaReceipt,
  retireLegacyReceipt,
  type LegacyReceipt,
} from "./legacy-media-receipt";

const unavailable = () =>
  new TRPCError({
    code: "SERVICE_UNAVAILABLE",
    message: "Перенос временно недоступен",
  });
const keyFor = (actor: PrivateAttachmentActor, plan: LegacyMediaPlan) =>
  digest(JSON.stringify(["legacy-media:v1", actor.id, plan.idempotencyKey]));
const urlFor = (asset: LegacyReceipt, target: LegacyTarget) =>
  asset.content
    ? contentFileUrl(asset.row.assetId)
    : privateMediaUrl(target.mediaId!);
function isCommitted(
  asset: LegacyReceipt,
  target: LegacyTarget,
  plan: LegacyMediaPlan,
) {
  if (retiredLegacyReceipt(asset)) throw legacyConflict();
  const attached = attachedLegacyReceipt(asset, target);
  if (
    target.currentUrl === urlFor(asset, target) &&
    attached &&
    asset.row.state === "ready"
  )
    return true;
  if (target.currentUrl !== plan.expectedOldUrl || attached)
    throw legacyConflict();
  requireUnspentLegacyReceipt(asset);
  return false;
}

/** Operator-only, one slot per transaction. Existing receipt tables, no DDL, source reads or deletion. */
export async function applyLegacyMedia(
  actor: PrivateAttachmentActor,
  input: unknown,
) {
  const plan = await prepareLegacyMigration(input);
  requireLegacyEnabled(plan);
  try {
    const db = await getDb();
    if (!db) throw unavailable();
    const key = keyFor(actor, plan);
    const claim = await db.transaction(async (tx) => {
      await lockPrivateAttachmentActor(tx, actor);
      await requireLegacySchema(tx, plan);
      const target = await lockLegacyTarget(tx, plan);
      let asset = await readLegacyReceipt(tx, plan, key);
      if (!asset) {
        if (target.currentUrl !== plan.expectedOldUrl) throw legacyConflict();
        asset = await insertLegacyReceipt(tx, plan, key, actor, target);
      }
      checkLegacyReceipt(asset, plan, actor, target);
      return {
        committed: isCommitted(asset, target, plan),
        result: {
          state: "committed" as const,
          url: urlFor(asset, target),
          assetId: asset.row.assetId,
        },
      };
    });
    if (claim.committed) return claim.result;
    // The durable intent is committed before the external write. A lost ACK is recovered by HEAD.
    const staged = await db.transaction(async (tx) => {
      requireLegacyEnabled(plan);
      await lockPrivateAttachmentActor(tx, actor);
      await requireLegacySchema(tx, plan);
      const asset = await readLegacyReceipt(tx, plan, key);
      if (!asset) throw legacyConflict();
      checkLegacyReceipt(asset, plan, actor);
      requireUnspentLegacyReceipt(asset);
      return asset;
    });
    // Network/streaming work is outside SQL locks, including the administrator row.
    const etag = await uploadLegacyObject(staged, plan);
    await db.transaction(async (tx) => {
      requireLegacyEnabled(plan);
      await lockPrivateAttachmentActor(tx, actor);
      await requireLegacySchema(tx, plan);
      const asset = await readLegacyReceipt(tx, plan, key);
      if (!asset) throw legacyConflict();
      checkLegacyReceipt(asset, plan, actor);
      requireUnspentLegacyReceipt(asset);
      await markLegacyObjectReady(tx, asset, etag);
    });
    return await db.transaction(async (tx) => {
      requireLegacyEnabled(plan);
      await lockPrivateAttachmentActor(tx, actor);
      await requireLegacySchema(tx, plan);
      const target = await lockLegacyTarget(tx, plan),
        asset = await readLegacyReceipt(tx, plan, key);
      if (!asset) throw legacyConflict();
      checkLegacyReceipt(asset, plan, actor, target);
      if (!isCommitted(asset, target, plan)) {
        if (asset.row.state !== "ready") throw legacyConflict();
        const url = urlFor(asset, target);
        if (asset.content)
          await bindContentFiles(
            tx,
            target.parentKind,
            target.parentId,
            await target.referencesAfter(url),
            target.previous,
            actor,
          );
        else await bindLegacyMediaReceipt(tx, asset, target);
        await target.write(url);
      }
      return {
        state: "committed" as const,
        url: urlFor(asset, target),
        assetId: asset.row.assetId,
      };
    });
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw unavailable();
  }
}

/** Откатываем только согласованные изменения данной операции переноса. */
export async function rollbackLegacyMedia(
  actor: PrivateAttachmentActor,
  input: unknown,
) {
  const plan = await prepareLegacyMigration(input);
  requireLegacyEnabled(plan);
  try {
    const db = await getDb();
    if (!db) throw unavailable();
    return await db.transaction(async (tx) => {
      await lockPrivateAttachmentActor(tx, actor);
      await requireLegacySchema(tx, plan);
      const target = await lockLegacyTarget(tx, plan),
        asset = await readLegacyReceipt(tx, plan, keyFor(actor, plan));
      if (!asset) throw legacyConflict();
      checkLegacyReceipt(asset, plan, actor, target);
      if (
        retiredLegacyReceipt(asset) &&
        target.currentUrl === plan.expectedOldUrl
      )
        return { state: "rolledBack" as const };
      const attached = attachedLegacyReceipt(asset, target),
        url = urlFor(asset, target);
      if (
        retiredLegacyReceipt(asset) ||
        (attached
          ? target.currentUrl !== url
          : target.currentUrl !== plan.expectedOldUrl)
      )
        throw legacyConflict();
      if (attached) {
        if (asset.content) {
          const refs = await target.referencesAfter(plan.expectedOldUrl);
          if (refs.some((ref) => ref.url === url)) throw legacyConflict();
          await bindContentFiles(
            tx,
            target.parentKind,
            target.parentId,
            refs,
            target.previous,
            actor,
          );
        }
        await target.write(plan.expectedOldUrl);
      }
      await retireLegacyReceipt(tx, asset);
      return { state: "rolledBack" as const };
    });
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw unavailable();
  }
}
