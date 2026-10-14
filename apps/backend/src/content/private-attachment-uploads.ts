import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  privateAttachmentUploads,
  users,
  type User,
} from "../../../../packages/database/src/schema";
import { getDb } from "../db";
import { decodeMediaBase64 } from "../media/media-encoding";
import { isDeliverableAttachmentMime } from "../media/private-attachment-mime";
import { assertContentRecoveryWindow } from "./recovery-window";
import {
  digest,
  ensurePrivateUploadObject,
  privateStorageNamespace,
} from "../media/private-upload-object";
import {
  normalizeMediaContentType,
  resolveMediaContentType,
} from "./media-content-type";

export const privateUploadKey = z.string().regex(/^[A-Za-z0-9._:-]{16,128}$/);
export const privateUploadStatusInput = z
  .object({ idempotencyKey: privateUploadKey })
  .strict();
export const privateUploadInput = z
  .object({
    idempotencyKey: privateUploadKey,
    type: z.enum(["audio", "document"]),
    filename: z
      .string()
      .trim()
      .min(1)
      .max(512)
      .refine((value) => !/[\x00-\x1f\x7f]/.test(value)),
    mimeType: z.string().min(1).max(128),
    base64: z
      .string()
      .min(1)
      .max(50 * 1024 * 1024),
  })
  .strict();
type Receipt = typeof privateAttachmentUploads.$inferSelect;
export type PrivateAttachmentActor = Pick<User, "id" | "sessionVersion">;
export type PrivateAttachmentTransaction = Parameters<
  Parameters<MySql2Database["transaction"]>[0]
>[0];
const unavailable = () =>
  new TRPCError({
    code: "SERVICE_UNAVAILABLE",
    message: "Загрузка временно недоступна",
  });
export function requirePrivateUploadEnabled() {
  if (process.env.PRIVATE_POST_MEDIA_UPLOAD_ENABLED !== "true")
    throw new TRPCError({ code: "NOT_FOUND" });
}
export async function lockPrivateAttachmentActor(
  tx: PrivateAttachmentTransaction,
  actor: PrivateAttachmentActor,
) {
  const [current] = await tx
    .select()
    .from(users)
    .where(eq(users.id, actor.id))
    .for("update");
  if (!current || current.sessionVersion !== actor.sessionVersion)
    throw new TRPCError({ code: "UNAUTHORIZED" });
  if (
    current.role !== "admin" ||
    current.blockedAt ||
    current.accountDeletionRequestedAt
  )
    throw new TRPCError({ code: "FORBIDDEN" });
}
export async function requirePrivateAttachmentSchema(
  tx: PrivateAttachmentTransaction,
) {
  await tx.select().from(privateAttachmentUploads).limit(0);
  const [rows] = await tx.execute(sql`
    SELECT s.INDEX_NAME AS name,s.COLUMN_NAME AS columnName,s.SEQ_IN_INDEX AS position,s.SUB_PART AS prefix,t.ENGINE AS engine
    FROM information_schema.STATISTICS s JOIN information_schema.TABLES t ON t.TABLE_SCHEMA=s.TABLE_SCHEMA AND t.TABLE_NAME=s.TABLE_NAME
    WHERE s.TABLE_SCHEMA=DATABASE() AND s.TABLE_NAME='private_attachment_uploads' AND s.NON_UNIQUE=0`);
  if (!Array.isArray(rows))
    throw new Error("Private upload schema unavailable");
  for (const column of ["requestKey", "assetId", "mediaId"])
    if (
      !rows.some(
        (row) =>
          row.columnName === column &&
          row.position === 1 &&
          row.prefix === null &&
          row.engine === "InnoDB" &&
          (column !== "requestKey" || row.name === "PRIMARY") &&
          rows.filter((other) => other.name === row.name).length === 1,
      )
    )
      throw new Error("Private upload uniqueness unavailable");
}
function requestKey(actor: PrivateAttachmentActor, key: string) {
  return digest(JSON.stringify(["admin.privateAttachment:v1", actor.id, key]));
}
export function privateUploadReceipt(row: Receipt) {
  assertContentRecoveryWindow(row.createdAt);
  if (row.state === "ready" && !row.etag) throw unavailable();
  return {
    state: row.state,
    assetId: row.assetId,
    type: row.type,
    filename: row.filename,
    mimeType: row.mimeType,
    fileSize: row.fileSize,
  };
}
function assertIntent(
  row: Receipt | undefined,
  actor: PrivateAttachmentActor,
  hash: string,
  namespaceHash: string,
): asserts row is Receipt {
  if (!row || row.actorUserId !== actor.id || row.payloadHash !== hash)
    throw new TRPCError({
      code: "CONFLICT",
      message: "Ключ загрузки уже использован для другого файла",
    });
  if (row.namespaceHash !== namespaceHash) throw unavailable();
  assertContentRecoveryWindow(row.createdAt);
}
export async function uploadPrivateAttachment(
  actor: PrivateAttachmentActor,
  input: z.output<typeof privateUploadInput>,
) {
  requirePrivateUploadEnabled();
  const bytes = decodeMediaBase64(input.base64);
  if (bytes.length > 32 * 1024 * 1024)
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE" });
  const declared = normalizeMediaContentType(input.type, input.mimeType);
  // Existing legacy Word acceptance is not a byte detector; do not claim it here.
  if (declared.split(";")[0] === "application/msword")
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Загрузите PDF, DOCX или текстовый файл",
    });
  const mimeType = await resolveMediaContentType(input.type, declared, bytes);
  if (!isDeliverableAttachmentMime(mimeType))
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Формат файла не поддерживается закрытой выдачей",
    });
  const payloadHash = digest(
    JSON.stringify([
      input.type,
      input.filename,
      mimeType,
      bytes.length,
      digest(bytes),
    ]),
  );
  const key = requestKey(actor, input.idempotencyKey);
  try {
    const namespace = privateStorageNamespace();
    const database = await getDb();
    if (!database) throw unavailable();
    // Commit durable intent BEFORE the external effect. A restart cannot lose its key.
    await database.transaction(async (tx) => {
      await lockPrivateAttachmentActor(tx, actor);
      await requirePrivateAttachmentSchema(tx);
      await tx
        .insert(privateAttachmentUploads)
        .values({
          requestKey: key,
          actorUserId: actor.id,
          assetId: randomUUID(),
          payloadHash,
          namespaceHash: namespace.hash,
          type: input.type,
          filename: input.filename,
          mimeType,
          fileSize: bytes.length,
        })
        .onDuplicateKeyUpdate({
          set: { requestKey: sql`${privateAttachmentUploads.requestKey}` },
        });
      const [row] = await tx
        .select()
        .from(privateAttachmentUploads)
        .where(eq(privateAttachmentUploads.requestKey, key))
        .for("update");
      assertIntent(row, actor, payloadHash, namespace.hash);
    });
    return await database.transaction(async (tx) => {
      await lockPrivateAttachmentActor(tx, actor);
      await requirePrivateAttachmentSchema(tx);
      const [row] = await tx
        .select()
        .from(privateAttachmentUploads)
        .where(eq(privateAttachmentUploads.requestKey, key))
        .for("update");
      assertIntent(row, actor, payloadHash, namespace.hash);
      if (row.state === "ready") return privateUploadReceipt(row);
      const etag = await ensurePrivateUploadObject(row, bytes);
      await tx
        .update(privateAttachmentUploads)
        .set({ state: "ready", etag })
        .where(eq(privateAttachmentUploads.requestKey, key));
      return privateUploadReceipt({ ...row, state: "ready", etag });
    });
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw unavailable();
  }
}
export async function privateAttachmentStatus(
  actor: PrivateAttachmentActor,
  key: string,
) {
  requirePrivateUploadEnabled();
  try {
    const database = await getDb();
    if (!database) throw unavailable();
    return await database.transaction(async (tx) => {
      await lockPrivateAttachmentActor(tx, actor);
      await requirePrivateAttachmentSchema(tx);
      const [row] = await tx
        .select()
        .from(privateAttachmentUploads)
        .where(eq(privateAttachmentUploads.requestKey, requestKey(actor, key)))
        .for("update");
      if (row && row.namespaceHash !== privateStorageNamespace().hash)
        throw unavailable();
      return row
        ? privateUploadReceipt(row)
        : { state: "notRecorded" as const };
    });
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw unavailable();
  }
}
