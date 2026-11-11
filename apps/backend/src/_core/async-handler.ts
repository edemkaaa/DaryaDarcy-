/** Адаптирует отклонённый Promise обработчика к цепочке ошибок Express 4. */
import type { RequestHandler } from "express";

/** Express 4 сам не передаёт отклонённый Promise обработчика в error middleware. */
export function asyncHandler(
  handler: (...args: Parameters<RequestHandler>) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    void handler(req, res, next).catch(next);
  };
}
