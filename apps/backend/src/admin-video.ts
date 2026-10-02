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
  try {
    if (!ENV.s3Endpoint || !ENV.s3Bucket) return false;
    const endpoint = new URL(ENV.s3Endpoint);
    const candidate = new URL(url);
    const prefix = `${endpoint.pathname.replace(/\/$/, "")}/${encodeURIComponent(ENV.s3Bucket)}/`;
    return candidate.protocol === "https:" && candidate.origin === endpoint.origin &&
      !candidate.username && !candidate.password && candidate.pathname.startsWith(prefix) &&
      candidate.pathname.length > prefix.length;
  } catch { return false; }
}

export async function importVideoFromUrl(url: string): Promise<{ url: string; fileSize?: number }> {
  const trimmed = url.trim();
  const blocked = blockedVideoPageReason(trimmed);
  if (blocked) throw new Error(blocked);
  if (isOurStorageUrl(trimmed)) return { url: trimmed };
  // Do not fetch user-controlled URLs: redirects/DNS can reach internal services.
  // Upload local files instead; provider embeds are a separate publishing path.
  throw new Error("Импорт с внешнего адреса отключён. Загрузите видео файлом или выберите файл из своего хранилища.");
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
    console.error("[admin-video] upload failed");
    res.status(500).json({ error: "Не удалось загрузить видео" });
  }
}
