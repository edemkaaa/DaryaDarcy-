import type { ApiInputs } from "@/shared/api/types";
import { MAX_ATTACHMENT_BYTES } from "@/shared/browser/file-operations";

export type PrivateUploadInput = ApiInputs["admin"]["uploadPrivateAttachment"];
export type PrivateUploadReceipt = {
  state: "pending" | "ready";
  assetId: string;
  type: "audio" | "document";
  filename: string;
  mimeType: string;
  fileSize: number;
};
export type PrivateUploadIntent = {
  key: string;
  receipt?: PrivateUploadReceipt;
};

/** A private receipt is not a legacy public URL. Reject malformed acknowledgements. */
export function requirePrivateReceipt(value: unknown): PrivateUploadReceipt {
  if (!value || typeof value !== "object")
    throw new Error("Сервер не подтвердил загрузку вложения");
  const receipt = value as PrivateUploadReceipt;
  if (
    !["pending", "ready"].includes(receipt.state) ||
    typeof receipt.assetId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      receipt.assetId,
    ) ||
    !["audio", "document"].includes(receipt.type) ||
    typeof receipt.filename !== "string" ||
    !receipt.filename.trim() ||
    typeof receipt.mimeType !== "string" ||
    !receipt.mimeType.includes("/") ||
    !Number.isSafeInteger(receipt.fileSize) ||
    receipt.fileSize <= 0 ||
    receipt.fileSize > MAX_ATTACHMENT_BYTES ||
    "url" in value ||
    "objectKey" in value
  )
    throw new Error("Сервер не подтвердил загрузку вложения");
  return {
    state: receipt.state,
    assetId: receipt.assetId,
    type: receipt.type,
    filename: receipt.filename,
    mimeType: receipt.mimeType,
    fileSize: receipt.fileSize,
  };
}
