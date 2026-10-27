"use client";
import { getApiBaseUrl } from "@/shared/config/api";
import { runApiRequest } from "@/shared/api/request-lifecycle";
import {
  ApiError,
  getRequestErrorMessage,
  invalidResponse,
} from "@/shared/api/errors";
import { requestSessionCheck } from "@/shared/api/session-events";
import { privateUploadRejectionMessage } from "@/shared/api/upload-errors";
import { parseRetryAfter } from "@/shared/api/retry-after";
import {
  validatePrivatePostVideo,
  requirePrivateVideoReceipt,
} from "@/domain/post/private-video-upload";

/** No base64/public URL/retry: the save coordinator owns this stable-key intent. */
export async function uploadAdminPrivateVideo(
  file: File,
  key: string,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  validatePrivatePostVideo({ file, key });
  const base = getApiBaseUrl().replace(/\/$/, "");
  return runApiRequest(
    `${base}/api/admin/private-video-uploads?filename=${encodeURIComponent(file.name)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "Idempotency-Key": key,
      },
      body: file,
      signal,
      cache: "no-store",
    },
    async (response) => {
      if (response.status === 401 || response.status === 403)
        requestSessionCheck(response.status);
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        const delay =
          response.status === 429
            ? parseRetryAfter(response.headers.get("Retry-After"))
            : undefined;
        throw new ApiError(
          response.status === 429
            ? "Сервер обрабатывает другую видеозагрузку. Повторите загрузку позже."
            : response.status === 413
              ? "Видео слишком большое для загрузки. Сожмите файл или выберите другой."
              : (privateUploadRejectionMessage({
                  data: { httpStatus: response.status },
                }) ??
                getRequestErrorMessage({
                  data: { httpStatus: response.status },
                })),
          response.status,
          delay,
        );
      }
      let value: unknown;
      try {
        value = await response.json();
      } catch {
        throw invalidResponse();
      }
      return requirePrivateVideoReceipt(value, file);
    },
    3 * 60 * 1000,
  );
}
