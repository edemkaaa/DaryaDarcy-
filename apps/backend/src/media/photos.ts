import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { storagePut } from "../storage";

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const MAX_PIXELS = 20_000_000;
let decoding = 0;

// Legacy filename/MIME remain accepted for client compatibility, never trusted.
export const photoInput = z.object({
  base64: z.string().min(4).max(4 * Math.ceil(MAX_PHOTO_BYTES / 3)),
  filename: z.string().max(256),
  mimeType: z.string().max(128).default("image/jpeg"),
});

/** Decode/re-encode on every photo boundary; keys and MIME are server-owned. */
export async function uploadPhoto(base64: string, folder: string): Promise<{ url: string }> {
  if (base64.length > 4 * Math.ceil(MAX_PHOTO_BYTES / 3) ||
      base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Некорректное фото" });
  }
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > MAX_PHOTO_BYTES || bytes.toString("base64") !== base64) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Некорректное фото или размер больше 4 МБ" });
  }
  // Bound native decoder pressure even if one user starts many concurrent calls.
  if (decoding >= 4) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Загрузка занята. Повторите позже" });
  decoding++;
  let output: Buffer;
  try {
    const image = sharp(bytes, { failOn: "warning", limitInputPixels: MAX_PIXELS });
    const metadata = await image.metadata();
    if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format) || (metadata.pages ?? 1) > 1) {
      throw new Error("unsupported image");
    }
    // Default output strips EXIF/XMP; auto-orient before removing Orientation.
    output = await image.rotate().resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 }).timeout({ seconds: 10 }).toBuffer();
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Нужно обычное фото JPEG, PNG или WebP до 4 МБ" });
  } finally {
    decoding--;
  }
  const stored = await storagePut(`${folder}/${randomUUID()}.webp`, output, "image/webp");
  return { url: stored.url };
}
