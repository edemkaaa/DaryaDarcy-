import { and, asc, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { privateContentFiles } from "../../../../packages/database/src/schema";
import type { ContentTransaction } from "./post-deletion";
import type { ContentWriteActor } from "./content-write-actor";
import { requirePrivateContentEnabled, requirePrivateContentSchema } from "./private-content-uploads";
import { privateStorageNamespace } from "../media/private-upload-object";
import { assertContentRecoveryWindow } from "./recovery-window";

export type ContentFileUsage = typeof privateContentFiles.$inferSelect.usage;
export type ContentFileReference = { url: string; usage: ContentFileUsage };
type Writer = Pick<ContentTransaction, "select" | "insert" | "update" | "execute">;
const conflict = () => new TRPCError({ code: "CONFLICT", message: "Файл недоступен для привязки" });

/** Only exact application references are accepted. Reserved S3/URL aliases cannot bypass receipts. */
export function contentAssetId(raw: string): string | undefined {
  let decoded = raw;
  try { decoded = decodeURIComponent(raw); } catch { /* Preserve unrelated legacy strings. */ }
  if (!/(\/api\/media\/content-files(?:\/|$)|(?:^|\/)content\/private-v1(?:\/|$))/.test(decoded)) return;
  const match = /^\/api\/media\/content-files\/([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/.exec(raw);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Нужна ссылка приложения на загруженный файл" });
  return match[1];
}
export const postPhotoReferences = (photos: string[]): ContentFileReference[] => photos.map(url => ({ url, usage: "postPhoto" }));
export function hasPrivateContent(references: ContentFileReference[]): boolean { return references.some(ref => Boolean(contentAssetId(ref.url))); }

/** Caller locks actor then parent. No storage operations occur inside a material write. */
export async function bindContentFiles(tx: Writer, parentKind: "post" | "article" | "comment", parentId: number,
  references: ContentFileReference[], previous: ContentFileReference[], actor: ContentWriteActor | undefined) {
  const current = new Map<string, ContentFileUsage>();
  for (const ref of references) {
    const id = contentAssetId(ref.url); if (!id) continue;
    if (current.has(id) && current.get(id) !== ref.usage) throw new TRPCError({ code: "BAD_REQUEST" });
    current.set(id, ref.usage);
  }
  const oldIds = new Set(previous.map(ref => contentAssetId(ref.url)).filter((id): id is string => Boolean(id)));
  if (!current.size && !oldIds.size) return;
  requirePrivateContentEnabled(); if (!actor) throw new TRPCError({ code: "UNAUTHORIZED" });
  await requirePrivateContentSchema(tx);
  const ids = [...new Set([...current.keys(), ...oldIds])];
  const files = await tx.select().from(privateContentFiles).where(inArray(privateContentFiles.assetId, ids)).orderBy(asc(privateContentFiles.assetId)).for("update");
  if (files.length !== ids.length) throw conflict();
  for (const file of files) {
    const retained = current.has(file.assetId);
    if (file.parentId !== null) {
      if (file.parentKind !== parentKind || file.parentId !== parentId || !oldIds.has(file.assetId)) throw conflict();
    } else if (file.actorUserId !== actor.id || file.parentKind !== null) throw conflict();
    if (!retained) {
      await tx.update(privateContentFiles).set({ retiredAt: new Date() }).where(eq(privateContentFiles.assetId, file.assetId));
      continue;
    }
    if (file.usage !== current.get(file.assetId)) throw new TRPCError({ code: "BAD_REQUEST", message: "Файл не подходит для этого места" });
    if (file.retiredAt || file.state !== "ready" || !file.etag || file.namespaceHash !== privateStorageNamespace().hash) throw conflict();
    if (file.parentId === null) {
      assertContentRecoveryWindow(file.createdAt);
      await tx.update(privateContentFiles).set({ parentKind, parentId }).where(and(eq(privateContentFiles.assetId, file.assetId), eq(privateContentFiles.actorUserId, actor.id)));
    }
  }
}
