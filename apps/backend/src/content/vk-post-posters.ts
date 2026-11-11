/** Извлекаем превью VK как данные, до SQL-транзакции. Сбой обложки не подменяет адрес воспроизводимого видео. */
import { z } from "zod";
import { parseVkEmbed } from "./vk-video-input";
import { saveVkPoster } from "../media/vk-poster-object";
import { fetchVkPreview } from "../media/vk-preview-fetch";

const MAX_BODY = 1024 * 1024;
const image = z.object({
  url: z.string().max(2048),
  width: z.number().int().positive().max(16384),
  height: z.number().int().positive().max(16384),
  with_padding: z.number().optional(),
});
const dataSchema = z.object({
  apiPrefetchCache: z
    .array(
      z.object({
        method: z.string(),
        response: z.unknown(),
      }),
    )
    .max(100),
});
const videoResponse = z.object({
  items: z
    .array(
      z.object({
        owner_id: z.number().int().safe(),
        id: z.number().int().positive().safe(),
        image: z.array(image).max(100).default([]),
        first_frame: z.array(image).max(100).default([]),
      }),
    )
    .max(100),
});

// VK's embed includes a JSON video.get prefetch. Read data only; never execute
// provider scripts or search unrelated URLs/images elsewhere in the document.
function prefetchData(html: string): unknown {
  const marker =
    /window\.cur\s*=\s*Object\.assign\(window\.cur\s*\|\|\s*\{\},\s*/.exec(
      html,
    );
  if (!marker) return null;
  const start = marker.index + marker[0].length;
  if (html[start] !== "{") return null;
  let depth = 0,
    quoted = false,
    escaped = false;
  for (let i = start; i < html.length; i++) {
    const char = html[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) {
      if (!/^\s*(?:\)|,)/.test(html.slice(i + 1))) return null;
      return JSON.parse(html.slice(start, i + 1));
    }
  }
  return null;
}

function thumbnails(html: string, player: URL): string[] {
  const parsed = dataSchema.safeParse(prefetchData(html));
  if (!parsed.success) return [];
  const items = parsed.data.apiPrefetchCache
    .filter((entry) => entry.method === "video.get")
    .flatMap((entry) => {
      const response = videoResponse.safeParse(entry.response);
      return response.success ? response.data.items : [];
    })
    .filter(
      (item) =>
        String(item.owner_id) === player.searchParams.get("oid") &&
        String(item.id) === player.searchParams.get("id"),
    );
  if (items.length !== 1) return [];
  function candidates(images: z.infer<typeof image>[], firstFrame = false) {
    const result = images.filter((candidate) => {
      try {
        const url = new URL(candidate.url);
        return (
          url.protocol === "https:" &&
          (firstFrame
            ? url.hostname === "iv.okcdn.ru" &&
              url.pathname === "/getVideoPreview"
            : /^(?:[a-z0-9-]+\.)*userapi\.com$/.test(url.hostname) &&
              /\.(?:jpe?g|webp|png|avif)$/i.test(url.pathname)) &&
          !url.username &&
          !url.password &&
          !url.port &&
          !url.hash &&
          // Prefer direct thumbnail variants. The observed proxy=1 original
          // refuses delivery (429), while its signed 1280px thumbnail returns JPEG.
          !url.searchParams.has("proxy")
        );
      } catch {
        return false;
      }
    });
    result.sort(
      (a, b) =>
        Number(Boolean(a.with_padding)) - Number(Boolean(b.with_padding)) ||
        b.width * b.height - a.width * a.height,
    );
    return result;
  }
  const item = items[0]!;
  // One cover then at most two real first-frame variants, never arbitrary art.
  return [
    ...new Set(
      [
        ...candidates(item.image).slice(0, 1),
        ...candidates(item.first_frame, true).slice(0, 2),
      ].map((candidate) => candidate.url),
    ),
  ];
}

async function readBody(
  response: Response,
  signal: AbortSignal,
  maxBytes = MAX_BODY,
): Promise<Buffer> {
  const reader = response.body?.getReader();
  const abort = () => {
    void reader?.cancel().catch(() => {});
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    signal.throwIfAborted();
    if (
      !response.ok ||
      !reader ||
      Number(response.headers.get("content-length")) > maxBytes
    )
      throw new Error("VK metadata unavailable");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("VK response too large");
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally {
    signal.removeEventListener("abort", abort);
    await reader?.cancel().catch(() => {});
  }
}

async function usableImage(
  response: Response,
  signal: AbortSignal,
): Promise<Buffer | undefined> {
  const mime = response.headers
    .get("content-type")
    ?.split(";")[0]
    ?.trim()
    .toLowerCase();
  if (
    !mime ||
    !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(mime)
  ) {
    await response.body?.cancel().catch(() => {});
    return;
  }
  const bytes = await readBody(response, signal, 4 * 1024 * 1024);
  const valid =
    (mime === "image/jpeg" &&
      bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) ||
    (mime === "image/png" &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (mime === "image/webp" &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP") ||
    (mime === "image/avif" && bytes.toString("ascii", 4, 12) === "ftypavif");
  return valid ? bytes : undefined;
}

/** Best effort, before the caller opens its SQL transaction. New public covers only.
 * The eight-link cap, two workers and one deadline bound provider work per save.
 * Failure leaves the video playable and any existing/manual poster unchanged. */
export async function resolveVkPostPosters(
  urls: string[],
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<ReadonlyMap<string, string>> {
  const links = [...new Set(urls.map((url) => url.trim()))]
    .flatMap((url) => {
      const parsed = parseVkEmbed(url);
      return parsed
        ? [
            {
              original: url,
              player: new URL(parsed.embedUrl),
              sourceKey: parsed.sourceKey,
            },
          ]
        : [];
    })
    .slice(0, 8);
  const result = new Map<string, string>();
  if (!links.length) return result;
  const signal = AbortSignal.timeout(options.timeoutMs ?? 5000);
  let next = 0;
  async function worker() {
    while (next < links.length && !signal.aborted) {
      const { original, player, sourceKey } = links[next++]!;
      try {
        // Canonical fixed destination, no share-page fetching or redirects.
        const destination = new URL(
          player.pathname + player.search,
          "https://vk.com",
        );
        const response = await fetchVkPreview(
          destination.href,
          signal,
          options.fetchImpl,
        );
        // JSON keys/URLs are ASCII even if surrounding HTML is windows-1251.
        const posters = thumbnails(
          (await readBody(response, signal)).toString("utf8"),
          player,
        );
        for (const poster of posters) {
          if (signal.aborted) break;
          try {
            const image = await fetchVkPreview(
              poster,
              signal,
              options.fetchImpl,
            );
            const bytes = await usableImage(image, signal);
            if (bytes) {
              result.set(
                original,
                await saveVkPoster(sourceKey, bytes, signal),
              );
              break;
            }
          } catch {
            /* Try the next bounded provider variant, not an automatic retry. */
          }
        }
      } catch {
        /* Metadata is optional; do not log private hashes/provider HTML. */
      }
    }
  }
  await Promise.all([worker(), worker()]);
  return result;
}
