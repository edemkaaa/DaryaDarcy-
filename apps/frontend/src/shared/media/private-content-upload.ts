import type { ApiInputs } from "@/shared/api/types";
import type { ScopedOperation } from "@/shared/browser/operation-scope";
import { attachmentBase64 } from "./read-attachment";
type AdminContentUsage = "postPhoto" | "articlePhoto" | "articleDocument";
export type ContentUsage = AdminContentUsage | "commentPhoto";
export type ContentReceipt<U extends ContentUsage = ContentUsage> = {
  state: "pending" | "ready";
  assetId: string;
  usage: U;
  filename: string;
  mimeType: string;
  fileSize: number;
  url?: string;
};
export type PrivateContentFile<U extends ContentUsage = ContentUsage> = {
  readonly key: string;
  readonly file: File;
  attempted?: boolean;
  receipt?: ContentReceipt<U>;
};
export type PrivateContentApi<U extends ContentUsage = AdminContentUsage> = {
  upload: (
    input: Omit<ApiInputs["admin"]["uploadPrivateContentFile"], "usage"> & {
      usage: U;
    },
    signal: AbortSignal,
  ) => Promise<unknown>;
  status: (
    input: ApiInputs["admin"]["privateContentFileStatus"],
    signal: AbortSignal,
  ) => Promise<unknown>;
};
const documents = [
  "text/plain",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const limit = (usage: ContentUsage) =>
  (usage === "articleDocument" ? 32 : 4) * 1024 * 1024;
export function validatePrivateContentFile(
  item: PrivateContentFile,
  usage: ContentUsage,
): void {
  const file = item.file;
  if (
    !/^[A-Za-z0-9._:-]{16,128}$/.test(item.key) ||
    !(file instanceof File) ||
    !(
      usage === "articleDocument"
        ? documents
        : ["image/jpeg", "image/png", "image/webp"]
    ).includes(file.type) ||
    file.size < 1 ||
    file.size > limit(usage) ||
    !file.name.trim() ||
    file.name.length > 512 ||
    /[\x00-\x1f\x7f]/.test(file.name)
  )
    throw new Error("Не удалось проверить исходный файл в черновике");
}
export function requirePrivateContentReceipt<U extends ContentUsage>(
  value: unknown,
  file: File,
  usage: U,
): ContentReceipt<U> {
  const item = value as Partial<ContentReceipt<U>> | null;
  const mime = item?.mimeType?.split(";")[0];
  if (
    !item ||
    typeof item !== "object" ||
    Object.keys(item).some(
      (key) =>
        ![
          "state",
          "assetId",
          "usage",
          "filename",
          "mimeType",
          "fileSize",
          "url",
        ].includes(key),
    ) ||
    !["pending", "ready"].includes(item.state ?? "") ||
    typeof item.assetId !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      item.assetId,
    ) ||
    item.usage !== usage ||
    item.filename !== file.name.trim() ||
    (usage === "articleDocument"
      ? mime !== file.type ||
        !documents.includes(mime) ||
        item.fileSize !== file.size
      : item.mimeType !== "image/webp") ||
    !Number.isSafeInteger(item.fileSize) ||
    item.fileSize! < 1 ||
    item.fileSize! > limit(usage) ||
    (item.state === "ready"
      ? item.url !== `/api/media/content-files/${item.assetId}`
      : item.url !== undefined)
  )
    throw new Error("Сервер не подтвердил закрытый файл");
  return {
    state: item.state!,
    assetId: item.assetId,
    usage,
    filename: item.filename,
    mimeType: item.mimeType!,
    fileSize: item.fileSize!,
    ...(item.url ? { url: item.url } : {}),
  };
}
/** Persist the entire owner's intent before any network write. Never fall back to public upload. */
export async function uploadPrivateContentFile<U extends ContentUsage>(
  file: PrivateContentFile<U>,
  usage: U,
  api: PrivateContentApi<U>,
  operation: ScopedOperation,
  checkpoint: () => Promise<void>,
): Promise<void> {
  operation.assertCurrent();
  validatePrivateContentFile(file, usage);
  if (file.receipt?.state === "ready") {
    requirePrivateContentReceipt(file.receipt, file.file, usage);
    return;
  }
  const accept = async (value: unknown) => {
    operation.assertCurrent();
    const receipt = requirePrivateContentReceipt(value, file.file, usage);
    if (file.receipt && file.receipt.assetId !== receipt.assetId)
      throw new Error("Изменилось подтверждение закрытого файла");
    file.receipt = receipt;
    await checkpoint();
    operation.assertCurrent();
    return receipt.state === "ready";
  };
  if (file.attempted) {
    const value = await api.status(
      { idempotencyKey: file.key },
      operation.signal,
    );
    operation.assertCurrent();
    if (
      value &&
      typeof value === "object" &&
      (value as { state?: unknown }).state === "notRecorded"
    ) {
      if (Object.keys(value).length !== 1)
        throw new Error("Сервер не подтвердил статус файла");
    } else if (await accept(value)) return;
  }
  file.attempted = true;
  await checkpoint();
  operation.assertCurrent();
  const base64 = await attachmentBase64(file.file, operation.signal);
  operation.assertCurrent();
  const result = await api.upload(
    {
      idempotencyKey: file.key,
      usage,
      filename: file.file.name,
      mimeType: file.file.type,
      base64,
    },
    operation.signal,
  );
  if (!(await accept(result)))
    throw new Error(
      "Загрузка файла ещё не подтверждена. Проверьте результат перед повтором.",
    );
}
