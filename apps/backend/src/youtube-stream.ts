/** Совместимый маршрут прежнего видеопровайдера; каталог VK использует другой путь воспроизведения. */
import { execFile } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import type { Express, Request, Response } from "express";
import { getVideoByYoutubeId } from "./db";
import { asyncHandler } from "./_core/async-handler";

const execFileAsync = promisify(execFile);
const YT_ID = /^[\w-]{6,20}$/;
const cache = new Map<string, { url: string; exp: number }>();

function ytBin(): string {
  return (
    (process.env.YT_DLP_PATH || "/usr/local/bin/yt-dlp").trim() || "yt-dlp"
  );
}

async function playbackUrl(id: string, signal: AbortSignal): Promise<string> {
  signal.throwIfAborted();
  const hit = cache.get(id);
  if (hit && hit.exp > Date.now()) return hit.url;
  const { stdout } = await execFileAsync(
    ytBin(),
    [
      "--extractor-args",
      "youtube:player_client=android,ios,tv",
      "-f",
      "18/22/best[ext=mp4]/best",
      "-g",
      "--no-warnings",
      "--no-playlist",
      `https://www.youtube.com/watch?v=${id}`,
    ],
    { timeout: 28000, maxBuffer: 2 * 1024 * 1024, signal },
  );
  const url = stdout
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^https?:\/\//i.test(line))
    .at(-1);
  if (!url) throw new Error("no playback url");
  cache.set(id, { url, exp: Date.now() + 3 * 60 * 60 * 1000 });
  return url;
}

export function registerYoutubeStream(app: Express) {
  app.get("/api/yt/:id", asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id || "");
    if (!YT_ID.test(id)) {
      res.status(400).json({ error: "bad id" });
      return;
    }
    const controller = new AbortController();
    const onClose = () => controller.abort();
    res.once("close", onClose);
    req.once("aborted", onClose);
    // Match the bounded legacy video-service request window, not video length.
    const deadline = setTimeout(() => {
      controller.abort();
      res.destroy();
    }, 170000);
    deadline.unref();
    try {
      // Check current publication before cache resolution or external work.
      // A public catalog player must not become a proxy for arbitrary IDs.
      const video = await getVideoByYoutubeId(id);
      if (
        !video?.published ||
        video.access !== "public" ||
        video.provider !== "youtube"
      ) {
        cache.delete(id);
        res.status(404).json({ error: "video unavailable" });
        return;
      }
      const url = await playbackUrl(id, controller.signal);
      const headers: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/122.0.0.0 Mobile Safari/537.36",
      };
      if (req.headers.range) headers.Range = String(req.headers.range);
      const upstream = await fetch(url, {
        headers,
        redirect: "follow",
        signal: controller.signal,
      });
      if (!upstream.ok && upstream.status !== 206) {
        cache.delete(id);
        await upstream.body?.cancel();
        res.status(upstream.status).end();
        return;
      }
      const current = await getVideoByYoutubeId(id);
      if (
        !current?.published ||
        current.access !== "public" ||
        current.provider !== "youtube"
      ) {
        cache.delete(id);
        await upstream.body?.cancel();
        res.status(404).json({ error: "video unavailable" });
        return;
      }
      res.status(upstream.status);
      for (const name of [
        "content-type",
        "content-length",
        "content-range",
        "accept-ranges",
      ]) {
        const value = upstream.headers.get(name);
        if (value) res.setHeader(name, value);
      }
      res.setHeader("Cache-Control", "private, max-age=60");
      if (!upstream.body) {
        res.end();
        return;
      }
      await pipeline(Readable.fromWeb(upstream.body as never), res, {
        signal: controller.signal,
      });
    } catch (err) {
      cache.delete(id);
      if (!controller.signal.aborted)
        console.error("[yt]", id, "stream unavailable");
      if (!res.headersSent && !res.destroyed && !controller.signal.aborted)
        res.status(502).json({ error: "video unavailable" });
      else if (!res.writableEnded) res.destroy();
    } finally {
      clearTimeout(deadline);
      res.off("close", onClose);
      req.off("aborted", onClose);
      controller.abort();
    }
  }));
}
