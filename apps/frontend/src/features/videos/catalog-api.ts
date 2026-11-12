/** Парсеры каталога и воспроизведения отделяют метаданные карточки от источника, для которого сервер проверяет доступ. */
import { z } from "zod";
import { invalidResponse } from "@/shared/api/errors";
import { getVkVideoEmbedUrl } from "@/shared/media/vk-video-url";
import { safeExternalUrl } from "@/shared/navigation/external-url";

/** Флаг сборки выбирает новый каталог; это не проверка наличия серверного доступа к отдельному ролику. */
export const isVkCatalogEnabled = () =>
  process.env.NEXT_PUBLIC_VK_CATALOG_ENABLED === "true";
// Enable only after the opt-in catalog and VK save contracts are deployed.
/** Запрашиваем расширенный контракт обложек только после согласованного opt-in выпуска. */
export const isVideoThumbnailsEnabled = () =>
  process.env.NEXT_PUBLIC_VIDEO_THUMBNAILS_ENABLED === "true";
/** Собираем wire-input без неопределённых полей, добавляя includeThumbnails только при включённой возможности. */
export function videoCatalogInput(limit: number, cursor?: number) {
  return {
    limit,
    ...(isVideoThumbnailsEnabled() ? { includeThumbnails: true as const } : {}),
    ...(cursor === undefined ? {} : { cursor }),
  };
}
/** При редактировании допускаем документированные публичные местоположения обложек без query и неоднозначных кодировок; это не общий парсер просмотра. */
export function normalizeVkThumbnailUrl(value: string): string | null {
  if (value.length > 2048) return null;
  const raw = value.trim();
  if (!raw || /[\u0000-\u0020\u007f\\]/.test(raw)) return null;
  try {
    const url = new URL(raw, "https://thumbnail.invalid");
    if (url.search || url.hash || url.username || url.password || url.port)
      return null;
    // Reject ambiguous encodings and dot-segment traversal before normalization.
    if (/%|(?:^|\/)\.{1,2}(?:\/|$)/.test(raw)) return null;
    if (/^\/assets\/responsive\/[\w.-]+\.(?:webp|png|jpe?g|avif)$/i.test(raw))
      return raw;
    if (
      /^https:\/\//i.test(raw) &&
      url.protocol === "https:" &&
      url.hostname === "s3.twcstorage.ru" &&
      (/^\/daryadarcy-s3\/(?:feed|app-assets)\/[\w/.-]+\.(?:webp|png|jpe?g|avif)$/i.test(
        url.pathname,
      ) ||
        /^\/daryadarcy-s3\/covers\/(?:public-v1\/)?[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}\.webp$/i.test(
          url.pathname,
        ) ||
        /^\/daryadarcy-s3\/covers\/vk-v1\/[a-f0-9]{64}\/[a-f0-9]{64}\.webp$/i.test(
          url.pathname,
        ))
    )
      return url.href;
  } catch {
    // A malformed address is a form error, never an instruction to remove a cover.
  }
  return null;
}
const id = z.number().int().positive().safe();
const card = z
  .object({
    id,
    title: z.string(),
    duration: z.string().nullable(),
    access: z.enum(["public", "club"]),
    canWatch: z.boolean(),
    // Compatibility first: deployed APIs may omit covers until their rollout.
    thumbnailUrl: z.string().nullable().optional(),
  })
  .strict();
const page = z
  .object({ items: z.array(card).max(100), nextCursor: id.nullable() })
  .strict();
export type VideoCard = z.infer<typeof card>;
/** Для показа принимаем безопасную картинку, исключая защищённое API и адрес самого iframe-провайдера. */
export function videoThumbnailUrl(
  value: string | null | undefined,
): string | null {
  const url = safeExternalUrl(value);
  if (!url || !/^(https?:\/\/|\/)/.test(url)) return null;
  const path = new URL(url, "https://thumbnail.invalid").pathname;
  // A preview must never request a protected file or a provider player.
  if (path.startsWith("/api/") || /\/(?:video_ext\.php|embed\/)/.test(path))
    return null;
  return url;
}
/** Проверяем strict форму карточек и страницы до помещения ответа в query-кеш. */
export function parseVideoCatalog(value: unknown) {
  const result = page.safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data;
}
/** Дополнительно ограничиваем каталог разрешёнными уникальными параметрами iframe, затем применяем общий VK-парсер. */
export function getVkCatalogEmbedUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    const allowed = ["oid", "id", "hash", "hd", "autoplay"];
    if (
      url.hash ||
      [...url.searchParams.keys()].some(
        (name) =>
          !allowed.includes(name) || url.searchParams.getAll(name).length !== 1,
      )
    )
      return null;
    const hd = url.searchParams.get("hd"),
      autoplay = url.searchParams.get("autoplay");
    if (
      (hd !== null && !/^[0-3]$/.test(hd)) ||
      (autoplay !== null && !/^[01]$/.test(autoplay))
    )
      return null;
    return getVkVideoEmbedUrl(raw);
  } catch {
    return null;
  }
}
const playback = z.discriminatedUnion("provider", [
  z.object({ id, provider: z.literal("vk"), embedUrl: z.string() }).strict(),
  z
    .object({
      id,
      provider: z.literal("youtube"),
      youtubeId: z.string().regex(/^[\w-]{11}$/),
      videoUrl: z.string().nullable(),
    })
    .strict(),
]);
// Проверяем не только форму источника, но и соответствие запрошенному ролику, прежде чем открыть плеер.
/** Сверяем playback-source с запрошенным ID и провайдером; VK и прямой videoUrl имеют разные проверки адреса. */
export function parseVideoPlayback(value: unknown, requestedId: number) {
  const result = playback.safeParse(value);
  if (!result.success || result.data.id !== requestedId)
    throw invalidResponse();
  const data = result.data;
  if (data.provider === "vk") {
    const embedUrl = getVkCatalogEmbedUrl(data.embedUrl);
    if (!embedUrl) throw invalidResponse();
    return { ...data, embedUrl };
  }
  if (data.videoUrl !== null) {
    const url = safeExternalUrl(data.videoUrl);
    if (!url || !/^(https?:\/\/|\/)/.test(url) || getVkVideoEmbedUrl(url))
      throw invalidResponse();
    return { ...data, videoUrl: url };
  }
  return data;
}
/** Продолжаем только возрастающую неповторённую границу; старую/циклическую страницу нельзя пришить к текущей цепочке. */
export function nextVideoCursor(
  last: ReturnType<typeof parseVideoCatalog>,
  pageParams: readonly unknown[],
) {
  const previous = pageParams.at(-1);
  return last.nextCursor !== null &&
    !pageParams.includes(last.nextCursor) &&
    (typeof previous !== "number" || last.nextCursor > previous)
    ? last.nextCursor
    : undefined;
}
/** Отличаем завершение nextCursor=null от непродолжаемого ошибочного курсора. */
export function stalledVideoCursor(
  last: ReturnType<typeof parseVideoCatalog> | undefined,
  pageParams: readonly unknown[],
) {
  return (
    last?.nextCursor != null && nextVideoCursor(last, pageParams) === undefined
  );
}
/** ACK создания VK должен содержать только валидный ID; успешный HTTP недостаточен. */
export function requireVkVideoId(value: unknown): number {
  const result = z.object({ id }).strict().safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data.id;
}

const vkEditorDetail = z.object({
  id,
  title: z.string().max(512),
  embedUrl: z.string().nullable(),
  access: z.enum(["public", "club"]),
  published: z.boolean(),
  thumbnailUrl: z.string().nullable(),
  editRevision: z.number().int().nonnegative().safe(),
});
export type VkEditorDetail = z.infer<typeof vkEditorDetail>;
/** Сверяем detail редактора с нужным ID, поддерживаемой revision и пригодным VK embed URL. */
export function parseVkEditorDetail(
  value: unknown,
  requestedId: number,
): VkEditorDetail {
  const result = vkEditorDetail.safeParse(value);
  if (
    !result.success ||
    result.data.id !== requestedId ||
    (result.data.embedUrl !== null &&
      !getVkCatalogEmbedUrl(result.data.embedUrl))
  )
    throw invalidResponse();
  return result.data;
}
