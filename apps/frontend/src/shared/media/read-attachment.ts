import {
  MAX_ATTACHMENT_BYTES,
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
          const length = Number(response.headers.get("Content-Length"));
          if (length > MAX_ATTACHMENT_BYTES)
            throw new Error("Вложение больше 32 МБ");
          return response.blob();
        })
      : source;
  validateFileSize(blob);
  return blobToBase64(blob, signal);
}
