import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  publicPhotoUploads,
  users,
  type User,
} from "../../../../packages/database/src/schema";
import { getDb } from "../db";
import { privateUploadKey } from "../content/private-upload-key";
import { digest, privateStorageNamespace } from "./private-upload-object";
import { preparePhoto, photoInput } from "./photos";
import { ensurePublicPhotoObject } from "./public-photo-object";
import type { ContentTransaction } from "../content/post-deletion";

export const publicPhotoStatusInput = z
  .object({ idempotencyKey: privateUploadKey })
  .strict();
export const avatarReceiptInput = photoInput
  .extend({ idempotencyKey: privateUploadKey })
  .strict();
export const coverReceiptInput = avatarReceiptInput.extend({
  purpose: z.literal("publicCover"),
});
type Purpose = "avatar" | "publicCover";
type Actor = Pick<User, "id" | "sessionVersion">;
type Receipt = typeof publicPhotoUploads.$inferSelect;
type Result =
  | { state: "missing" | "pending" }
  | {
      state: "ready";
      url: string;
      avatarApplied: boolean;
      isCurrent: boolean | null;
    };
const unavailable = () =>
  new TRPCError({
    code: "SERVICE_UNAVAILABLE",
    message:
      "Загрузка временно недоступна. Проверьте статус и повторите с прежним ключом.",
  });
const requestId = (actor: Actor, purpose: Purpose, key: string) =>
  digest(JSON.stringify(["public-photo:v1", actor.id, purpose, key]));

async function currentActor(
  tx: ContentTransaction,
  actor: Actor,
  purpose: Purpose,
) {
  const [user] = await tx
    .select()
    .from(users)
    .where(eq(users.id, actor.id))
    .for("update");
  if (!user || user.sessionVersion !== actor.sessionVersion)
    throw new TRPCError({ code: "UNAUTHORIZED" });
  if (
    user.blockedAt ||
    user.accountDeletionRequestedAt ||
    (purpose === "publicCover" && user.role !== "admin")
  )
    throw new TRPCError({ code: "FORBIDDEN" });
  return user;
}
function result(row: Receipt, user: User): Result {
  if (row.state === "pending") return { state: "pending" };
  if (!row.url) throw unavailable();
  return {
    state: "ready",
    url: row.url,
    avatarApplied: row.avatarApplied,
    isCurrent: row.purpose === "avatar" ? user.avatarUrl === row.url : null,
  };
}
async function database() {
  const db = await getDb();
  if (!db) throw unavailable();
  const [rows] = await db.execute(
    sql`SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='public_photo_uploads'`,
  );
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0].engine !== "InnoDB")
    throw unavailable();
  return db;
}
async function safe<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw unavailable();
  }
}

export function publicPhotoStatus(
  actor: Actor,
  purpose: Purpose,
  key: string,
): Promise<Result> {
  return safe(async () =>
    (await database()).transaction(async (tx) => {
      const user = await currentActor(tx, actor, purpose);
      const [row] = await tx
        .select()
        .from(publicPhotoUploads)
        .where(eq(publicPhotoUploads.requestId, requestId(actor, purpose, key)))
        .limit(1);
      return row?.actorUserId === actor.id
        ? result(row, user)
        : { state: "missing" };
    }),
  );
}

export function uploadPublicPhoto(
  actor: Actor,
  purpose: Purpose,
  input: z.output<typeof avatarReceiptInput>,
  signal?: AbortSignal,
): Promise<Result> {
  return safe(async () => {
    const db = await database(),
      namespace = privateStorageNamespace();
    signal?.throwIfAborted();
    const output = await preparePhoto(input.base64),
      payloadHash = digest(input.base64),
      outputHash = digest(output);
    const id = requestId(actor, purpose, input.idempotencyKey);
    // Durable intent precedes external writes. User lock serializes reservations per account.
    const row = await db.transaction(async (tx) => {
      const user = await currentActor(tx, actor, purpose);
      const [existing] = await tx
        .select()
        .from(publicPhotoUploads)
        .where(eq(publicPhotoUploads.requestId, id))
        .for("update");
      if (existing) {
        if (existing.actorUserId !== actor.id)
          throw new TRPCError({
            code: "CONFLICT",
            message: "Операция больше недоступна",
          });
        if (
          existing.payloadHash !== payloadHash ||
          existing.outputHash !== outputHash
        )
          throw new TRPCError({
            code: "CONFLICT",
            message: "Этот ключ уже использован для другого фото",
          });
        if (existing.namespaceHash !== namespace.hash) throw unavailable();
        return existing;
      }
      const receipt: typeof publicPhotoUploads.$inferInsert = {
        requestId: id,
        actorUserId: actor.id,
        purpose,
        assetId: randomUUID(),
        payloadHash,
        outputHash,
        namespaceHash: namespace.hash,
        fileSize: output.length,
        expectedAvatarUrl: purpose === "avatar" ? user.avatarUrl : null,
      };
      await tx.insert(publicPhotoUploads).values(receipt);
      const [created] = await tx
        .select()
        .from(publicPhotoUploads)
        .where(eq(publicPhotoUploads.requestId, id));
      return created!;
    });
    if (row.state === "ready")
      return publicPhotoStatus(actor, purpose, input.idempotencyKey);
    const url = await ensurePublicPhotoObject(row, output, signal);
    signal?.throwIfAborted();
    return db.transaction(async (tx) => {
      const user = await currentActor(tx, actor, purpose);
      const [current] = await tx
        .select()
        .from(publicPhotoUploads)
        .where(eq(publicPhotoUploads.requestId, id))
        .for("update");
      if (
        !current ||
        current.actorUserId !== actor.id ||
        current.namespaceHash !== namespace.hash
      )
        throw unavailable();
      if (current.state === "ready") return result(current, user);
      const avatarApplied =
        purpose === "avatar" && user.avatarUrl === current.expectedAvatarUrl;
      if (avatarApplied)
        await tx
          .update(users)
          .set({ avatarUrl: url })
          .where(eq(users.id, actor.id));
      await tx
        .update(publicPhotoUploads)
        .set({ state: "ready", url, avatarApplied })
        .where(eq(publicPhotoUploads.requestId, id));
      return result(
        { ...current, state: "ready", url, avatarApplied },
        { ...user, avatarUrl: avatarApplied ? url : user.avatarUrl },
      );
    });
  });
}

/** Caller holds the retiring user lock. Keep technical ownership; never delete files. */
export async function retirePublicPhotoReceipts(
  tx: ContentTransaction,
  actorId: number,
) {
  const [tables] = await tx.execute(
    sql`SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='public_photo_uploads'`,
  );
  if (Array.isArray(tables) && !tables.length) return; // Pre-receipt installation.
  if (
    !Array.isArray(tables) ||
    tables.length !== 1 ||
    tables[0].engine !== "InnoDB"
  )
    throw unavailable();
  await tx
    .update(publicPhotoUploads)
    .set({ actorUserId: null, expectedAvatarUrl: null })
    .where(eq(publicPhotoUploads.actorUserId, actorId));
}
