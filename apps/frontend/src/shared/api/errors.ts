export type ApiErrorKind =
  | "http"
  | "network"
  | "timeout"
  | "cancelled"
  | "invalid-response";

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public retryAfterSec?: number,
    public requiresTotp = false,
    public kind: ApiErrorKind = "http",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function invalidResponse(): ApiError {
  return new ApiError(
    "Некорректный ответ сервера. Попробуйте ещё раз.",
    0,
    undefined,
    false,
    "invalid-response",
  );
}

export function getRequestErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  const cause =
    error && typeof error === "object"
      ? (error as { cause?: unknown }).cause
      : undefined;
  if (cause instanceof ApiError) return cause.message;
  const status = getHttpStatus(error);
  if (status === 401) return "Сессия завершилась. Войдите снова.";
  if (status === 403) return "Нет доступа к этому действию.";
  if (status === 429) return "Слишком много запросов. Попробуйте позже.";
  if (status && status >= 500)
    return "Сервис временно недоступен. Попробуйте ещё раз.";
  if (
    status &&
    status >= 400 &&
    status < 500 &&
    error instanceof Error &&
    error.message.length <= 500
  )
    return error.message;
  return "Не удалось выполнить запрос. Попробуйте ещё раз.";
}

export function getHttpStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) return error.status;
  if (!error || typeof error !== "object") return undefined;
  const data = (error as { data?: { httpStatus?: unknown } }).data;
  if (typeof data?.httpStatus === "number") return data.httpStatus;
  const cause = (error as { cause?: unknown }).cause;
  return cause instanceof ApiError ? cause.status : undefined;
}

/** A failed background read is not evidence that previously confirmed access ended. */
export function isTemporaryRequestError(error: unknown): boolean {
  const status = getHttpStatus(error);
  if (status) return status >= 500 && status < 600;
  const cause =
    error && typeof error === "object"
      ? (error as { cause?: unknown }).cause
      : undefined;
  const apiError = error instanceof ApiError ? error : cause;
  return (
    apiError instanceof ApiError &&
    (apiError.kind === "network" || apiError.kind === "timeout")
  );
}

export function shouldRetryQuery(
  failureCount: number,
  error: unknown,
): boolean {
  if (failureCount >= 1) return false;
  const cause =
    error && typeof error === "object"
      ? (error as { cause?: unknown }).cause
      : undefined;
  const apiError =
    error instanceof ApiError
      ? error
      : cause instanceof ApiError
        ? cause
        : null;
  if (apiError && ["cancelled", "invalid-response"].includes(apiError.kind))
    return false;
  const status = getHttpStatus(error);
  return !status || status >= 500;
}
