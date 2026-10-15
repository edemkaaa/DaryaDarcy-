"use client";
import {
  MAX_ATTACHMENT_BYTES,
  chooseFiles,
  readResponseBlob,
  readFileDataUrl,
  validateFileSize,
  type FileSelectionOptions,
} from "@/shared/browser/file-operations";
import { runFileTask } from "@/shared/browser/file-task";
import { runApiRequest } from "@/shared/api/request-lifecycle";

export function pickWebFiles(
  accept: string,
  multiple: boolean,
  options?: FileSelectionOptions,
): Promise<File[]> {
  return chooseFiles(accept, multiple, options);
}
export async function blobToBase64(
  blob: Blob,
  signal?: AbortSignal,
): Promise<string> {
  const result = await runFileTask(
    (taskSignal) => readFileDataUrl(blob, taskSignal),
    signal,
  );
  return result.slice(result.indexOf(",") + 1);
}
function fileName(blob: Blob): string {
  return typeof File !== "undefined" && blob instanceof File ? blob.name : "";
}
const imageTypes: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  bmp: "image/bmp",
};
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

/** Reject animation before canvas can silently reduce it to a single frame. */
async function assertStaticImage(blob: Blob, signal?: AbortSignal) {
  const bytes = new Uint8Array(
    await runFileTask(() => blob.arrayBuffer(), signal),
  );
  const tag = (offset: number, length = 4) =>
    String.fromCharCode(...bytes.subarray(offset, offset + length));
  const animated = () => {
    throw new Error(
      "Анимированные изображения не поддерживаются. Выберите обычное фото JPG, PNG или WebP.",
    );
  };
  if (tag(0, 3) === "GIF" || imageType(blob) === "image/gif") animated();
  const png = bytes[0] === 137 && tag(1, 3) === "PNG";
  const webp = tag(0) === "RIFF" && tag(8) === "WEBP";
  if (!png && !webp) return;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = png ? 8 : 12; offset + 8 <= bytes.length; ) {
    const length = view.getUint32(png ? offset : offset + 4, webp);
    const name = tag(png ? offset + 4 : offset);
    if (name === "acTL" || name === "ANIM" || name === "ANMF") animated();
    const next = offset + 8 + length + (png ? 4 : length % 2);
    if (next > bytes.length) break;
    offset = next;
  }
}
function imageType(blob: Blob): string {
  const type = blob.type.toLowerCase();
  if (type && type !== "application/octet-stream") return type;
  return (
    imageTypes[fileName(blob).split(".").at(-1)?.toLowerCase() ?? ""] ?? ""
  );
}
function isHeicLike(blob: Blob): boolean {
  return /heic|heif/i.test(imageType(blob));
}

type Drawable = {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  release: () => void;
};
async function loadDrawableFromBlob(
  blob: Blob,
  signal: AbortSignal,
): Promise<Drawable> {
  if (typeof createImageBitmap !== "undefined" && !isHeicLike(blob)) {
    try {
      const bitmap = await createImageBitmap(blob);
      if (signal.aborted) {
        bitmap.close();
        signal.throwIfAborted();
      }
      let released = false;
      return {
        width: bitmap.width,
        height: bitmap.height,
        draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
        release: () => {
          if (!released) {
            released = true;
            bitmap.close();
          }
        },
      };
    } catch (error) {
      signal.throwIfAborted();
      void error;
    }
  }
  const url = URL.createObjectURL(blob);
  const img = document.createElement("img");
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    img.onload = img.onerror = null;
    img.removeAttribute("src");
    URL.revokeObjectURL(url);
  };
  try {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => signal.removeEventListener("abort", cancel);
      const cancel = () => {
        cleanup();
        release();
        reject(signal.reason);
      };
      img.onload = () => {
        cleanup();
        resolve();
      };
      img.onerror = () => {
        cleanup();
        reject(
          new Error("Не удалось прочитать фото. Попробуйте JPG, PNG или WebP."),
        );
      };
      signal.addEventListener("abort", cancel, { once: true });
      signal.throwIfAborted();
      img.src = url;
    });
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      release,
    };
  } catch (error) {
    release();
    throw error;
  }
}
export async function compressImageBlob(
  blob: Blob,
  maxEdge = 1920,
  quality = 0.82,
  signal?: AbortSignal,
  outputType: "image/jpeg" | "image/webp" = "image/jpeg",
): Promise<Blob> {
  signal?.throwIfAborted();
  if (
    typeof document === "undefined" ||
    !Object.values(imageTypes).includes(imageType(blob))
  )
    return blob;
  if (imageType(blob) === "image/gif") return blob;
  return runFileTask(async (taskSignal) => {
    const drawable = await loadDrawableFromBlob(blob, taskSignal);
    const canvas = document.createElement("canvas");
    try {
      taskSignal.throwIfAborted();
      if (!drawable.width || !drawable.height)
        throw new Error("Не удалось определить размер фото");
      const scale = Math.min(
        1,
        maxEdge / Math.max(drawable.width, drawable.height),
      );
      canvas.width = Math.max(1, Math.round(drawable.width * scale));
      canvas.height = Math.max(1, Math.round(drawable.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Не удалось подготовить фото");
      drawable.draw(ctx, canvas.width, canvas.height);
      // Release decoded sources even if canvas.toBlob never calls back.
      drawable.release();
      const compressed = await new Promise<Blob | null>((resolve, reject) => {
        const cancel = () => {
          canvas.width = canvas.height = 0;
          reject(taskSignal.reason);
        };
        taskSignal.addEventListener("abort", cancel, { once: true });
        try {
          canvas.toBlob(
            (blob) => {
              taskSignal.removeEventListener("abort", cancel);
              resolve(blob);
            },
            outputType,
            quality,
          );
        } catch (error) {
          taskSignal.removeEventListener("abort", cancel);
          reject(error);
        }
      });
      taskSignal.throwIfAborted();
      if (!compressed) throw new Error("Не удалось подготовить фото");
      return compressed;
    } finally {
      drawable.release();
      canvas.width = canvas.height = 0;
    }
  }, signal);
}
async function preparePhotoBlob(
  raw: Blob,
  opts?: { preserveAlpha?: boolean; signal?: AbortSignal },
): Promise<Blob> {
  validateFileSize(raw);
  if (!Object.values(imageTypes).includes(imageType(raw)))
    throw new Error(
      "Неподдерживаемый формат фото. Выберите JPG, PNG, WebP, AVIF, HEIC или BMP.",
    );
  await assertStaticImage(raw, opts?.signal);
  const outputType = opts?.preserveAlpha ? "image/webp" : "image/jpeg";
  // WebKit may fall back to PNG instead of encoding WebP. No quality knob then
  // reduces its size; keep one smaller fallback while preserving transparency.
  for (const maxEdge of [1920, 1440, 1080, 960]) {
    const blob = await compressImageBlob(
      raw,
      maxEdge,
      0.82,
      opts?.signal,
      outputType,
    );
    opts?.signal?.throwIfAborted();
    if (!["image/jpeg", "image/png", "image/webp"].includes(blob.type))
      throw new Error(
        "Не удалось подготовить фото. Попробуйте JPG, PNG или WebP.",
      );
    if (blob.size <= MAX_PHOTO_BYTES) {
      validateFileSize(blob, MAX_PHOTO_BYTES);
      return blob;
    }
  }
  throw new Error(
    "Подготовленное фото больше 4 МБ. Уменьшите изображение или выберите другое.",
  );
}
export async function uriToBase64(
  uri: string,
  opts?: { preserveAlpha?: boolean; signal?: AbortSignal },
): Promise<string> {
  const raw = await runApiRequest(
    uri,
    { signal: opts?.signal },
    async (response) => {
      if (!response.ok) throw new Error("Не удалось прочитать фото");
      return readResponseBlob(response, MAX_ATTACHMENT_BYTES, opts?.signal);
    },
  );
  const blob = await preparePhotoBlob(raw, opts);
  return blobToBase64(blob, opts?.signal);
}
export async function fileForPhotoUpload(
  file: File,
  opts?: { preserveAlpha?: boolean; signal?: AbortSignal },
): Promise<File> {
  opts?.signal?.throwIfAborted();
  const blob = await preparePhotoBlob(file, opts);
  opts?.signal?.throwIfAborted();
  const mimeType = blob.type;
  const ext =
    Object.keys(imageTypes).find((key) => imageTypes[key] === mimeType) ??
    file.name.split(".").at(-1) ??
    "jpg";
  const baseName = (file.name || `photo_${Date.now()}`).replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}.${ext}`, {
    type: mimeType,
    lastModified: file.lastModified,
  });
}
export async function fileToUpload(
  file: File,
  opts?: { preserveAlpha?: boolean; signal?: AbortSignal },
): Promise<{ base64: string; filename: string; mimeType: string }> {
  const prepared = await fileForPhotoUpload(file, opts);
  return {
    base64: await blobToBase64(prepared, opts?.signal),
    filename: prepared.name,
    mimeType: prepared.type,
  };
}
