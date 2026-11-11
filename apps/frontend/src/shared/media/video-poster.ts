"use client";
/** Адрес обложки ролика выбираем отдельно от воспроизведения; отсутствие постера не должно менять само видео. Извлечение кадра имеет дедлайн и освобождает временные video/canvas-ресурсы. */
/** Пытаемся получить JPEG-кадр из локального Blob за 15 секунд; обычная ошибка даёт null, явная отмена отклоняет Promise. */
export async function extractVideoPosterBlob(
  videoBlob: Blob,
  signal?: AbortSignal,
): Promise<Blob | null> {
  signal?.throwIfAborted();
  if (typeof document === "undefined") return null;
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(videoBlob);
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    let settled = false;
    let capturing = false;
    /** Освобождаем object URL, медиаэлемент и bitmap canvas на любом завершении, не оставляя фоновую загрузку. */
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      video.onloadeddata = video.onseeked = video.onerror = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(objectUrl);
      canvas.width = canvas.height = 0;
    };
    /** Успешный кадр и отказ без постера завершаются один раз общей очисткой ресурсов. */
    const finish = (blob: Blob | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(blob);
    };
    /** Явную отмену отличаем от отсутствия кадра и передаём вызывающему коду причину AbortSignal. */
    const cancel = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(signal?.reason);
    };
    const timer = setTimeout(() => finish(null), 15_000);
    signal?.addEventListener("abort", cancel, { once: true });
    /** Ограничиваем длинную сторону 1920px без увеличения, рисуем один кадр и кодируем отдельный JPEG-постер. */
    const capture = () => {
      if (settled || capturing) return;
      capturing = true;
      try {
        const scale = Math.min(
          1,
          1920 / Math.max(video.videoWidth, video.videoHeight),
        );
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx || !video.videoWidth || !video.videoHeight) {
          finish(null);
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(finish, "image/jpeg", 0.88);
      } catch {
        finish(null);
      }
    };
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onloadeddata = () => {
      // Выбираем ранний кадр, слегка отступив от начала; capture запускается после seeked или сразу при нулевой позиции.
      const seekTo =
        Number.isFinite(video.duration) && video.duration > 0
          ? Math.min(0.5, video.duration * 0.08)
          : 0;
      if (seekTo === 0) capture();
      else video.currentTime = seekTo;
    };
    video.onseeked = capture;
    video.onerror = () => finish(null);
    video.src = objectUrl;
  });
}
