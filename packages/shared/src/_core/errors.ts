/** Общий тип HTTP-ошибки позволяет отличать отказ доступа от сбоя инфраструктуры. */
/**
 * Base HTTP error class with status code.
 * Throw this from route handlers to send specific HTTP errors.
 */
export class HttpError extends Error {
  /** Создаём распознаваемую HTTP-ошибку с отдельным statusCode, чтобы отказ доступа не смешивался с инфраструктурным исключением. */
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

// Convenience constructors
/** Создаём ошибку неверного запроса с HTTP400 и переданным безопасным сообщением. */
export const BadRequestError = (msg: string) => new HttpError(400, msg);
/** Создаём ошибку отсутствующей или недействительной авторизации с HTTP401. */
export const UnauthorizedError = (msg: string) => new HttpError(401, msg);
/** Создаём ошибку недостаточного доступа с HTTP403, сохраняя общий тип HttpError. */
export const ForbiddenError = (msg: string) => new HttpError(403, msg);
/** Создаём ошибку отсутствующего ресурса с HTTP404. */
export const NotFoundError = (msg: string) => new HttpError(404, msg);
