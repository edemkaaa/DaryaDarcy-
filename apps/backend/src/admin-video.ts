import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { isOwnerAccount } from "./db";
import { sdk } from "./_core/sdk";
import { storagePut } from "./storage";
import {
  normalizeMediaContentType,
  resolveMediaContentType,
} from "./content/media-content-type";

export const MAX_VIDEO_BYTES = 80 * 1024 * 1024;

function isAdminUser(user: { role?: string | null; email?: string | null; openId?: string | null }) {
  return isOwnerAccount(user);
}

function safeVideoFilename(name: string): string {
  const base = (name || "video.mp4").split(/[\\/]/).pop() || "video.mp4";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  return cleaned || "video.mp4";
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
    let mime: string;
    try {
      const declared = normalizeMediaContentType(
        "video",
        req.headers["content-type"] ?? "video/mp4",
      );
      mime = await resolveMediaContentType("video", declared, body);
    } catch (error) {
      // Only trusted input-policy failures are 400; provider/worker failures stay 500.
      if (!(error instanceof TRPCError) || error.code !== "BAD_REQUEST") throw error;
      res.status(400).json({ error: "Некорректный видеофайл" });
      return;
    }
    // Clock precision cannot isolate same-name uploads; identity is server-owned.
    const key = `feed/reels/${randomUUID()}_${safeVideoFilename(filenameRaw)}`;
    const put = await storagePut(key, body, mime);
    res.json({ url: put.url });
  } catch (error) {
    console.error("[admin-video] upload failed");
    res.status(500).json({ error: "Не удалось загрузить видео" });
  }
}
