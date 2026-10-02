import type { Request, Response } from "express";
import { isOwnerAccount } from "./db";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { storagePut } from "./storage";

export const MAX_VIDEO_BYTES = 80 * 1024 * 1024;

function isAdminUser(user: { role?: string | null; email?: string | null; openId?: string | null }) {
  return isOwnerAccount(user);
}

function safeVideoFilename(name: string): string {
  const base = (name || "video.mp4").split(/[\\/]/).pop() || "video.mp4";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  return cleaned || "video.mp4";
}

function guessExt(url: string, contentType: string): string {
  if (contentType.includes("webm")) return ".webm";
  if (contentType.includes("quicktime")) return ".mov";
  if (/\.webm(\?|$)/i.test(url)) return ".webm";
  if (/\.mov(\?|$)/i.test(url)) return ".mov";
  if (/\.m4v(\?|$)/i.test(url)) return ".m4v";
  return ".mp4";
}

export function blockedVideoPageReason(url: string): string | null {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return "Некорректная ссылка";
  }
  if (host.includes("instagram.com") || host.includes("cdninstagram.com") || host === "instagr.am") {
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

export function isOurStorageUrl(url: string): boolean {
  const endpoint = (ENV.s3Endpoint || "").replace(/\/$/, "");
  const bucket = ENV.s3Bucket || "";
  if (endpoint && url.startsWith(endpoint)) return true;
  if (url.includes("twcstorage.ru") && url.includes("daryadarcy")) return true;
  if (bucket && url.includes(`/${bucket}/`)) return true;
  return false;
}

export async function importVideoFromUrl(url: string): Promise<{ url: string; fileSize?: number }> {
  const trimmed = url.trim();
  const blocked = blockedVideoPageReason(trimmed);
  if (blocked) throw new Error(blocked);
  if (isOurStorageUrl(trimmed)) return { url: trimmed };

  const res = await fetch(trimmed, {
    redirect: "follow",
    headers: { "User-Agent": "Mozilla/5.0 (compatible; DaryaDarcy/1.0)" },
  });
  if (!res.ok) {
    throw new Error(`Не удалось скачать видео (${res.status}). Нужна прямая ссылка на файл или загрузите его с телефона.`);
  }
  const contentLength = res.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_VIDEO_BYTES) {
    throw new Error("Видео больше 80 МБ. Сожмите ролик или загрузите более короткий файл.");
  }
  const contentType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const looksVideo =
    contentType.startsWith("video/") ||
    /\.(mp4|mov|webm|m4v)(\?|$)/i.test(trimmed) ||
    contentType.includes("octet-stream") ||
    contentType.includes("binary") ||
    !contentType;
  if (!looksVideo) {
    throw new Error("Нужна прямая ссылка на видеофайл (mp4) или загрузите файл с телефона.");
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_VIDEO_BYTES) {
    throw new Error("Видео больше 80 МБ. Сожмите ролик или загрузите более короткий файл.");
  }
  if (buffer.length < 64) {
    throw new Error("По этой ссылке нет видеофайла. Загрузите ролик файлом.");
  }

  const mime = contentType.startsWith("video/") ? contentType : "video/mp4";
  const key = `feed/reels/${Date.now()}_import${guessExt(trimmed, mime)}`;
  const put = await storagePut(key, buffer, mime);
  return { url: put.url, fileSize: buffer.length };
}

async function requireAdmin(req: Request, res: Response) {
  let user;
  try {
    user = await sdk.authenticateRequest(req);
  } catch {
    res.status(401).json({ error: "Нужно войти" });
    return null;
  }
  if (!isAdminUser(user)) {
    res.status(403).json({ error: "Только для администратора" });
    return null;
  }
  return user;
}

export async function handleAdminVideoUpload(req: Request, res: Response) {
  try {
    const user = await requireAdmin(req, res);
    if (!user) return;

    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      res.status(400).json({ error: "Пустой файл" });
      return;
    }
    if (body.length > MAX_VIDEO_BYTES) {
      res.status(413).json({ error: "Видео больше 80 МБ. Сожмите ролик или загрузите более короткий файл." });
      return;
    }

    const filenameRaw = typeof req.query.filename === "string" ? req.query.filename : "video.mp4";
    const mimeHeader = (req.headers["content-type"] || "video/mp4").split(";")[0].trim().toLowerCase();
    const mime = mimeHeader.startsWith("video/") ? mimeHeader : "video/mp4";
    const key = `feed/reels/${Date.now()}_${safeVideoFilename(filenameRaw)}`;
    const put = await storagePut(key, body, mime);
    res.json({ url: put.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось загрузить видео";
    console.error("[admin-video] upload failed:", error);
    res.status(500).json({ error: message });
  }
}
