// Архив Expo. Создаёт временный file-input и возвращает выбранные файлы, удаляя элемент при change/cancel.
import { Platform } from "react-native";

export function pickWebFiles(accept: string, multiple: boolean): Promise<File[]> {
  // Создаёт временный file-input и возвращает выбранные файлы, удаляя элемент при change/cancel.

  return new Promise((resolve) => {
    const doc = (globalThis as { document?: Document }).document;
    if (!doc) {
      resolve([]);
      return;
    }
    const input = doc.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = "none";
    const done = (files: File[]) => {
      // Завершает выбор и освобождает временный DOM-input.

      resolve(files);
      input.remove();
    };
    input.onchange = () => done(Array.from(input.files || []));
    input.oncancel = () => done([]);
    doc.body.appendChild(input);
    input.click();
  });
}

export function blobToBase64(blob: Blob): Promise<string> {
  // Читает весь Blob как data URL и удаляет MIME-префикс; Base64 увеличивает объём данных.

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(blob);
  });
}

function fileName(blob: Blob): string {
  // Возвращает имя только настоящего File, у произвольного Blob имя неизвестно.

  return blob instanceof File ? blob.name : "";
}

function isHeicLike(blob: Blob): boolean {
  // Учитывает MIME и расширение HEIC/HEIF для выбора совместимого декодирования.

  const name = fileName(blob);
  return /heic|heif/i.test(blob.type) || /\.heic$|\.heif$/i.test(name);
}

function isLikelyImage(blob: Blob): boolean {
  // Предварительно распознаёт изображение по MIME/имени; сигнатуру проверяет сервер.

  if (blob.type.startsWith("image/")) return true;
  if (isHeicLike(blob)) return true;
  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(fileName(blob));
}

async function loadDrawableFromBlob(
  blob: Blob,
): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void }> {
  // Пробует ImageBitmap и fallback img для Safari/HEIC, освобождая временный object URL.

  const doc = (globalThis as { document?: Document }).document;
  if (!doc) throw new Error("Нет доступа к изображению");

  if (typeof createImageBitmap !== "undefined" && !isHeicLike(blob)) {
    try {
      const bitmap = await createImageBitmap(blob);
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => /* Рисует декодированный источник в запрошенном размере Canvas; это операция ресэмплинга. */ ctx.drawImage(bitmap, 0, 0, w, h),
      };
    } catch {
      // Safari/iOS HEIC often fails here — fall back to <img>.
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = doc.createElement("img");
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Не удалось прочитать фото"));
      el.src = url;
    });
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: (ctx, w, h) => /* Рисует декодированный источник в запрошенном размере Canvas; это операция ресэмплинга. */ ctx.drawImage(img, 0, 0, w, h),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function compressImageBlob(blob: Blob, maxEdge = 1920, quality = 0.82): Promise<Blob> {
  // Готовит JPEG с ограниченной стороной, сохраняя исходный Blob при ошибке; это сжатие с потерями.

  const doc = (globalThis as { document?: Document }).document;
  if (!doc || !isLikelyImage(blob)) return blob;
  if (/gif|svg/i.test(blob.type) || /\.gif$/i.test(fileName(blob))) return blob;

  try {
    const drawable = await loadDrawableFromBlob(blob);
    const scale = Math.min(1, maxEdge / Math.max(drawable.width, drawable.height));
    const width = Math.max(1, Math.round(drawable.width * scale));
    const height = Math.max(1, Math.round(drawable.height * scale));
    const canvas = doc.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return blob;
    drawable.draw(ctx, width, height);
    const compressed = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((next) => resolve(next), "image/jpeg", quality);
    });
    return compressed ?? blob;
  } catch {
    return blob;
  }
}

export async function uriToBase64(uri: string, opts?: { preserveAlpha?: boolean }): Promise<string> {
  // На web читает URI и опционально сжимает, на native использует FileSystem Base64.

  if (Platform.OS === "web" || /^(blob:|data:|https?:)/i.test(uri)) {
    const response = await fetch(uri);
    const raw = await response.blob();
    const blob = opts?.preserveAlpha ? raw : await compressImageBlob(raw);
    return blobToBase64(blob);
  }
  const FileSystem = await import("expo-file-system/legacy");
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}

export async function fileToUpload(
  file: File,
  opts?: { preserveAlpha?: boolean },
): Promise<{ base64: string; filename: string; mimeType: string }> {
  // Готовит исторический Base64 payload с именем/MIME и отдельными исключениями для GIF и alpha.

  const isGif = /gif/i.test(file.type || file.name);
  const keepPng = Boolean(opts?.preserveAlpha && /png|webp/i.test(file.type || file.name));

  let blob: Blob = file;
  if (!keepPng && !isGif) {
    try {
      blob = await compressImageBlob(file);
    } catch {
      blob = file;
    }
  }

  const ext = isGif ? "gif" : keepPng ? "png" : "jpg";
  const baseName = (file.name || `photo_${Date.now()}`).replace(/\.[^.]+$/, "");
  return {
    base64: await blobToBase64(blob),
    filename: `${baseName}.${ext}`,
    mimeType: isGif ? "image/gif" : keepPng ? (file.type || "image/png") : "image/jpeg",
  };
}
