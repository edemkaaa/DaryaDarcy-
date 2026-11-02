import type { RequestHandler } from "express";

/** Express 4 does not forward rejected handler promises to error middleware. */
export function asyncHandler(
  handler: (...args: Parameters<RequestHandler>) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}
