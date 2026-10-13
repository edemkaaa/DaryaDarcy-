import { Controller, Get, Inject, Param, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { PrivateFilesService } from "./private-files.service";
import { privateObjectReader } from "../media/private-object";

/** One safe integer byte range; undefined means invalid/unsatisfiable. */
function byteRange(raw: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(raw);
  if (!match || (!match[1] && !match[2]) || size === 0) return;
  const first = Number(match[1]),
    last = Number(match[2]);
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)) return;
  if (!match[1]) {
    if (last === 0) return;
    return { start: Math.max(0, size - last), end: size - 1 };
  }
  const end = match[2] ? Math.min(last, size - 1) : size - 1;
  if (first >= size || end < first) return;
  return { start: first, end };
}

@Controller("api/media/post-attachments")
export class PrivateFilesController {
  constructor(
    @Inject(PrivateFilesService) private readonly files: PrivateFilesService,
  ) {}

  @Get(":mediaId")
  // Express GET registration also handles HEAD; verify with the native route.
  async read(
    @Param("mediaId") rawId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const unavailable = () =>
      res.status(404).json({ error: "Файл недоступен." });
    const id = Number(rawId);
    if (
      process.env.PRIVATE_POST_MEDIA_DELIVERY_ENABLED !== "true" ||
      !/^[1-9]\d*$/.test(rawId) ||
      !Number.isSafeInteger(id) ||
      Object.keys(req.query).length
    )
      return unavailable();
    const abort = new AbortController();
    const cancel = () => {
      if (!res.writableFinished) abort.abort();
    };
    res.once("close", cancel);
    let reader: ReturnType<typeof privateObjectReader> | undefined;
    let body: Readable | undefined;
    let idle: ReturnType<typeof setTimeout> | undefined;
    const progress = () => {
      clearTimeout(idle);
      idle = setTimeout(() => abort.abort(), 30_000);
      idle.unref();
    };
    try {
      const file = await this.files.authorizedAttachment(id, req);
      if (!file) return unavailable();
      if (res.destroyed) return;
      reader = privateObjectReader(file.key, abort.signal);
      const meta = await reader.head();
      const size = meta.ContentLength;
      if (
        typeof size !== "number" ||
        !Number.isSafeInteger(size) ||
        size < 0 ||
        !meta.ETag
      )
        throw new Error("Invalid object metadata");
      res.setHeader("Content-Type", file.mime);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="attachment-${id}"`,
      );
      res.setHeader("Content-Length", size);
      res.setHeader("Accept-Ranges", "bytes");
      if (req.method === "HEAD") return res.status(200).end();
      const range =
        req.headers.range !== undefined
          ? byteRange(req.headers.range, size)
          : null;
      if (range === undefined) {
        res.removeHeader("Content-Length");
        res.removeHeader("Content-Type");
        res.removeHeader("Content-Disposition");
        res.setHeader("Content-Range", `bytes */${size}`);
        return res.status(416).json({ error: "Диапазон недоступен." });
      }
      const rangeHeader = range
        ? `bytes=${range.start}-${range.end}`
        : undefined;
      const object = await reader.get(meta.ETag, rangeHeader);
      if (object.Body instanceof Readable) body = object.Body;
      const length = range ? range.end - range.start + 1 : size;
      const expectedRange = range
        ? `bytes ${range.start}-${range.end}/${size}`
        : undefined;
      if (
        !body ||
        object.ContentLength !== length ||
        object.ContentRange !== expectedRange ||
        object.ETag !== meta.ETag
      )
        throw new Error("Invalid object response");
      res.setHeader("Content-Length", length!);
      if (range) {
        res.status(206);
        res.setHeader("Content-Range", expectedRange!);
      }
      // Bound stalled data flow, not the total duration of a progressing download.
      body.on("data", progress);
      progress();
      await pipeline(body, res, { signal: abort.signal });
    } catch {
      if (res.headersSent || res.destroyed) {
        res.destroy();
        return;
      }
      res.removeHeader("Content-Length");
      res.removeHeader("Content-Type");
      res.removeHeader("Content-Disposition");
      res.status(503).json({ error: "Файл временно недоступен." });
    } finally {
      res.off("close", cancel);
      clearTimeout(idle);
      body?.off("data", progress);
      abort.abort();
      body?.destroy();
      reader?.close();
    }
  }
}
