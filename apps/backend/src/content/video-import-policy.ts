import { ENV } from "../_core/env";

/** User guidance only; storage-origin validation below is the acceptance boundary. */
export function blockedVideoPageReason(url: string): string | null {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "Некорректная ссылка";
  }
  if (
    host.includes("instagram.com") ||
    host.includes("cdninstagram.com") ||
    host === "instagr.am"
  ) {
    return "Instagram не отдаёт видео по ссылке. Скачайте ролик на телефон и загрузите файлом.";
  }
  if (host.includes("youtube.com") || host.includes("youtu.be")) {
    return "Ссылку YouTube публикуйте в разделе «Видео». Для ленты загрузите файл или прямую ссылку на mp4.";
  }
  if (host.includes("tiktok.com")) {
    return "TikTok не отдаёт видео по ссылке. Скачайте файл и загрузите его сюда.";
  }
  if (host.includes("facebook.com") || host.includes("fb.watch")) {
    return "Facebook не отдаёт видео по ссылке. Загрузите файл.";
  }
  return null;
}

/** Matching a configured location proves neither object existence nor ownership. */
export function isOurStorageUrl(url: string): boolean {
  try {
    if (!ENV.s3Endpoint || !ENV.s3Bucket) return false;
    const endpoint = new URL(ENV.s3Endpoint);
    const candidate = new URL(url);
    const prefix = `${endpoint.pathname.replace(/\/$/, "")}/${encodeURIComponent(ENV.s3Bucket)}/`;
    return (
      candidate.protocol === "https:" &&
      candidate.origin === endpoint.origin &&
      !candidate.username &&
      !candidate.password &&
      candidate.pathname.startsWith(prefix) &&
      candidate.pathname.length > prefix.length
    );
  } catch {
    return false;
  }
}
