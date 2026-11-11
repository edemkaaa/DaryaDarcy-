/** Исходный Blob или адрес вложения преобразуется в Base64 в границах размера и срока текущей операции. */
import {
  MAX_ATTACHMENT_BYTES,
  readResponseBlob,
  validateFileSize,
} from "@/shared/browser/file-operations";
import { runApiRequest } from "@/shared/api/request-lifecycle";
import { blobToBase64 } from "./image-upload";

export async function attachmentBase64(
  source: Blob | string,
  signal?: AbortSignal,
): Promise<string> {
  signal?.throwIfAborted();
  const blob =
    typeof source === "string"
      ? await runApiRequest(source, { signal }, async (response) => {
          if (!response.ok) throw new Error("Не удалось прочитать вложение");
          return readResponseBlob(response, MAX_ATTACHMENT_BYTES, signal);
        })
      : source;
  validateFileSize(blob);
  return blobToBase64(blob, signal);
}
