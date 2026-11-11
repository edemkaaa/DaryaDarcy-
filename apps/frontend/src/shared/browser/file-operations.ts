"use client";
/** Выбор, чтение и загрузка файла имеют пределы по размеру и отмене; крупное тело не должно бесконтрольно удерживаться в памяти. */

export const MAX_ATTACHMENT_BYTES = 32 * 1024 * 1024;
export const MAX_AVATAR_SOURCE_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
export const MAX_FILES_PER_SELECTION = 20;
export type FileSelectionOptions = {
  signal?: AbortSignal;
  maxBytes?: number;
  maxFiles?: number;
};

export function validateFileSize(
  blob: Blob,
  maxBytes = MAX_ATTACHMENT_BYTES,
): void {
  if (!blob.size) throw new Error("Выбранный файл пуст.");
  if (blob.size > maxBytes)
    throw new Error(`Файл больше ${Math.round(maxBytes / 1024 / 1024)} МБ.`);
}

/** Bound retained bytes even when Content-Length is absent or incorrect. */
export async function readResponseBlob(
  response: Response,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<Blob> {
  const tooLarge = () =>
    new Error(`Файл больше ${Math.round(maxBytes / 1024 / 1024)} МБ.`);
  const reader = response.body?.getReader();
  const cancel = () => {
    void reader?.cancel().catch(() => {});
  };
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    signal?.throwIfAborted();
    if (Number(response.headers.get("Content-Length")) > maxBytes)
      throw tooLarge();
    const parts: BlobPart[] = [];
    let size = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        signal?.throwIfAborted();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) throw tooLarge();
        parts.push(value);
      }
    }
    const blob = new Blob(parts, {
      type: response.headers.get("Content-Type") ?? "",
    });
    validateFileSize(blob, maxBytes);
    return blob;
  } finally {
    signal?.removeEventListener("abort", cancel);
    cancel();
    reader?.releaseLock();
  }
}

/** Check every selected file before decoding or reading any of them. */
export function validateFileSelection(
  files: File[],
  options: FileSelectionOptions = {},
): void {
  if (files.length > (options.maxFiles ?? MAX_FILES_PER_SELECTION))
    throw new Error(
      `Выберите не больше ${options.maxFiles ?? MAX_FILES_PER_SELECTION} файлов за один раз.`,
    );
  for (const file of files) validateFileSize(file, options.maxBytes);
}

export function chooseFiles(
  accept: string,
  multiple = false,
  options: FileSelectionOptions = {},
): Promise<File[]> {
  options.signal?.throwIfAborted();
  if (typeof document === "undefined") return Promise.resolve([]);
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;
    input.hidden = true;
    let settled = false;
    const cleanup = () => {
      input.onchange = null;
      input.oncancel = null;
      options.signal?.removeEventListener("abort", cancel);
      input.remove();
    };
    const cancel = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        options.signal?.reason ??
          new DOMException("Выбор отменён", "AbortError"),
      );
    };
    const finish = (files: File[]) => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        validateFileSelection(files, options);
        resolve(files);
      } catch (error) {
        reject(error);
      }
    };
    input.onchange = () => finish(Array.from(input.files ?? []));
    input.oncancel = () => finish([]);
    options.signal?.addEventListener("abort", cancel, { once: true });
    document.body.appendChild(input);
    try {
      input.click();
    } catch (error) {
      settled = true;
      cleanup();
      reject(error);
    }
  });
}

export function readFileDataUrl(
  blob: Blob,
  signal?: AbortSignal,
): Promise<string> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const cleanup = () => {
      signal?.removeEventListener("abort", cancel);
      reader.onload = reader.onerror = reader.onabort = null;
    };
    const cancel = () => {
      cleanup();
      reader.abort();
      reject(
        signal?.reason ?? new DOMException("Чтение отменено", "AbortError"),
      );
    };
    reader.onload = () => {
      const result = reader.result;
      cleanup();
      if (typeof result !== "string")
        reject(new Error("Не удалось прочитать файл"));
      else resolve(result);
    };
    reader.onerror = reader.onabort = () => {
      const error = reader.error ?? new Error("Не удалось прочитать файл");
      cleanup();
      reject(error);
    };
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      reader.readAsDataURL(blob);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
