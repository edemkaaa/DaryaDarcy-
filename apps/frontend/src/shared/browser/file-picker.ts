"use client";
/** Адаптер выбора файлов переводит браузерные File в формат существующих редакторов и применяет ограничения до чтения содержимого. */
import {
  chooseFiles,
  readFileDataUrl,
  MAX_VIDEO_BYTES,
  type FileSelectionOptions,
} from "./file-operations";
import { runFileTask } from "./file-task";
export type ImagePickerAsset = {
  uri: string;
  width: number;
  height: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  file: File;
  base64?: string;
};
export const MediaTypeOptions = {
  Images: "images",
  Videos: "videos",
  All: "all",
};
export async function requestMediaLibraryPermissionsAsync() {
  return { status: "granted", granted: true };
}
export async function launchImageLibraryAsync(
  options: FileSelectionOptions & {
    mediaTypes?: string | string[];
    allowsMultipleSelection?: boolean;
    base64?: boolean;
    [key: string]: unknown;
  } = {},
) {
  const video =
    options.mediaTypes === "videos" ||
    (Array.isArray(options.mediaTypes) &&
      options.mediaTypes.includes("videos"));
  const files = await chooseFiles(
    video ? "video/*" : "image/*",
    options.allowsMultipleSelection,
    {
      ...options,
      maxBytes: options.maxBytes ?? (video ? MAX_VIDEO_BYTES : undefined),
    },
  );
  const assets: ImagePickerAsset[] = [];
  // Profile cropping persists a data URL; avoid simultaneous reads of all selected files.
  for (const file of files) {
    const uri = await runFileTask(
      (signal) => readFileDataUrl(file, signal),
      options.signal,
    );
    const asset: ImagePickerAsset = {
      uri,
      width: 0,
      height: 0,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      file,
    };
    if (file.type.startsWith("image/")) {
      const size = await runFileTask(
        (signal) =>
          new Promise<{ width: number; height: number }>((resolve, reject) => {
            const image = new Image();
            const cleanup = () => {
              signal.removeEventListener("abort", cancel);
              image.onload = image.onerror = null;
              image.removeAttribute("src");
            };
            const cancel = () => {
              cleanup();
              reject(signal.reason);
            };
            image.onload = () => {
              const size = {
                width: image.naturalWidth,
                height: image.naturalHeight,
              };
              cleanup();
              resolve(size);
            };
            image.onerror = () => {
              cleanup();
              reject(new Error("Не удалось прочитать фото"));
            };
            signal.addEventListener("abort", cancel, { once: true });
            image.src = uri;
          }),
        options.signal,
      );
      asset.width = size.width;
      asset.height = size.height;
    }
    if (options.base64) asset.base64 = uri.split(",")[1];
    assets.push(asset);
  }
  return { canceled: !assets.length, assets };
}
export async function getDocumentAsync(
  options: FileSelectionOptions & {
    type?: string | string[];
    multiple?: boolean;
    createPreviewUrl?: boolean;
    [key: string]: unknown;
  } = {},
) {
  const files = await chooseFiles(
    Array.isArray(options.type)
      ? options.type.join(",")
      : options.type || "*/*",
    options.multiple,
    options,
  );
  options.signal?.throwIfAborted();
  return {
    canceled: !files.length,
    assets: files.map((file) => ({
      uri: options.createPreviewUrl === false ? "" : URL.createObjectURL(file),
      name: file.name,
      mimeType: file.type,
      size: file.size,
      file,
    })),
  };
}
