// Архив Expo. Определяет прямое видео по поддерживаемому расширению пути без query.
import { splitVideoPhotos, mediaBasename } from "@/lib/post-media-photos";

const VIDEO_URL_RE = /\.(mp4|m4v|mov|webm)(\?.*)?$/i;

export type PostMediaLike = {
  type: string;
  url: string;
  filename?: string | null;
};

export type ResolvedPostVideo = {
  hasVideo: boolean;
  videoUrl?: string;
  videoFilename?: string;
  posterUrl?: string;
  stackPhotos: string[];
};

export function isVideoMediaUrl(url: string): boolean {
  // Определяет прямое видео по поддерживаемому расширению пути без query.

  return VIDEO_URL_RE.test(url.split("?")[0] || "");
}

/** Resolve video + gallery photos from post_media and/or legacy video URLs in photos[]. */
export function resolvePostVideo(
  photos: string[] | undefined,
  media: PostMediaLike[] | undefined,
): ResolvedPostVideo {
  // Предпочитает post_media.video, иначе исторический видео-URL в photos; отдельно собирает poster и галерею.

  const list = photos || [];
  const videoItem = media?.find((m) => m.type === "video");

  if (videoItem?.url) {
    const videoFilename = videoItem.filename || mediaBasename(videoItem.url);
    const { posterUrl, galleryPhotos } = splitVideoPhotos(list, videoFilename);
    return {
      hasVideo: true,
      videoUrl: videoItem.url,
      videoFilename,
      posterUrl,
      stackPhotos: galleryPhotos,
    };
  }

  const videoIndex = list.findIndex(isVideoMediaUrl);
  if (videoIndex >= 0) {
    const videoUrl = list[videoIndex];
    const rest = list.filter((_, index) => index !== videoIndex);
    const { posterUrl, galleryPhotos } = splitVideoPhotos(rest);
    return {
      hasVideo: true,
      videoUrl,
      videoFilename: mediaBasename(videoUrl),
      posterUrl,
      stackPhotos: galleryPhotos,
    };
  }

  return { hasVideo: false, stackPhotos: list };
}
