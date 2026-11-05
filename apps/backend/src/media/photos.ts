import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { storagePut } from "../storage";
import { rejectLegacyUpload } from "./legacy-upload-policy";

// Defense in depth for GHSA-wq5f-xc86-pv6w: no API feature needs SVG decoding.
// Block the native loader family even if a future caller misses the byte gate.
sharp.block({ operation: ["VipsForeignLoadSvg"] });

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
const MAX_PIXELS = 20_000_000;
let decoding = 0;

// Legacy filename/MIME remain accepted for client compatibility, never trusted.
export const photoInput = z.object({
  base64: z.string().min(4).max(4 * Math.ceil(MAX_PHOTO_BYTES / 3)),
  filename: z.string().max(256),
  mimeType: z.string().max(128).default("image/jpeg"),
});
export const publicCoverPhotoInput = photoInput.extend({ purpose: z.literal("publicCover") });

/** Decode/re-encode on every photo boundary; keys and MIME are server-owned. */
export async function preparePhoto(base64: string): Promise<Buffer> {
  if (base64.length > 4 * Math.ceil(MAX_PHOTO_BYTES / 3) ||
      base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Некорректное фото" });
  }
  const bytes = Buffer.from(base64, "base64");
  if (bytes.length > MAX_PHOTO_BYTES || bytes.toString("base64") !== base64) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Некорректное фото или размер больше 4 МБ" });
  }
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!jpeg && !png && !webp) throw new TRPCError({ code: "BAD_REQUEST", message: "Нужно фото JPEG, PNG или WebP" });
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
  return output;
}

export async function uploadPhoto(
  base64: string,
  folder: string,
  signal?: AbortSignal,
  authorizeStorageWrite?: () => Promise<void>,
): Promise<{ url: string }> {
  // Public images have an explicit purpose; arbitrary content folders are retired.
  if (folder !== "covers" && !/^avatars\/[1-9]\d*$/.test(folder)) rejectLegacyUpload();
  signal?.throwIfAborted();
  const output = await preparePhoto(base64);
  signal?.throwIfAborted();
  if (authorizeStorageWrite) {
    await authorizeStorageWrite();
    signal?.throwIfAborted();
  }
  const stored = await storagePut(`${folder}/${randomUUID()}.webp`, output, "image/webp", { signal });
  return { url: stored.url };
}
