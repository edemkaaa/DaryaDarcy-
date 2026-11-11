"use client";
/** Определение размеров и нормализация ссылок подготавливают медиа для раскладки, сохраняя ограничения сетевого чтения. */
import { useState } from "react";
import { getCachedPhotoRatio, rememberPhotoRatio } from "./photo-ratio-cache";
import type { ImageProps } from "./image";
export { getCachedPhotoRatio, rememberPhotoRatio } from "./photo-ratio-cache";
export const FALLBACK_PHOTO_RATIO = 4 / 5;

// Learn from the displayed image, never a separate eager network probe.
export function usePhotoAspectRatios(
  photos: string[],
  fallback = FALLBACK_PHOTO_RATIO,
) {
  const key = JSON.stringify(photos);
  const [loaded, setLoaded] = useState<{
    key: string;
    ratios: Map<string, number>;
  }>({ key, ratios: new Map() });
  const ratios = photos.map(
    (uri) =>
      (loaded.key === key ? loaded.ratios.get(uri) : undefined) ??
      getCachedPhotoRatio(uri) ??
      fallback,
  );
  const onLoad =
    (uri: string): NonNullable<ImageProps["onLoad"]> =>
    (event) => {
      const ratio = rememberPhotoRatio(
        uri,
        event.source.width,
        event.source.height,
      );
      if (ratio === null) return;
      setLoaded((previous) => {
        if (previous.key === key && previous.ratios.get(uri) === ratio)
          return previous;
        const next = new Map(previous.key === key ? previous.ratios : []);
        next.set(uri, ratio);
        return { key, ratios: next };
      });
    };
  return { ratios, onLoad };
}
export function normalizeLinkUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `https://${trimmed}`;
}
