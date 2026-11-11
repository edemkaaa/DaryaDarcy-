"use client";
/** Транспорт загрузки видео отделён от редактирования поста; результат проверяется до добавления ссылки в материал. */
import { getApiBaseUrl } from "@/shared/config/api";
import {
  ApiError,
  getRequestErrorMessage,
  invalidResponse,
} from "@/shared/api/errors";
import { runApiRequest } from "@/shared/api/request-lifecycle";
import { requestSessionCheck } from "@/shared/api/session-events";
import {
  MAX_VIDEO_BYTES,
  readResponseBlob,
  validateFileSize,
} from "@/shared/browser/file-operations";
const UPLOAD_TIMEOUT_MS = 3 * 60 * 1000;

export async function uploadAdminVideoBlob(
  blob: Blob,
  filename: string,
  signal?: AbortSignal,
): Promise<string> {
  signal?.throwIfAborted();
  validateFileSize(blob, MAX_VIDEO_BYTES);
  if (
    blob.type &&
    !blob.type.startsWith("video/") &&
    blob.type !== "application/octet-stream"
  )
    throw new Error("Выберите видеофайл.");
  const base = getApiBaseUrl().replace(/\/$/, "");
  return runApiRequest(
    `${base}/api/admin/upload-video?filename=${encodeURIComponent(filename || "video.mp4")}`,
    {
      method: "POST",
      headers: { "Content-Type": blob.type || "video/mp4" },
      body: blob,
      signal,
      cache: "no-store",
    },
    async (response) => {
      if (response.status === 401 || response.status === 403)
        requestSessionCheck(response.status);
      const body = await response.text();
      let data: unknown;
      try {
        data = body ? JSON.parse(body) : null;
      } catch {
        data = null;
      }
      if (!response.ok) {
        const message =
          response.status === 413
            ? "Видео слишком большое для загрузки. Сожмите файл или выберите другой."
            : response.status === 400
              ? data &&
                typeof data === "object" &&
                ["Некорректный видеофайл", "Пустой файл"].includes(
                  String((data as { error?: unknown }).error),
                )
                ? String((data as { error: string }).error)
                : "Не удалось загрузить видео. Проверьте формат файла."
              : getRequestErrorMessage({
                  data: { httpStatus: response.status },
                });
        throw new ApiError(message, response.status);
      }
      const url =
        data && typeof data === "object"
          ? (data as { url?: unknown }).url
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
    },
    UPLOAD_TIMEOUT_MS,
  );
}
export async function uploadAdminVideoFromUri(
  uri: string,
  filename: string,
  mimeType?: string,
  signal?: AbortSignal,
): Promise<string> {
  const blob = await runApiRequest(uri, { signal }, async (response) => {
    if (!response.ok) throw new Error("Не удалось прочитать видеофайл");
    return readResponseBlob(response, MAX_VIDEO_BYTES, signal);
  });
  const typed =
    mimeType && (!blob.type || blob.type === "application/octet-stream")
      ? new Blob([blob], { type: mimeType })
      : blob;
  return uploadAdminVideoBlob(typed, filename, signal);
}
