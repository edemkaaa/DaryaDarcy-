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

/** Проверяем ненулевой размер и предел байтов до чтения; MIME и структура содержимого относятся к следующему валидатору. */
export function validateFileSize(
  blob: Blob,
  maxBytes = MAX_ATTACHMENT_BYTES,
): void {
  if (!blob.size) throw new Error("Выбранный файл пуст.");
  if (blob.size > maxBytes)
    throw new Error(`Файл больше ${Math.round(maxBytes / 1024 / 1024)} МБ.`);
}

/** Удерживаем не больше разрешённого тела даже без честного Content-Length; при завершении освобождаем reader и снимаем abort listener. */
export async function readResponseBlob(
  response: Response,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<Blob> {
  /** Сообщение о превышении относится к переданному пределу этого чтения, а не к одному общему лимиту всех вложений. */
  const tooLarge = () =>
    new Error(`Файл больше ${Math.round(maxBytes / 1024 / 1024)} МБ.`);
  const reader = response.body?.getReader();
  /** Отмена закрывает поток; возможная ошибка cancel не должна заслонить исходную причину отказа чтения. */
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

/** Проверяем количество и размер всего выбора до начала декодирования хотя бы первого файла, чтобы частичный набор не стал готовым выбором. */
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

/** Создаём одноразовый нативный input с конечным владельцем; change, cancel и abort завершают Promise только один раз и удаляют DOM. */
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
    /** Однократно убираем input и все ссылки на его callbacks, прежде чем завершать Promise выбора. */
    const cleanup = () => {
      input.onchange = null;
      input.oncancel = null;
      options.signal?.removeEventListener("abort", cancel);
      input.remove();
    };
    /** Внешняя отмена отвергает незавершённый выбор; settled не допускает гонку с поздним native change. */
    const cancel = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        options.signal?.reason ??
          new DOMException("Выбор отменён", "AbortError"),
      );
    };
    /** Сначала закрываем picker и подписки, затем валидируем полный набор; отменённый пользователем выбор даёт пустой массив. */
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

/** Связываем FileReader с внешней отменой и очищаем обработчики на каждом исходе; результат должен быть строковым data URL. */
export function readFileDataUrl(
  blob: Blob,
  signal?: AbortSignal,
): Promise<string> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    /** Отвязываем сигнал и FileReader-события на любом исходе чтения, не удерживая Blob через callbacks. */
    const cleanup = () => {
      signal?.removeEventListener("abort", cancel);
      reader.onload = reader.onerror = reader.onabort = null;
    };
    /** Сначала снимаем callbacks, затем abort: нативный onabort не должен породить второе завершение. */
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
