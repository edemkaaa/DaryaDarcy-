/** Проверяем экспортированный адрес VK, сохраняем предоставленный hash и не придумываем отсутствующий. */
import { createHash } from "node:crypto";
import { z } from "zod";
import { publicCatalogThumbnail } from "./video-thumbnail";

// Compatible with the staging player; reject unknown/duplicate parameters rather
// than fetching share links or inventing a private VK hash. VK exports may omit
// hash; when present it must remain intact. No external requests.
/** Без сетевых запросов принимаем только HTTPS video_ext.php известных хостов с уникальными разрешёнными параметрами; сохраняем предоставленный hash, выключаем autoplay и выводим sourceKey лишь из owner/id. */
export function parseVkEmbed(raw: string) {
  if (!raw || raw.length > 2048) return null;
  try {
    const url = new URL(raw);
    if (
      url.protocol !== "https:" ||
      !["vk.com", "vk.ru", "vkvideo.ru"].includes(url.hostname) ||
      url.port ||
      url.username ||
      url.password ||
      url.hash ||
      url.pathname !== "/video_ext.php"
    )
      return null;
    const allowed = ["oid", "id", "hash", "hd", "autoplay"];
    for (const key of url.searchParams.keys())
      if (!allowed.includes(key) || url.searchParams.getAll(key).length !== 1)
        return null;
    const oid = url.searchParams.get("oid"),
      id = url.searchParams.get("id"),
      hash = url.searchParams.get("hash");
    if (
      !oid ||
      !/^-?[1-9]\d{0,19}$/.test(oid) ||
      !id ||
      !/^[1-9]\d{0,19}$/.test(id) ||
      (hash !== null && !/^[a-zA-Z0-9_-]{8,128}$/.test(hash))
    )
      return null;
    const hd = url.searchParams.get("hd"),
      autoplay = url.searchParams.get("autoplay");
    if (
      (hd !== null && !/^[0-3]$/.test(hd)) ||
      (autoplay !== null && !/^[01]$/.test(autoplay))
    )
      return null;
    const player = new URL("/video_ext.php", url.origin);
    player.searchParams.set("oid", oid);
    player.searchParams.set("id", id);
    if (hash !== null) player.searchParams.set("hash", hash);
    if (hd !== null) player.searchParams.set("hd", hd);
    player.searchParams.set("autoplay", "0");
    return {
      embedUrl: player.toString(),
      sourceKey: createHash("sha256")
        .update(JSON.stringify([oid, id]))
        .digest("hex"),
    };
  } catch {
    return null;
  }
}
export const vkVideoInput = z
  .object({
    embedUrl: z
      .string()
      .max(2048)
      .refine((value) => parseVkEmbed(value) !== null),
    title: z.string().trim().min(1).max(512),
    access: z.enum(["public", "club"]),
    published: z.boolean(),
    // Omission preserves the cover on update; null explicitly clears it.
    thumbnailUrl: z
      .string()
      .max(2048)
      .transform((value, ctx) => {
        const thumbnail = publicCatalogThumbnail(value);
        if (thumbnail === null) {
          ctx.addIssue({
            code: "custom",
            message: "Некорректный адрес публичной обложки",
          });
          return z.NEVER;
        }
        return thumbnail;
      })
      .nullable()
      .optional(),
    id: z.number().int().positive().safe().optional(),
    expectedRevision: z.number().int().nonnegative().safe().optional(),
  })
  .strict();
export type VkVideoInput = z.infer<typeof vkVideoInput>;
