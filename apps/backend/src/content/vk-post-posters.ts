import { z } from "zod";
import { parseVkEmbed } from "./vk-video-input";

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
        image: z.array(image).max(100),
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

function thumbnail(html: string, player: URL): string | undefined {
  const parsed = dataSchema.safeParse(prefetchData(html));
  if (!parsed.success) return;
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
  if (items.length !== 1) return;
  const candidates = items[0]!.image.filter((candidate) => {
    try {
      const url = new URL(candidate.url);
      return (
        url.protocol === "https:" &&
        /^(?:[a-z0-9-]+\.)*userapi\.com$/.test(url.hostname) &&
        !url.username &&
        !url.password &&
        !url.port &&
        !url.hash &&
        // Prefer direct thumbnail variants. The observed proxy=1 original
        // refuses delivery (429), while its signed 1280px thumbnail returns JPEG.
        !url.searchParams.has("proxy") &&
        /\.(?:jpe?g|webp|png|avif)$/i.test(url.pathname)
      );
    } catch {
      return false;
    }
  });
  candidates.sort(
    (a, b) =>
      Number(Boolean(a.with_padding)) - Number(Boolean(b.with_padding)) ||
      b.width * b.height - a.width * a.height,
  );
  return candidates[0]?.url;
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

async function usableImage(response: Response, signal: AbortSignal) {
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
    return false;
  }
  const bytes = await readBody(response, signal, 4 * 1024 * 1024);
  return (
    (mime === "image/jpeg" &&
      bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) ||
    (mime === "image/png" &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (mime === "image/webp" &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP") ||
    (mime === "image/avif" && bytes.toString("ascii", 4, 12) === "ftypavif")
  );
}

/** Best effort, before the caller opens its SQL transaction. No S3/image writes.
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
        ? [{ original: url, player: new URL(parsed.embedUrl) }]
        : [];
    })
    .slice(0, 8);
  const result = new Map<string, string>();
  if (!links.length) return result;
  const signal = AbortSignal.timeout(options.timeoutMs ?? 3000);
  let next = 0;
  async function worker() {
    while (next < links.length && !signal.aborted) {
      const { original, player } = links[next++]!;
      try {
        // Canonical fixed destination, no share-page fetching or redirects.
        const destination = new URL(
          player.pathname + player.search,
          "https://vk.com",
        );
        const response = await (options.fetchImpl ?? fetch)(destination.href, {
          redirect: "error",
          credentials: "omit",
          signal,
        });
        // JSON keys/URLs are ASCII even if surrounding HTML is windows-1251.
        const poster = thumbnail(
          (await readBody(response, signal)).toString("utf8"),
          player,
        );
        if (poster) {
          const image = await (options.fetchImpl ?? fetch)(poster, {
            redirect: "error",
            credentials: "omit",
            signal,
          });
          if (await usableImage(image, signal)) result.set(original, poster);
        }
      } catch {
        /* Metadata is optional; do not log private hashes/provider HTML. */
      }
    }
  }
  await Promise.all([worker(), worker()]);
  return result;
}
