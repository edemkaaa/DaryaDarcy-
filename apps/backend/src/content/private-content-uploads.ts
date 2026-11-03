import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { privateContentFiles } from "../../../../packages/database/src/schema";
import { getDb } from "../database/connection";
import { preparePhoto } from "../media/photos";
import { decodeMediaBase64, validateMediaBase64 } from "../media/media-encoding";
import { digest, ensurePrivateUploadObject, privateStorageNamespace } from "../media/private-upload-object";
import { resolveMediaContentType, normalizeMediaContentType } from "./media-content-type";
import { lockPrivateAttachmentActor, type PrivateAttachmentActor, type PrivateAttachmentTransaction } from "./private-attachment-uploads";
import { privateUploadKey } from "./private-upload-key";
import { assertContentRecoveryWindow } from "./recovery-window";
import { lockCommentFileActor, requireCommentFilePost } from "./private-comment-actor";

export const privateContentInput = z.object({
  idempotencyKey: privateUploadKey,
  usage: z.enum(["postPhoto", "articlePhoto", "articleDocument"]),
  filename: z.string().trim().min(1).max(512).refine(value => !/[\x00-\x1f\x7f]/.test(value)),
  mimeType: z.string().min(1).max(128),
  base64: z.string().min(1).max(50 * 1024 * 1024),
}).strict();
export const privateCommentPhotoInput = privateContentInput.extend({
  usage: z.literal("commentPhoto"), postId: z.number().int().positive(),
});
export const privateContentStatusInput = z.object({ idempotencyKey: privateUploadKey }).strict();
export const contentFileUrl = (assetId: string) => `/api/media/content-files/${assetId}`;
export function requirePrivateContentEnabled() {
  if (process.env.PRIVATE_CONTENT_FILES_ENABLED !== "true") throw new TRPCError({ code: "NOT_FOUND" });
}
const unavailable = () => new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "Файл временно недоступен" });
export async function requirePrivateContentSchema(tx: Pick<PrivateAttachmentTransaction, "select" | "execute">) {
  await tx.select().from(privateContentFiles).limit(0);
  const [rows] = await tx.execute(sql`SELECT s.INDEX_NAME AS name,s.COLUMN_NAME AS columnName,s.SUB_PART AS prefix,t.ENGINE AS engine
    FROM information_schema.STATISTICS s JOIN information_schema.TABLES t ON t.TABLE_SCHEMA=s.TABLE_SCHEMA AND t.TABLE_NAME=s.TABLE_NAME
    WHERE s.TABLE_SCHEMA=DATABASE() AND s.TABLE_NAME='private_content_files' AND s.NON_UNIQUE=0`);
  if (!Array.isArray(rows)) throw unavailable();
  for (const column of ["requestKey", "assetId"]) if (!rows.some(row => row.columnName === column && row.prefix === null && row.engine === "InnoDB" && (column !== "requestKey" || row.name === "PRIMARY") && rows.filter(other => other.name === row.name).length === 1)) throw unavailable();
}
type FileRow = typeof privateContentFiles.$inferSelect;
function receipt(row: FileRow) {
  // Library imports have a separate operator contract, never an editor receipt.
  if (row.usage === "libraryPhoto" || row.usage === "libraryDocument") throw unavailable();
  assertContentRecoveryWindow(row.createdAt);
  if (row.retiredAt) throw new TRPCError({ code: "CONFLICT", message: "Файл больше недоступен для восстановления" });
  if (row.state === "ready" && !row.etag) throw unavailable();
  return { state: row.state, assetId: row.assetId, usage: row.usage, filename: row.filename, mimeType: row.mimeType, fileSize: row.fileSize,
    ...(row.state === "ready" ? { url: contentFileUrl(row.assetId) } : {}) };
}
const requestKey = (actor: PrivateAttachmentActor, key: string) => digest(JSON.stringify(["private.content:v1", actor.id, key]));
export async function uploadPrivateContentFile(actor: PrivateAttachmentActor, input: z.output<typeof privateContentInput> | z.output<typeof privateCommentPhotoInput>) {
  requirePrivateContentEnabled();
  if (input.usage === "commentPhoto") {
    validateMediaBase64(input.base64, 4 * 1024 * 1024);
    try {
      const database = await getDb(); if (!database) throw unavailable();
      await database.transaction(async tx => requireCommentFilePost(tx, actor, input.postId));
    } catch (error) { if (error instanceof TRPCError) throw error; throw unavailable(); }
  }
  const raw = decodeMediaBase64(input.base64, (input.usage === "articleDocument" ? 32 : 4) * 1024 * 1024);
  let bytes: Buffer, mimeType: string;
  if (input.usage === "articleDocument") {
    const declared = normalizeMediaContentType("document", input.mimeType);
    if (!new Set(["text/plain", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]).has(declared.split(";")[0])) throw new TRPCError({ code: "BAD_REQUEST" });
    bytes = raw; mimeType = await resolveMediaContentType("document", declared, raw);
  } else { bytes = await preparePhoto(input.base64); mimeType = "image/webp"; }
  const hash = digest(JSON.stringify([input.usage, input.filename, mimeType, digest(raw), digest(bytes), ...(input.usage === "commentPhoto" ? [input.postId] : [])]));
  const key = requestKey(actor, input.idempotencyKey);
  try {
    const namespace = privateStorageNamespace();
    const database = await getDb(); if (!database) throw unavailable();
    const check = (row: FileRow | undefined): FileRow => {
      if (!row || row.actorUserId !== actor.id || row.payloadHash !== hash) throw new TRPCError({ code: "CONFLICT", message: "Ключ загрузки уже использован" });
      if (row.namespaceHash !== namespace.hash) throw unavailable();
      receipt(row); return row;
    };
    const intent = await database.transaction(async tx => {
      if (input.usage === "commentPhoto") await requireCommentFilePost(tx, actor, input.postId);
      else await lockPrivateAttachmentActor(tx, actor);
      await requirePrivateContentSchema(tx);
      await tx.insert(privateContentFiles).values({ requestKey: key, actorUserId: actor.id, assetId: randomUUID(), payloadHash: hash,
        namespaceHash: namespace.hash, usage: input.usage, targetPostId: input.usage === "commentPhoto" ? input.postId : null, filename: input.filename, mimeType, fileSize: bytes.length })
        .onDuplicateKeyUpdate({ set: { requestKey: sql`${privateContentFiles.requestKey}` } });
      const [row] = await tx.select().from(privateContentFiles).where(eq(privateContentFiles.requestKey, key)).for("update"); return check(row);
    });
    if (intent.state === "ready") return receipt(intent);
    // A restart still recovers the same object; no network operation owns a SQL
    // lock. The final transaction rechecks the actor, post and recovery window.
    const etag = await ensurePrivateUploadObject({ ...intent, type: "document", scope: "content" }, bytes);
    return await database.transaction(async tx => {
      if (input.usage === "commentPhoto") await requireCommentFilePost(tx, actor, input.postId);
      else await lockPrivateAttachmentActor(tx, actor);
      await requirePrivateContentSchema(tx);
      const [existing] = await tx.select().from(privateContentFiles).where(eq(privateContentFiles.requestKey, key)).for("update");
      const row = check(existing);
      if (row.assetId !== intent.assetId || (row.state === "ready" && row.etag !== etag)) throw unavailable();
      if (row.state === "ready") return receipt(row);
      await tx.update(privateContentFiles).set({ state: "ready", etag }).where(eq(privateContentFiles.requestKey, key));
      return receipt({ ...row, state: "ready", etag });
    });
  } catch (error) { if (error instanceof TRPCError) throw error; throw unavailable(); }
}
export async function privateContentFileStatus(actor: PrivateAttachmentActor, key: string, comment = false) {
  requirePrivateContentEnabled();
  try {
    const database = await getDb(); if (!database) throw unavailable();
    return await database.transaction(async tx => {
      if (comment) await lockCommentFileActor(tx, actor); else await lockPrivateAttachmentActor(tx, actor);
      await requirePrivateContentSchema(tx);
      const [row] = await tx.select().from(privateContentFiles).where(eq(privateContentFiles.requestKey, requestKey(actor, key))).for("update");
      if (row && (row.usage === "commentPhoto") !== comment) throw new TRPCError({ code: "CONFLICT" });
      if (row && row.namespaceHash !== privateStorageNamespace().hash) throw unavailable();
      return row ? receipt(row) : { state: "notRecorded" as const };
    });
  } catch (error) { if (error instanceof TRPCError) throw error; throw unavailable(); }
}
