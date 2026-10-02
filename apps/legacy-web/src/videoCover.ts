const YOUTUBE_THUMB_HOST = /(?:i\.ytimg\.com|img\.youtube\.com)/i;

/** Cover URL that works in Russia (YouTube CDN is often blocked). */
export function videoCoverUrl(youtubeId: string, thumbnailUrl?: string | null): string {
  const stored = thumbnailUrl?.trim() ?? "";
  if (stored && !YOUTUBE_THUMB_HOST.test(stored)) return stored;
  return `/media/yt-thumb/${encodeURIComponent(youtubeId)}/hqdefault.jpg`;
}
