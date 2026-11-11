/** Срок запроса включает чтение тела ответа; смена аккаунта отменяет связанные запросы, даже если транспорт ещё выполняется. */
import { ApiError, getRequestErrorMessage, invalidResponse } from "./errors";
import { parseRetryAfter } from "./retry-after";

let sessionRequests = new AbortController();

/** Возвращаем текущий сигнал владельца сессии, чтобы подготовка файла и последующая сеть отменялись вместе. */
export function getSessionRequestSignal(): AbortSignal {
  return sessionRequests.signal;
}

/** Одновременно отменяем все старые связанные операции и создаём свежий сигнал для следующей личности. */
export function cancelSessionRequests(): void {
  sessionRequests.abort();
  sessionRequests = new AbortController();
}

/** Объединяем отмену вызывающего кода и сессии с deadline fetch+body; finally снимает подписки и таймер независимо от исхода. */
export async function runApiRequest<T>(
  url: RequestInfo | URL,
  options: RequestInit,
  consume: (response: Response) => Promise<T>,
  timeoutMs = 15_000,
  sessionBound = true,
): Promise<T> {
  const controller = new AbortController();
  // Внешняя отмена и отмена сессии объединяются, а локальный deadline действует ещё и во время чтения тела.
  const sources = [
    options.signal,
    sessionBound ? sessionRequests.signal : undefined,
  ].filter((signal): signal is AbortSignal => Boolean(signal));
  let rejectAbort: (error: ApiError) => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
  /** Отмена получает собственный ApiError и завершает гонку даже тогда, когда consume пока не реагирует на abort. */
  const cancel = () => {
    const error = new ApiError(
      "Запрос отменён.",
      0,
      undefined,
      false,
      "cancelled",
    );
    controller.abort(error);
    rejectAbort(error);
  };
  const timer = setTimeout(() => {
    const error = new ApiError(
      "Сервер не ответил вовремя. Попробуйте ещё раз.",
      0,
      undefined,
      false,
      "timeout",
    );
    controller.abort(error);
    rejectAbort(error);
  }, timeoutMs);
  for (const signal of sources)
    signal.addEventListener("abort", cancel, { once: true });
  if (sources.some((signal) => signal.aborted)) cancel();
  try {
    return await Promise.race([
      aborted,
      (async () => {
        controller.signal.throwIfAborted();
        const response = await fetch(url, {
          ...options,
          credentials: options.credentials ?? "include",
          signal: controller.signal,
        });
        const result = await consume(response);
        controller.signal.throwIfAborted();
        return result;
      })(),
    ]);
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason;
    if (error instanceof TypeError)
      throw new ApiError(
        "Не удалось связаться с сервером. Проверьте соединение и повторите.",
        0,
        undefined,
        false,
        "network",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    for (const signal of sources) signal.removeEventListener("abort", cancel);
  }
}

/** Успешный HTTP с нечитаемым JSON означает нарушенный контракт; ошибочный HTTP сохраняет свой статус и Retry-After. */
function responseFailure(response: Response): ApiError {
  return response.ok
    ? invalidResponse()
    : new ApiError(
        getRequestErrorMessage({ data: { httpStatus: response.status } }),
        response.status,
        parseRetryAfter(response.headers.get("Retry-After")),
      );
}

/** Обёртка удерживает HTTP-метаданные до позднего tRPC json(), не прикрепляя приватное тело к исключению. */
class BufferedApiResponse extends Response {
  /** Ошибка JSON-разбора преобразуется по сохранённому HTTP-статусу, чтобы 413/429 не терялись как безымянная parser error. */
  override async json(): Promise<unknown> {
    try {
      return await super.json();
    } catch {
      throw responseFailure(this);
    }
  }
}

/** Буферизуем тело внутри общего deadline, затем возвращаем совместимый Response для HTTP-links tRPC. */
export function fetchApiResponse(
  url: RequestInfo | URL,
  options: RequestInit = {},
  timeoutMs = 15_000,
): Promise<Response> {
  // tRPC consumes JSON after fetch returns. Buffer inside the deadline to avoid a hung body.
  return runApiRequest(
    url,
    { ...options, cache: "no-store" },
    async (response) => {
      let body: ArrayBuffer | null;
      try {
        body = [204, 205, 304].includes(response.status)
          ? null
          : await response.arrayBuffer();
      } catch (error) {
        // A failed download of a successful response remains a network error.
        // Only JSON parsing of a fully received body proves an invalid response.
        if (!response.ok) throw responseFailure(response);
        throw error;
      }
      // tRPC читает json позже; сохраняем HTTP-статус и заголовки уже полностью полученного ответа.
      return new BufferedApiResponse(body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    },
    timeoutMs,
  );
}

/** Файловая отправка получает больший, но конечный бюджет; обычные чтения статуса не наследуют этот длинный timeout. */
export function fetchUploadResponse(
  url: RequestInfo | URL,
  options: RequestInit = {},
): Promise<Response> {
  return fetchApiResponse(url, options, 3 * 60 * 1000);
}
