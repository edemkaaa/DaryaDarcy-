/** Загрузка закрытого вложения сохраняет исходное намерение и использует прежний ключ при восстановлении неизвестного результата. */
import type { ApiInputs } from "@/shared/api/types";
import {
  MAX_ATTACHMENT_BYTES,
  MAX_VIDEO_BYTES,
} from "@/shared/browser/file-operations";

export type PrivateUploadInput = ApiInputs["admin"]["uploadPrivateAttachment"];
export type PrivateUploadReceipt = {
  state: "pending" | "ready";
  assetId: string;
  type: "audio" | "document" | "video";
  filename: string;
  mimeType: string;
  fileSize: number;
};
export type PrivateUploadIntent = {
  key: string;
  receipt?: PrivateUploadReceipt;
};

/** Проверяем квитанцию закрытого вложения, включая тип и лимит размера; публичный URL или objectKey в таком ответе запрещены. */
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
    !["audio", "document", "video"].includes(receipt.type) ||
    typeof receipt.filename !== "string" ||
    !receipt.filename.trim() ||
    typeof receipt.mimeType !== "string" ||
    !/^[a-z0-9!#$%&'*+.^_`|~-]+\/[a-z0-9!#$%&'*+.^_`|~-]+(?:;[^\r\n\x00-\x1f\x7f]*)?$/i.test(
      receipt.mimeType,
    ) ||
    !Number.isSafeInteger(receipt.fileSize) ||
    receipt.fileSize <= 0 ||
    receipt.fileSize >
      (receipt.type === "video" ? MAX_VIDEO_BYTES : MAX_ATTACHMENT_BYTES) ||
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
