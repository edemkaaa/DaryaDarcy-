/** Публичные сообщения об ошибках отделяем от транспортных деталей и различаем отказ доступа, временный сбой и отмену. */
export type ApiErrorKind =
  | "http"
  | "network"
  | "timeout"
  | "cancelled"
  | "invalid-response";

/** Классификация ошибки хранит безопасное сообщение вместе с HTTP-статусом, задержкой и машинным видом сбоя. */
export class ApiError extends Error {
  /**   Сообщение передаётся Error, остальные поля остаются структурированными признаками для UI и политики повторов. */
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

/** Повреждённый успешный ответ выделяем в отдельный вид; он не доказывает, что запись не состоялась. */
export function invalidResponse(): ApiError {
  return new ApiError(
    "Некорректный ответ сервера. Попробуйте ещё раз.",
    0,
    undefined,
    false,
    "invalid-response",
  );
}

/** Извлекаем безопасное объяснение из ApiError или HTTP-кода; неизвестную внутреннюю ошибку не показываем дословно. */
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

/** Сохраняем один способ чтения статуса для REST ApiError и tRPC-обёртки с cause или data.httpStatus. */
export function getHttpStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) return error.status;
  if (!error || typeof error !== "object") return undefined;
  const data = (error as { data?: { httpStatus?: unknown } }).data;
  if (typeof data?.httpStatus === "number") return data.httpStatus;
  const cause = (error as { cause?: unknown }).cause;
  return cause instanceof ApiError ? cause.status : undefined;
}

/** A failed background read is not evidence that previously confirmed access ended. */
// Только временная ошибка допускает сохранение ранее подтверждённого содержимого на экране.
/** Сетевой сбой, timeout и 5xx допускают сохранение прежнего экрана; отмена и invalid-response сюда не входят. */
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

// Автоповтор ограничен чтением и временными сбоями; отказ доступа или повреждённый ответ не исправляются повтором.
/** Разрешаем не больше одного автоматического повтора чтения; явные 4xx и распознанная отмена/поломка контракта прекращают его. */
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
