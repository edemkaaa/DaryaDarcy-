import { createServer } from "node:http";
import { open } from "node:fs/promises";
import { pipeline } from "node:stream/promises";

function byteRange(header, size) {
  if (!header) return { start: 0, end: size - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return null;
  const first = Number(match[1]);
  const last = Number(match[2]);
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)) return null;
  const start = match[1] ? first : Math.max(0, size - last);
  const end = match[1] && match[2] ? Math.min(last, size - 1) : size - 1;
  if (start >= size || start > end || (!match[1] && last === 0)) return null;
  return { start, end, partial: true };
}

function error(response, status) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify({ error: "video unavailable" }));
}

/** Public catalog playback only; never accepts upstream URLs or credentials. */
export function createVideoServer({
  readCatalog,
  cache,
  readThumbnail,
  maxRequests = 16,
  requestDeadlineMs = 170_000,
}) {
  let active = 0;
  const server = createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "no-store");
    if (!["GET", "HEAD"].includes(request.method)) {
      response.setHeader("Allow", "GET, HEAD");
      return error(response, 405);
    }
    if (request.url === "/health") {
      response.writeHead(200, { "Content-Type": "application/json" });
      return response.end(
        request.method === "HEAD" ? undefined : '{"ok":true}',
      );
    }
    const thumbnail = /^\/media\/yt-thumb\/([\w-]{11})\/hqdefault\.jpg$/.exec(
      request.url,
    );
    const match = thumbnail || /^\/api\/yt\/([\w-]{11})$/.exec(request.url);
    if (!match)
      return error(response, request.url.startsWith("/api/yt/") ? 400 : 404);
    if (active >= maxRequests) {
      response.setHeader("Retry-After", "10");
      return error(response, 503);
    }
    active++;
    const id = match[1];
    const controller = new AbortController();
    const onClose = () => controller.abort();
    response.once("close", onClose);
    const deadline = setTimeout(() => {
      controller.abort();
      response.destroy();
    }, requestDeadlineMs);
    deadline.unref();
    let lease;
    let file;
    try {
      const published = async () =>
        (await readCatalog(controller.signal)).some(
          (video) =>
            video.youtubeId === id &&
            video.published === true &&
            (video.access === undefined || video.access === "public") &&
            (video.provider === undefined || video.provider === "youtube"),
        );
      if (!(await published())) return error(response, 404);
      if (thumbnail) {
        const image = await readThumbnail(id, controller.signal);
        if (!(await published())) return error(response, 404);
        response.writeHead(200, {
          "Content-Type": "image/jpeg",
          "Content-Length": image.length,
        });
        return response.end(request.method === "HEAD" ? undefined : image);
      }
      lease = await cache.acquire(id, controller.signal);
      if (controller.signal.aborted) return;
      if (!(await published())) return error(response, 404);
      file = await open(lease.path, "r");
      const info = await file.stat();
      if (!info.isFile() || info.size <= 0) throw new Error("invalid media");
      const range = byteRange(request.headers.range, info.size);
      if (!range) {
        response.setHeader("Content-Range", `bytes */${info.size}`);
        return error(response, 416);
      }
      const headers = {
        "Content-Type": "video/mp4",
        "Content-Length": range.end - range.start + 1,
        "Accept-Ranges": "bytes",
      };
      if (range.partial)
        headers["Content-Range"] =
          `bytes ${range.start}-${range.end}/${info.size}`;
      response.writeHead(range.partial ? 206 : 200, headers);
      if (request.method === "HEAD") return response.end();
      await pipeline(
        file.createReadStream({
          start: range.start,
          end: range.end,
          autoClose: false,
        }),
        response,
        { signal: controller.signal },
      );
    } catch (cause) {
      if (!controller.signal.aborted && !response.headersSent)
        error(response, cause.code === "BUSY" ? 503 : 502);
      else response.destroy();
    } finally {
      response.off("close", onClose);
      clearTimeout(deadline);
      await file?.close().catch(() => {});
      lease?.release();
      active--;
    }
  });
  server.headersTimeout = 10_000;
  server.requestTimeout = 10_000;
  server.keepAliveTimeout = 5000;
  server.maxHeadersCount = 32;
  server.maxRequestsPerSocket = 100;
  return server;
}
