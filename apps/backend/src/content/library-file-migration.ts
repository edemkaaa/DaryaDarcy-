/** Перенос файлов Библиотеки и откат только тех привязок, которые принадлежат данной операции. */
export { inspectLibraryMigration } from "./library-migration-manifest";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  libraryFileBindings as bindings,
  libraryFileMigrations as operations,
  privateContentFiles as files,
} from "../../../../packages/database/src/schema";
import { getDb } from "../db";
import {
  digest,
  ensurePrivateUploadObject,
  privateStorageNamespace,
} from "../media/private-upload-object";
import {
  lockPrivateAttachmentActor,
  type PrivateAttachmentActor as Actor,
  type PrivateAttachmentTransaction as Tx,
} from "./private-attachment-uploads";
import { libraryFilesEnabled } from "./library-files";
import { prepareLibraryMigration } from "./library-migration-manifest";
import { privateUploadKey } from "./private-upload-key";

const conflict = () =>
  new TRPCError({
    code: "CONFLICT",
    message: "Перенос конфликтует с текущей версией",
  });
const unavailable = () =>
  new TRPCError({
    code: "SERVICE_UNAVAILABLE",
    message: "Перенос временно недоступен",
  });
const keyFor = (actor: Actor, key: string) =>
  digest(
    JSON.stringify([
      "library-migration:v1",
      actor.id,
      privateUploadKey.parse(key),
    ]),
  );
type Operation = typeof operations.$inferSelect;
type Binding = typeof bindings.$inferSelect;
function enabled() {
  if (!libraryFilesEnabled()) throw new TRPCError({ code: "NOT_FOUND" });
}
function result(operation: Operation) {
  return { state: operation.state, bindings: operation.result ?? [] };
}
async function database() {
  const db = await getDb();
  if (!db) throw unavailable();
  return db;
}
async function operation(tx: Tx, key: string) {
  const [row] = await tx
    .select()
    .from(operations)
    .where(eq(operations.requestKey, key))
    .for("update");
  if (!row) throw conflict();
  return row;
}
async function schema(tx: Tx) {
  await tx.select().from(bindings).limit(0);
  await tx.select().from(operations).limit(0);
  const [rows] = await tx.execute(
    sql`SELECT s.TABLE_NAME AS t,s.INDEX_NAME AS n,GROUP_CONCAT(s.COLUMN_NAME ORDER BY s.SEQ_IN_INDEX) AS c,MAX(s.SUB_PART IS NOT NULL) AS p,MIN(t.ENGINE) AS engine FROM information_schema.STATISTICS s JOIN information_schema.TABLES t ON t.TABLE_SCHEMA=s.TABLE_SCHEMA AND t.TABLE_NAME=s.TABLE_NAME WHERE s.TABLE_SCHEMA=DATABASE() AND s.NON_UNIQUE=0 AND s.TABLE_NAME IN ('library_file_bindings','library_file_migrations','private_content_files') GROUP BY s.TABLE_NAME,s.INDEX_NAME`,
  );
  if (!Array.isArray(rows)) throw unavailable();
  for (const [t, c] of [
    ["library_file_bindings", "materialKey,fileKey"],
    ["library_file_bindings", "assetId"],
    ["library_file_migrations", "requestKey"],
    ["private_content_files", "requestKey"],
    ["private_content_files", "assetId"],
  ])
    if (
      !rows.some(
        (row) =>
          row.t === t &&
          row.c === c &&
          Number(row.p) === 0 &&
          row.engine === "InnoDB",
      )
    )
      throw unavailable();
}
async function materialRows(tx: Tx, material: string) {
  return tx
    .select()
    .from(bindings)
    .where(eq(bindings.materialKey, material))
    .orderBy(bindings.fileKey)
    .for("update");
}
function revisions(
  current: Binding[],
  plan: Awaited<ReturnType<typeof prepareLibraryMigration>>,
) {
  for (const file of plan.files) {
    const old = current.find((row) => row.fileKey === file.fileKey);
    if ((old?.revision ?? 0) !== file.expectedRevision) throw conflict();
  }
}

/** Operator-only library function: no HTTP upload, source fetch or automatic rollout. */
export async function applyLibraryMigration(actor: Actor, input: unknown) {
  enabled();
  const plan = await prepareLibraryMigration(input);
  const db = await database(),
    key = keyFor(actor, plan.idempotencyKey),
    namespaceHash = privateStorageNamespace().hash;
  const claimed = await db.transaction(async (tx) => {
    await lockPrivateAttachmentActor(tx, actor);
    await schema(tx);
    const [existing] = await tx
      .select()
      .from(operations)
      .where(eq(operations.requestKey, key))
      .for("update");
    if (existing) {
      if (
        existing.payloadHash !== plan.payloadHash ||
        existing.state === "rolledBack"
      )
        throw conflict();
      return existing;
    }
    revisions(await materialRows(tx, plan.materialKey), plan);
    await tx
      .insert(operations)
      .values({
        requestKey: key,
        payloadHash: plan.payloadHash,
        plan: plan.files.map(() => randomUUID()),
      });
    return operation(tx, key);
  });
  if (claimed.state === "committed") return result(claimed);
  if (claimed.plan.length !== plan.files.length) throw conflict();
  for (const [index, file] of plan.files.entries()) {
    enabled();
    const assetId = claimed.plan[index],
      requestKey = digest(JSON.stringify(["library-file:v1", key, index]));
    const payloadHash = digest(
      JSON.stringify([
        file.usage,
        file.filename,
        file.mimeType,
        file.sha256,
        file.bytes.length,
      ]),
    );
    const staged = await db.transaction(async (tx) => {
      await lockPrivateAttachmentActor(tx, actor);
      const op = await operation(tx, key);
      if (op.state === "rolledBack") throw conflict();
      const [old] = await tx
        .select()
        .from(files)
        .where(eq(files.requestKey, requestKey))
        .for("update");
      if (old) {
        if (
          old.assetId !== assetId ||
          old.actorUserId !== actor.id ||
          old.payloadHash !== payloadHash ||
          old.namespaceHash !== namespaceHash ||
          old.retiredAt
        )
          throw conflict();
        return old;
      }
      if (op.state !== "pending") throw conflict();
      await tx
        .insert(files)
        .values({
          requestKey,
          actorUserId: actor.id,
          assetId,
          payloadHash,
          namespaceHash,
          usage: file.usage,
          filename: file.filename,
          mimeType: file.mimeType,
          fileSize: file.bytes.length,
        });
      const [created] = await tx
        .select()
        .from(files)
        .where(eq(files.requestKey, requestKey));
      return created;
    });
    if (staged.state !== "ready") {
      // SDK HEAD/conditional PUT resolves lost ACK; copied bytes are never replaced.
      let etag: string;
      try {
        etag = await ensurePrivateUploadObject(
          {
            scope: "content",
            assetId,
            type: "document",
            payloadHash,
            mimeType: file.mimeType,
            fileSize: file.bytes.length,
            namespaceHash,
          },
          file.bytes,
        );
      } catch {
        throw unavailable();
      }
      await db.transaction(async (tx) => {
        await lockPrivateAttachmentActor(tx, actor);
        enabled();
        if ((await operation(tx, key)).state === "rolledBack") throw conflict();
        await tx
          .update(files)
          .set({ state: "ready", etag })
          .where(
            and(eq(files.requestKey, requestKey), eq(files.assetId, assetId)),
          );
      });
    }
  }
  try {
    return await db.transaction(async (tx) => {
      await lockPrivateAttachmentActor(tx, actor);
      enabled();
      const op = await operation(tx, key);
      if (op.state === "committed") return result(op);
      if (op.state !== "pending") throw conflict();
      const current = await materialRows(tx, plan.materialKey);
      revisions(current, plan);
      const previous: (Binding | null)[] = [],
        changed: Binding[] = [];
      for (const [index, file] of plan.files.entries()) {
        const assetId = op.plan[index];
        const [asset] = await tx
          .select()
          .from(files)
          .where(eq(files.assetId, assetId))
          .for("update");
        if (
          !asset ||
          asset.actorUserId !== actor.id ||
          asset.state !== "ready" ||
          !asset.etag ||
          asset.retiredAt ||
          asset.parentId !== null ||
          asset.namespaceHash !== namespaceHash
        )
          throw conflict();
        const old = current.find((row) => row.fileKey === file.fileKey);
        previous.push(old ?? null);
        const value = {
          materialKey: plan.materialKey,
          fileKey: file.fileKey,
          assetId,
          sortOrder: file.sortOrder,
          enabled: true,
          revision: (old?.revision ?? 0) + 1,
        };
        let id = old?.id;
        if (id) await tx.update(bindings).set(value).where(eq(bindings.id, id));
        else {
          const [created] = await tx
            .insert(bindings)
            .values(value)
            .$returningId();
          id = created.id;
        }
        await tx
          .update(files)
          .set({ parentKind: "library", parentId: id })
          .where(eq(files.assetId, assetId));
        changed.push({ id, ...value });
      }
      await tx
        .update(operations)
        .set({ state: "committed", previous, result: changed })
        .where(eq(operations.requestKey, key));
      return { state: "committed" as const, bindings: changed };
    });
  } catch (error) {
    const cause = error as { code?: string; cause?: { code?: string } };
    if (
      ["ER_DUP_ENTRY", "ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"].includes(
        cause.code ?? cause.cause?.code ?? "",
      )
    )
      throw conflict();
    throw error;
  }
}

/** Восстанавливаем привязки только при сохранении условий отката данного плана. */
export async function rollbackLibraryMigration(
  actor: Actor,
  idempotencyKey: string,
) {
  enabled();
  const db = await database(),
    key = keyFor(actor, idempotencyKey);
  return db.transaction(async (tx) => {
    await lockPrivateAttachmentActor(tx, actor);
    await schema(tx);
    enabled();
    const op = await operation(tx, key);
    if (op.state === "rolledBack") return result(op);
    if (
      op.state !== "committed" ||
      !op.result ||
      !op.previous ||
      op.result.length !== op.previous.length
    )
      throw conflict();
    const restored: Binding[] = [];
    for (const [index, committed] of op.result.entries()) {
      const [current] = await tx
        .select()
        .from(bindings)
        .where(eq(bindings.id, committed.id))
        .for("update");
      if (
        !current ||
        current.revision !== committed.revision ||
        current.assetId !== committed.assetId ||
        current.enabled !== committed.enabled
      )
        throw conflict();
      const before = op.previous[index];
      if (before) {
        const [asset] = await tx
          .select()
          .from(files)
          .where(eq(files.assetId, before.assetId))
          .for("update");
        if (
          !asset ||
          asset.parentKind !== "library" ||
          asset.parentId !== current.id ||
          asset.state !== "ready" ||
          !asset.etag ||
          asset.retiredAt ||
          asset.namespaceHash !== privateStorageNamespace().hash
        )
          throw conflict();
      }
      const value = {
        ...(before ?? current),
        enabled: before?.enabled ?? false,
        revision: current.revision + 1,
      };
      await tx.update(bindings).set(value).where(eq(bindings.id, current.id));
      restored.push(value);
    }
    await tx
      .update(operations)
      .set({ state: "rolledBack", result: restored })
      .where(eq(operations.requestKey, key));
    return { state: "rolledBack" as const, bindings: restored };
  });
}
