"use client";
import {
  chooseFiles,
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
            "image/jpeg",
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
export async function uriToBase64(
  uri: string,
  opts?: { preserveAlpha?: boolean; signal?: AbortSignal },
): Promise<string> {
  const raw = await runApiRequest(
    uri,
    { signal: opts?.signal },
    async (response) => {
      if (!response.ok) throw new Error("Не удалось прочитать фото");
      const blob = await response.blob();
      validateFileSize(blob);
      return blob;
    },
  );
  const blob = opts?.preserveAlpha
    ? raw
    : await compressImageBlob(raw, 1920, 0.82, opts?.signal);
  return blobToBase64(blob, opts?.signal);
}
export async function fileToUpload(
  file: File,
  opts?: { preserveAlpha?: boolean; signal?: AbortSignal },
): Promise<{ base64: string; filename: string; mimeType: string }> {
  opts?.signal?.throwIfAborted();
  validateFileSize(file);
  const originalType = imageType(file);
  if (!Object.values(imageTypes).includes(originalType))
    throw new Error(
      "Неподдерживаемый формат фото. Выберите JPG, PNG, WebP, GIF, AVIF, HEIC или BMP.",
    );
  const keepOriginal =
    originalType === "image/gif" ||
    (opts?.preserveAlpha && ["image/png", "image/webp"].includes(originalType));
  const blob = keepOriginal
    ? file
    : await compressImageBlob(file, 1920, 0.82, opts?.signal);
  opts?.signal?.throwIfAborted();
  const mimeType =
    blob.type && blob.type !== "application/octet-stream"
      ? blob.type
      : originalType;
  const ext =
    Object.keys(imageTypes).find((key) => imageTypes[key] === mimeType) ??
    file.name.split(".").at(-1) ??
    "jpg";
  const baseName = (file.name || `photo_${Date.now()}`).replace(/\.[^.]+$/, "");
  return {
    base64: await blobToBase64(blob, opts?.signal),
    filename: `${baseName}.${ext}`,
    mimeType,
  };
}
