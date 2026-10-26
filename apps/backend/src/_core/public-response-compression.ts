import compression from "compression";
import type { Express } from "express";
import { constants } from "node:zlib";

const publicReads = new Set([
  "feed.listPaginated",
  "feed.getById",
  "feed.tags",
  "videos.catalog",
  "articles.list",
]);

/** Compress public JSON bytes, never private responses or binary media. No cache is added. */
export function registerPublicResponseCompression(app: Express): void {
  app.use(
    compression({
      threshold: 1024,
      level: 4,
      brotli: { params: { [constants.BROTLI_PARAM_QUALITY]: 4 } },
      filter(req, res) {
        if (
          req.method !== "GET" ||
          req.headers.cookie !== undefined ||
          req.headers.authorization !== undefined ||
          req.headers.range !== undefined ||
          req.headers["if-range"] !== undefined ||
          res.statusCode !== 200 ||
          res.getHeader("Set-Cookie") !== undefined ||
          /(?:^|,)\s*(?:private|no-store)(?=\s*(?:[=,]|$))/i.test(
            String(res.getHeader("Cache-Control") ?? ""),
          ) ||
          !/^application\/json(?:;|$)/i.test(
            String(res.getHeader("Content-Type") ?? ""),
          ) ||
          !req.path.startsWith("/api/trpc/")
        )
          return false;
        const procedures = req.path.slice("/api/trpc/".length).split(",");
        return (
          procedures.length <= 20 &&
          procedures.every((path) => publicReads.has(path)) &&
          compression.filter(req, res)
        );
      },
    }),
  );
}
