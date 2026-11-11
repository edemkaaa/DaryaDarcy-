// Собирает player URL и метаданные только для валидированных VK-ссылок. Неполный ответ oEmbed отмечается отдельно, не подменяется выдуманной обложкой.
import { z } from "zod";
import { fileURLToPath } from "node:url";
import { basename, dirname, join, resolve, sep } from "node:path";
import { open, realpath, stat, readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { setTimeout as pause } from "node:timers/promises";
import { parseVkEmbed } from "../../apps/backend/src/content/vk-video-input";

export function parseSources(text: string): string[] {
  // Принимает ограниченный список канонических ссылок заданного VK-сообщества, отклоняя лишние параметры и дубли.

  if (Buffer.byteLength(text, "utf8") > 1024 * 1024)
    throw new Error("Input file exceeds1MiB");
  const sources = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const value = line.trim();
    if (!/^https?:/i.test(value)) continue;
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !["vk.ru", "vk.com", "vkvideo.ru"].includes(url.hostname) ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !/^\/video-211171256_[1-9]\d{0,19}$/.test(url.pathname)
    )
      throw new Error("Unsupported community video URL");
    sources.add(`https://vkvideo.ru${url.pathname}`);
    if (sources.size > 100) throw new Error("Batch exceeds100 videos");
  }
  if (!sources.size) throw new Error("No community video URLs found");
  return [...sources];
}

export type VideoMetadata = {
  sourceUrl: string;
  status: "ok" | "incomplete" | "failed";
  title: string | null;
  embedUrl: string | null;
  thumbnailSourceUrl: string | null;
  issues: string[];
};

function parseOembedPlayer(value: string) {
  // Убирает только известный служебный __ref и проверяет адрес плеера серверным парсером VK.

  if (value.length > 2048) return null;
  try {
    const url = new URL(value);
    // Observed oEmbed-only tracking; keep the application allowlist unchanged.
    if (
      url.searchParams.getAll("__ref").length === 1 &&
      url.searchParams.get("__ref") === "vk.web2"
    )
      url.searchParams.delete("__ref");
    return parseVkEmbed(url.toString());
  } catch {
    return null;
  }
}

export async function collectVideo(
  source: string,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<VideoMetadata> {
  // Получает ограниченный oEmbed-ответ с дедлайном и проверяет совпадение owner/id; HTML ответа не выполняется.

  const sourceUrl = parseSources(source)[0]!;
  const result: VideoMetadata = {
    sourceUrl,
    status: "failed",
    title: null,
    embedUrl: null,
    thumbnailSourceUrl: null,
    issues: [],
  };
  const fail = (issue: string) => /* Возвращает структурированное описание неуспешного сбора конкретного ролика без прекращения всей партии. */ ({ ...result, issues: [issue] });
  const signal = AbortSignal.timeout(options.timeoutMs ?? 10000);
  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(
      "https://api.vk.com/method/video.getOembed",
      {
        method: "POST",
        credentials: "omit",
        redirect: "error",
        signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ url: sourceUrl, v: "5.199" }).toString(),
      },
    );
  } catch {
    return fail(signal.aborted ? "request_timeout" : "request_failed");
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    return fail(`http_${response.status}`);
  }
  let raw: unknown;
  const reader = response.body?.getReader();
  // Keep the body deadline explicit after fetch has returned its headers.
  const abortBody = () => {
    // Останавливает чтение ответа при отмене или превышении ограничения; соединение не должно продолжать качать тело.

    void reader?.cancel().catch(() => {});
  };
  signal.addEventListener("abort", abortBody, { once: true });
  try {
    signal.throwIfAborted();
    if (!reader || Number(response.headers.get("content-length")) > 65536)
      throw new Error("Response unavailable or too large");
    let length = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      length += value.byteLength;
      if (length > 65536) throw new Error("Response too large");
      chunks.push(value);
    }
    raw = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)),
    );
  } catch {
    return fail(signal.aborted ? "request_timeout" : "invalid_response");
  } finally {
    signal.removeEventListener("abort", abortBody);
    await reader?.cancel().catch(() => {});
  }
  const refusal = z
    .object({ error: z.object({ error_code: z.number().int().nonnegative() }) })
    .safeParse(raw);
  if (refusal.success) return fail(`vk_error_${refusal.data.error.error_code}`);
  const parsed = z
    .object({
      response: z.object({
        version: z.literal("1.0"),
        type: z.literal("video"),
        title: z.string().max(512).optional(),
        html: z.string().max(16384),
        thumbnail_url: z.string().max(2048).optional(),
      }),
    })
    .safeParse(raw);
  if (!parsed.success) return fail("invalid_response");
  const data = parsed.data.response;
  result.title = data.title?.trim().normalize("NFC") || null;
  if (!result.title) result.issues.push("missing_title");
  // Extract only one src; never retain or execute provider-supplied HTML.
  const iframe = /^\s*<iframe\b([^<>]*)>\s*<\/iframe>\s*$/i.exec(data.html);
  const attributes = iframe?.[1]?.trimEnd() ?? "";
  // Consume complete attributes, so text inside title/style is not a src.
  const tokens = [
    ...attributes.matchAll(
      /\s+([a-z][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gi,
    ),
  ];
  const src =
    tokens.map((token) => token[0]).join("") === attributes
      ? tokens.filter((token) => token[1]!.toLowerCase() === "src")
      : [];
  const sourceValue =
    src.length === 1 ? (src[0]![2] ?? src[0]![3] ?? src[0]![4]) : null;
  const player = sourceValue
    ? parseOembedPlayer(sourceValue.replace(/&(?:amp|#38|#x26);/gi, "&"))
    : null;
  if (player) {
    const url = new URL(player.embedUrl);
    const videoId = new URL(sourceUrl).pathname.split("_")[1];
    if (
      url.searchParams.get("oid") === "-211171256" &&
      url.searchParams.get("id") === videoId
    )
      result.embedUrl = player.embedUrl;
  }
  if (!result.embedUrl) result.issues.push("invalid_embed");
  try {
    const cover = new URL(data.thumbnail_url ?? "");
    if (
      cover.protocol === "https:" &&
      !cover.username &&
      !cover.password &&
      !cover.port &&
      !cover.hash
    )
      result.thumbnailSourceUrl = cover.href;
  } catch {
    /* Missing cover remains explicit; never invent or fetch one. */
  }
  if (!result.thumbnailSourceUrl)
    result.issues.push("missing_or_invalid_thumbnail");
  result.status = result.issues.length ? "incomplete" : "ok";
  return result;
}
async function main() {
  // Отделяет офлайн-план от явного сбора: пишет новый закрытый файл метаданных, последовательно опрашивая VK с паузой.

  const { values } = parseArgs({
    options: {
      input: { type: "string" },
      output: { type: "string" },
      collect: { type: "boolean" },
      plan: { type: "boolean" },
    },
    strict: true,
    allowPositionals: false,
  });
  if (!values.input || (values.collect && values.plan))
    throw new Error("Invalid mode/input");
  const info = await stat(values.input);
  if (!info.isFile() || info.size > 1024 * 1024)
    throw new Error("Invalid input file");
  const sources = parseSources(await readFile(values.input, "utf8"));
  if (!values.collect) {
    console.log(
      JSON.stringify({
        mode: "plan",
        sourceCount: sources.length,
        networkRequested: false,
      }),
    );
    return;
  }
  if (!values.output) throw new Error("Explicit new output path required");
  const root = await realpath(
    fileURLToPath(new URL("../../", import.meta.url)),
  );
  const output = join(
    await realpath(dirname(resolve(values.output))),
    basename(values.output),
  );
  if (output === root || output.startsWith(root + sep))
    throw new Error("Export must stay outside Git");
  // Claim before network. Never overwrite a prior report, symlink or user file.
  const handle = await open(output, "wx", 0o600);
  try {
    await handle.chmod(0o600);
    const items: VideoMetadata[] = [];
    for (const source of sources) {
      if (items.length) await pause(400);
      items.push(await collectVideo(source));
    }
    const summary = { ok: 0, incomplete: 0, failed: 0 };
    for (const item of items) summary[item.status]++;
    const report = {
      schemaVersion: 1,
      collectedAt: new Date().toISOString(),
      sourceCount: sources.length,
      summary,
      playbackVerified: false,
      importReady: false,
      thumbnailBytesDownloaded: false,
      items,
    };
    await handle.writeFile(JSON.stringify(report, null, 2) + "\n", "utf8");
    console.log(
      JSON.stringify({
        mode: "collect",
        sourceCount: sources.length,
        summary,
        output,
      }),
    );
    if (summary.failed || summary.incomplete) process.exitCode = 2;
  } finally {
    await handle.close();
  }
}

// Imports and offline readers must never start collection.
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  void main().catch((error) => {
    const code = (error as NodeJS.ErrnoException).code;
    console.error(
      `VK metadata export failed: ${["EEXIST", "ENOENT", "EACCES"].includes(code ?? "") ? code : "invalid_input_or_operation"}`,
    );
    process.exitCode = 1;
  });
}
