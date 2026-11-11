"use client";
/** Здесь собираем видео из старого и нового форматов поста, чтобы карточка не показывала один ролик дважды. */
import {
  splitVideoPhotos,
  mediaBasename,
} from "@/domain/post/post-media-photos";
const VIDEO_URL_RE = /\.(mp4|m4v|mov|webm)(\?.*)?$/i;
export type PostMediaLike = {
  type: string;
  url: string;
  filename?: string | null;
  posterUrl?: string | null;
};
export type ResolvedPostVideo = {
  hasVideo: boolean;
  videoUrl?: string;
  videoFilename?: string;
  posterUrl?: string;
  stackPhotos: string[];
};
export type PostVideoSlide = {
  url: string;
  filename?: string;
  posterUrl?: string;
};
export function isVideoMediaUrl(url: string): boolean {
  return VIDEO_URL_RE.test(url.split("?")[0] || "");
}
/** Preserve every saved video in media order, followed by unrepresented legacy URLs. */
export function resolvePostVideos(
  photos: string[] | undefined,
  media: PostMediaLike[] | undefined,
): { videos: PostVideoSlide[]; stackPhotos: string[] } {
  const list = photos || [];
  const items = (media || []).filter(
    (item) => item.type === "video" && item.url,
  );
  const represented = new Set(items.map((item) => item.url));
  const legacy = list.filter(
    (url) => isVideoMediaUrl(url) && !represented.has(url),
  );
  const photoList = list.filter((url) => !isVideoMediaUrl(url));
  const all: PostMediaLike[] = [
    ...items,
    ...legacy.map((url) => ({ type: "video", url })),
  ];
  let stackPhotos = photoList;
  const videos = all.map((item): PostVideoSlide => {
    const filename = item.filename || mediaBasename(item.url);
    const explicitPoster = item.posterUrl;
    // Private videos keep their own poster, never an unrelated gallery photo.
    if (
      explicitPoster ||
      /^\/api\/media\/post-attachments\/[1-9]\d*$/.test(item.url)
    )
      return {
        url: item.url,
        filename,
        posterUrl: explicitPoster || undefined,
      };
    // Ambiguous legacy covers must not be shared between several videos.
    const { posterUrl, galleryPhotos } = splitVideoPhotos(
      photoList,
      filename,
      all.length === 1,
    );
    stackPhotos = stackPhotos.filter((url) => galleryPhotos.includes(url));
    return { url: item.url, filename, posterUrl };
  });
  return { videos, stackPhotos };
}

/** Compatibility view for callers that need the first video and its photo split. */
export function resolvePostVideo(
  photos: string[] | undefined,
  media: PostMediaLike[] | undefined,
): ResolvedPostVideo {
  const { videos, stackPhotos } = resolvePostVideos(photos, media);
  const first = videos[0];
  if (first) {
    return {
      hasVideo: true,
      videoUrl: first.url,
      videoFilename: first.filename,
      posterUrl: first.posterUrl,
      stackPhotos,
    };
  }
  return { hasVideo: false, stackPhotos };
}
