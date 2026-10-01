import { useEffect, useState } from "react";
import { Image as RNImage, Platform } from "react-native";

export const FALLBACK_PHOTO_RATIO = 4 / 5;

const ratioCache = new Map<string, number>();

export function getCachedPhotoRatio(uri: string): number | undefined {
  return ratioCache.get(uri);
}

export function rememberPhotoRatio(uri: string, width: number, height: number): number | null {
  if (width <= 0 || height <= 0) return null;
  const ratio = width / height;
  ratioCache.set(uri, ratio);
  return ratio;
}

function probePhotoRatio(uri: string): Promise<number | null> {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return Promise.resolve(null);
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => resolve(rememberPhotoRatio(uri, img.naturalWidth, img.naturalHeight));
      img.onerror = () => resolve(null);
      img.src = uri;
    });
  }

  return new Promise((resolve) => {
    RNImage.getSize(
      uri,
      (width, height) => resolve(rememberPhotoRatio(uri, width, height)),
      () => resolve(null),
    );
  });
}

export function usePhotoAspectRatios(photos: string[], fallback = FALLBACK_PHOTO_RATIO): number[] {
  const key = photos.join("|");
  const [ratios, setRatios] = useState<number[]>(() =>
    photos.map((uri) => ratioCache.get(uri) ?? fallback),
  );

  useEffect(() => {
    setRatios(photos.map((uri) => ratioCache.get(uri) ?? fallback));

    let cancelled = false;
    photos.forEach((uri, index) => {
      if (ratioCache.has(uri)) return;
      void probePhotoRatio(uri).then((ratio) => {
        if (cancelled || ratio == null) return;
        setRatios((prev) => {
          const next = [...prev];
          next[index] = ratio;
          return next;
        });
      });
    });
    return () => {
      cancelled = true;
    };
  }, [key, fallback]);

  return ratios;
}

export function useMediaAspectRatio(
  previewUrl: string | undefined,
  fallback = FALLBACK_PHOTO_RATIO,
): number {
  const [ratio, setRatio] = useState(() =>
    previewUrl ? ratioCache.get(previewUrl) ?? fallback : fallback,
  );

  useEffect(() => {
    if (!previewUrl) {
      setRatio(fallback);
      return;
    }
    if (ratioCache.has(previewUrl)) {
      setRatio(ratioCache.get(previewUrl)!);
      return;
    }
    let cancelled = false;
    void probePhotoRatio(previewUrl).then((next) => {
      if (cancelled) return;
      setRatio(next ?? fallback);
    });
    return () => {
      cancelled = true;
    };
  }, [previewUrl, fallback]);

  return ratio;
}

export function normalizeLinkUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `https://${trimmed}`;
}
