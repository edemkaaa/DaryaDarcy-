import { TRPCError } from "@trpc/server";

export const retiredPublicUploads = new Set([
  "club.uploadCommentPhoto",
  "admin.uploadMedia",
]);
export const retiredUploadMessage =
  "Публичная загрузка отключена. Используйте защищённую загрузку файлов.";

/** Tombstones stay callable but can never publish an object or fall back. */
export function rejectLegacyUpload(): never {
  throw new TRPCError({ code: "NOT_FOUND", message: retiredUploadMessage });
}
