// Применяет проверенные совместимые аудиокопии к точным прежним привязкам. Receipt связывает результат с исходником и не разрешает перезаписывать посторонние вложения.
import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { z } from "zod";

const id = z.number().int().positive().max(2147483647);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const legacyUrl = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.origin === "https://s3.twcstorage.ru" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      /^\/daryadarcy-s3\/club\/tg\/[1-9]\d*\//.test(url.pathname)
    );
  });
const repairSchema = z
  .array(
    z
      .object({
        before: z
          .object({
            id,
            postId: id,
            type: z.literal("audio"),
            url: legacyUrl,
            posterUrl: z.string().nullable(),
            filename: z.string().min(1).max(512),
            mimeType: z.string().nullable(),
            fileSize: z.number().int().nullable(),
            duration: z.number().int().nullable(),
            sortOrder: z.number().int(),
            createdAt: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/),
          })
          .strict(),
        duration: z.number().int().positive().max(14400),
        asset: z
          .object({
            assetId: z
              .string()
              .regex(
                /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
              ),
            requestKey: digest,
            payloadHash: digest,
            namespaceHash: digest,
            etag: z.string().min(1).max(128),
            fileSize: z
              .number()
              .int()
              .positive()
              .max(32 * 1024 * 1024),
          })
          .strict(),
      })
      .strict(),
  )
  .min(1)
  .max(3);
export type LegacyAudioRepair = z.infer<typeof repairSchema>[number];
const url = (mediaId: number) => `/api/media/post-attachments/${mediaId}`;
const repaired = (change: LegacyAudioRepair) => ({
  ...change.before,
  url: url(change.before.id),
  mimeType: "audio/mp4",
  fileSize: change.asset.fileSize,
  duration: change.duration,
});

function receiptMatches(
  row: RowDataPacket | undefined,
  change: LegacyAudioRepair,
  actorId: number,
) {
  if (!row) return false;
  const wanted = {
    ...change.asset,
    actorUserId: actorId,
    type: "audio",
    state: "ready",
    mimeType: "audio/mp4",
    filename: change.before.filename,
    postId: change.before.postId,
    mediaId: change.before.id,
  };
  return Object.entries(wanted).every(([key, value]) => row[key] === value);
}

async function repair(
  db: Connection,
  actor: number,
  raw: unknown,
  rollback: boolean,
) {
  id.parse(actor);
  const changes = repairSchema
    .parse(raw)
    .sort((a, b) => a.before.id - b.before.id);
  for (const field of ["id", "assetId", "requestKey"] as const) {
    const values = changes.map((change) =>
      field === "id" ? change.before.id : change.asset[field],
    );
    assert(
      new Set(values).size === changes.length,
      "Duplicate repair identity",
    );
  }
  await db.beginTransaction();
  try {
    const [actors] = await db.query<RowDataPacket[]>(
      "SELECT role,blockedAt,accountDeletionRequestedAt FROM users WHERE id=? FOR UPDATE",
      [actor],
    );
    assert(
      actors[0]?.role === "admin" &&
        !actors[0].blockedAt &&
        !actors[0].accountDeletionRequestedAt,
      "Active administrator required",
    );
    for (const postId of [
      ...new Set(changes.map((change) => change.before.postId)),
    ].sort((a, b) => a - b)) {
      const [posts] = await db.query<RowDataPacket[]>(
        "SELECT target,source,status,published FROM posts WHERE id=? FOR UPDATE",
        [postId],
      );
      assert(
        posts[0]?.target === "club" &&
          posts[0].source === "telegram" &&
          posts[0].status === "published" &&
          posts[0].published === 1,
        "Legacy club post changed",
      );
    }
    const states: ("original" | "repaired")[] = [];
    for (const change of changes) {
      const [media] = await db.query<RowDataPacket[]>(
        "SELECT * FROM post_media WHERE id=? FOR UPDATE",
        [change.before.id],
      );
      assert(media[0], "Source audio no longer exists");
      const row = { ...media[0] };
      const original = isDeepStrictEqual(row, change.before);
      assert(
        original || isDeepStrictEqual(row, repaired(change)),
        "Source audio changed since backup",
      );
      const [receipts] = await db.query<RowDataPacket[]>(
        "SELECT * FROM private_attachment_uploads WHERE requestKey=? OR assetId=? OR mediaId=? FOR UPDATE",
        [change.asset.requestKey, change.asset.assetId, change.before.id],
      );
      assert(
        original
          ? receipts.length === 0
          : receipts.length === 1 && receiptMatches(receipts[0], change, actor),
        "Repair receipt conflict",
      );
      states.push(original ? "original" : "repaired");
    }
    assert(
      new Set(states).size === 1,
      "Mixed repair state; manual review required",
    );
    const replayed = states[0] === (rollback ? "original" : "repaired");
    if (!replayed)
      for (const change of changes) {
        if (!rollback)
          await db.query(
            "INSERT INTO private_attachment_uploads (requestKey,actorUserId,assetId,payloadHash,namespaceHash,type,filename,mimeType,fileSize,state,etag,postId,mediaId) VALUES (?,?,?,?,?,'audio',?,'audio/mp4',?,'ready',?,?,?)",
            [
              change.asset.requestKey,
              actor,
              change.asset.assetId,
              change.asset.payloadHash,
              change.asset.namespaceHash,
              change.before.filename,
              change.asset.fileSize,
              change.asset.etag,
              change.before.postId,
              change.before.id,
            ],
          );
        const next = rollback ? change.before : repaired(change);
        await db.query(
          "UPDATE post_media SET url=?,mimeType=?,fileSize=?,duration=? WHERE id=? AND postId=?",
          [
            next.url,
            next.mimeType,
            next.fileSize,
            next.duration,
            change.before.id,
            change.before.postId,
          ],
        );
        if (rollback)
          await db.query(
            "DELETE FROM private_attachment_uploads WHERE requestKey=? AND mediaId=?",
            [change.asset.requestKey, change.before.id],
          );
        await db.query(
          "INSERT INTO admin_audit_log (actorUserId,action,targetType,targetId,details) VALUES (?,?, 'post_media',?,?)",
          [
            actor,
            rollback ? "rollback_legacy_audio" : "repair_legacy_audio",
            change.before.id,
            JSON.stringify({
              assetId: change.asset.assetId,
              oldUrl: change.before.url,
              newUrl: url(change.before.id),
            }),
          ],
        );
      }
    await db.commit();
    return { replayed, mediaIds: changes.map((change) => change.before.id) };
  } catch (error) {
    await db.rollback();
    throw error;
  }
}

/** Changes four metadata fields and inserts bound receipts in one transaction; no storage writes. */
export const applyLegacyAudioRepair = (
  db: Connection,
  actor: number,
  changes: unknown,
) => repair(db, actor, changes, false);
/** Refuses later edits; restores originals, removes only own receipts and retains audit history. */
export const rollbackLegacyAudioRepair = (
  db: Connection,
  actor: number,
  changes: unknown,
) => repair(db, actor, changes, true);
