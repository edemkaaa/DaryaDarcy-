import { ApiError } from "./errors";

let sessionRequests = new AbortController();

/** Local file preparation must belong to the same session as its subsequent upload. */
export function getSessionRequestSignal(): AbortSignal {
  return sessionRequests.signal;
}

/** Invalidate every outstanding read and mutation before changing identities. */
export function cancelSessionRequests(): void {
  sessionRequests.abort();
  sessionRequests = new AbortController();
}

/** The deadline covers both fetch and consuming the body; caller cancellation is preserved. */
export async function runApiRequest<T>(
  url: RequestInfo | URL,
  options: RequestInit,
  consume: (response: Response) => Promise<T>,
  timeoutMs = 15_000,
  sessionBound = true,
): Promise<T> {
  const controller = new AbortController();
  const sources = [
    options.signal,
    sessionBound ? sessionRequests.signal : undefined,
  ].filter((signal): signal is AbortSignal => Boolean(signal));
  let rejectAbort: (error: ApiError) => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
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

export function fetchApiResponse(
  url: RequestInfo | URL,
  options: RequestInit = {},
): Promise<Response> {
  // tRPC consumes JSON after fetch returns. Buffer inside the deadline to avoid a hung body.
  return runApiRequest(
    url,
    { ...options, cache: "no-store" },
    async (response) =>
      new Response(
        [204, 205, 304].includes(response.status)
          ? null
          : await response.arrayBuffer(),
        {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        },
      ),
  );
}
