/** Крупный видеофайл и его квитанция проходят отдельный путь восстановления; повтор не должен становиться новой загрузкой. */
import type { ScopedOperation } from "@/shared/browser/operation-scope";
import { MAX_VIDEO_BYTES } from "@/shared/browser/file-operations";
import { ApiError } from "@/shared/api/errors";
import {
  requirePrivateReceipt,
  type PrivateUploadReceipt,
} from "./private-upload";
import {
  validatePrivatePostPhoto,
  type PrivatePostPhoto,
} from "./private-photo-upload";

export type PrivatePostVideo = {
  readonly key: string;
  readonly file: File;
  poster?: PrivatePostPhoto;
  attempted?: boolean;
  retryNotBefore?: number;
  receipt?: PrivateUploadReceipt & { type: "video" };
};
export type PrivatePostVideoApi = {
  uploadPrivateVideo?: (
    file: File,
    key: string,
    signal: AbortSignal,
  ) => Promise<unknown>;
  privateStatus?: (
    input: { idempotencyKey: string },
    signal: AbortSignal,
  ) => Promise<unknown>;
};
/** Локальное видео адресуется ключом intent, а не временным object URL. */
export const privatePostVideoReference = (video: PrivatePostVideo) =>
  `local-video:${video.key}`;
/** Проверяем исходный File, предельный размер и формат сохранённой задержки; отдельный постер валидируем как закрытое фото. */
export function validatePrivatePostVideo(video: PrivatePostVideo) {
  const file = video.file;
  if (
    !/^[A-Za-z0-9._:-]{16,128}$/.test(video.key) ||
    (video.retryNotBefore !== undefined &&
      (!Number.isSafeInteger(video.retryNotBefore) ||
        video.retryNotBefore < 0)) ||
    !(file instanceof File) ||
    file.size < 1 ||
    file.size > MAX_VIDEO_BYTES ||
    !file.name.trim() ||
    file.name.length > 512 ||
    /[\x00-\x1f\x7f]/.test(file.name) ||
    file.type.length > 128 ||
    (file.type &&
      !file.type.startsWith("video/") &&
      file.type !== "application/octet-stream")
  )
    throw new Error("Не удалось проверить исходное видео в черновике");
  if (video.poster) validatePrivatePostPhoto(video.poster);
}
/** Квитанция должна описывать выбранный файл без изменения размера и имени и один из поддерживаемых MIME видео. */
export function requirePrivateVideoReceipt(
  value: unknown,
  file: File,
): PrivateUploadReceipt & { type: "video" } {
  const receipt = requirePrivateReceipt(value);
  if (
    Object.keys(value as object).some(
      (key) =>
        ![
          "state",
          "assetId",
          "type",
          "filename",
          "mimeType",
          "fileSize",
        ].includes(key),
    ) ||
    receipt.type !== "video" ||
    receipt.filename !== file.name.trim() ||
    receipt.fileSize !== file.size ||
    receipt.mimeType.length > 128 ||
    !["video/mp4", "video/webm", "video/quicktime"].includes(
      receipt.mimeType.split(";")[0],
    )
  )
    throw new Error("Подтверждение не соответствует выбранному видео");
  return { ...receipt, type: "video" };
}
/** Разрешаем ссылки local-video в исходные файлы без дублей и отсутствующих ключей. */
export function selectPrivatePostVideos(
  references: string[],
  videos: PrivatePostVideo[],
) {
  const unique = new Map<string, PrivatePostVideo>();
  for (const video of videos) {
    validatePrivatePostVideo(video);
    if (unique.has(video.key))
      throw new Error("Повторный ключ видео в черновике");
    unique.set(video.key, video);
  }
  const selected: PrivatePostVideo[] = [];
  for (const ref of references) {
    if (!ref.startsWith("local-video:")) continue;
    const video = unique.get(ref.slice("local-video:".length));
    if (!video || selected.includes(video))
      throw new Error("Исходное видео отсутствует или повторяется в черновике");
    selected.push(video);
  }
  return selected;
}
/** После attempted сначала читаем статус прежнего ключа; raw File отправляем повторно только этим ключом и с сохранённым cooldown 429. */
export async function uploadPrivatePostVideo(
  video: PrivatePostVideo,
  api: PrivatePostVideoApi,
  operation: ScopedOperation,
  checkpoint: () => Promise<void>,
) {
  operation.assertCurrent();
  validatePrivatePostVideo(video);
  if (!api.uploadPrivateVideo || !api.privateStatus)
    throw new Error(
      "Закрытая загрузка видео недоступна. Видео осталось в черновике.",
    );
  if (video.receipt?.state === "ready") {
    requirePrivateVideoReceipt(video.receipt, video.file);
    return;
  }
  const remaining = Math.ceil(
    ((video.retryNotBefore ?? 0) - Date.now()) / 1000,
  );
  if (remaining > 0)
    throw new ApiError(
      "Сервер обрабатывает другую видеозагрузку. Повторите загрузку позже.",
      429,
      remaining,
    );
  /** Закрепляем квитанцию текущей операции за прежним assetId и надёжно сохраняем её перед продолжением. */
  const accept = async (value: unknown) => {
    operation.assertCurrent();
    const receipt = requirePrivateVideoReceipt(value, video.file);
    if (video.receipt && video.receipt.assetId !== receipt.assetId)
      throw new Error("Изменилось подтверждение видео");
    video.receipt = receipt;
    await checkpoint();
    operation.assertCurrent();
    return receipt.state === "ready";
  };
  if (video.attempted) {
    const status = await api.privateStatus(
      { idempotencyKey: video.key },
      operation.signal,
    );
    operation.assertCurrent();
    if (
      status &&
      typeof status === "object" &&
      "state" in status &&
      status.state === "notRecorded"
    ) {
      if (Object.keys(status).length !== 1 || video.receipt)
        throw new Error("Сервер не подтвердил прежнее видео");
    } else if (await accept(status)) return;
  }
  video.attempted = true;
  await checkpoint();
  operation.assertCurrent();
  let response: unknown;
  try {
    response = await api.uploadPrivateVideo(
      video.file,
      video.key,
      operation.signal,
    );
    operation.assertCurrent();
  } catch (error) {
    operation.assertCurrent();
    if (
      error instanceof ApiError &&
      error.status === 429 &&
      error.retryAfterSec
    ) {
      video.retryNotBefore = Date.now() + error.retryAfterSec * 1000;
      await checkpoint();
      operation.assertCurrent();
    }
    throw error;
  }
  delete video.retryNotBefore;
  if (!(await accept(response)))
    throw new Error(
      "Загрузка видео ещё не подтверждена. Проверьте результат перед повтором.",
    );
}
