"use client";
import { useEffect, useState } from "react";
import type { Season } from "@shared/launch-settings";
import { runFileTask } from "@/shared/browser/file-task";
import { resolveImageAttributes } from "@/shared/ui/static-images";

async function prepareImage(uri: string, signal: AbortSignal) {
  return runFileTask(async (taskSignal) => {
    const image = new Image();
    const resolved = resolveImageAttributes(uri);
    const cancel = () => {
      image.removeAttribute("srcset");
      image.removeAttribute("src");
    };
    taskSignal.addEventListener("abort", cancel, { once: true });
    try {
      image.decoding = "async";
      image.fetchPriority = "high";
      if (resolved.sizes) image.sizes = resolved.sizes;
      if (resolved.srcSet) image.srcset = resolved.srcSet;
      image.src = resolved.src!;
      await image.decode();
      taskSignal.throwIfAborted();
      return image;
    } finally {
      taskSignal.removeEventListener("abort", cancel);
    }
  }, signal);
}

/** Publish the pair together; retain the confirmed theme during later loads. */
export function usePreparedAppearance(
  season: Season | null,
  background: string | null,
  banner: string | null,
  onError: (uri: string | null) => void,
) {
  const [prepared, setPrepared] = useState<{
    season: Season;
    background: string | null;
    banner: string | null;
    bannerSize: { width: number; height: number } | null;
    images: HTMLImageElement[];
  } | null>(null);

  useEffect(() => {
    if (!season) return;
    const controller = new AbortController();
    const { signal } = controller;
    const urls = [
      ...new Set([background, banner].filter((uri) => uri !== null)),
    ];
    void Promise.all(
      urls.map(async (uri) => {
        try {
          return await prepareImage(uri, signal);
        } catch {
          if (!signal.aborted) onError(uri);
          return null;
        }
      }),
    ).then((images) => {
      if (signal.aborted || images.some((image) => image === null)) return;
      const preparedImages = images as HTMLImageElement[];
      const bannerImage = banner
        ? preparedImages[urls.indexOf(banner)]
        : undefined;
      setPrepared({
        season,
        background,
        banner,
        // Use the existing decode, and publish dimensions with their own URL.
        bannerSize:
          bannerImage &&
          bannerImage.naturalWidth > 0 &&
          bannerImage.naturalHeight > 0
            ? {
                width: bannerImage.naturalWidth,
                height: bannerImage.naturalHeight,
              }
            : null,
        // Retain decoded resources until their replacement is ready.
        images: preparedImages,
      });
    });
    return () => controller.abort();
  }, [season, background, banner, onError]);

  return prepared;
}
