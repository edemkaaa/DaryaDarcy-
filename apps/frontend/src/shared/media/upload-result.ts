/** Перед привязкой загруженного файла проверяем структуру результата, а не полагаемся только на успешный HTTP-статус. */
import { invalidResponse } from "@/shared/api/errors";
export function requireUploadedMedia(result: unknown): {
  url: string;
  mimeType: string;
  fileSize: number;
} {
  const url = requireUploadedUrl(result);
  const { mimeType, fileSize } = result as {
    mimeType?: unknown;
    fileSize?: unknown;
  };
  if (
    typeof mimeType !== "string" ||
    !mimeType.trim() ||
    mimeType.length > 128 ||
    /[\u0000-\u001f\u007f-\u009f]/.test(mimeType) ||
    typeof fileSize !== "number" ||
    !Number.isSafeInteger(fileSize) ||
    fileSize <= 0
  )
    throw invalidResponse();
  return { url, mimeType, fileSize };
}

export function requireUploadedUrl(result: unknown): string {
  const url =
    result && typeof result === "object"
      ? (result as { url?: unknown }).url
      : undefined;
  if (typeof url !== "string") throw invalidResponse();
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw invalidResponse();
  }
  if (
    !["https:", "http:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  )
    throw invalidResponse();
  return url;
}
