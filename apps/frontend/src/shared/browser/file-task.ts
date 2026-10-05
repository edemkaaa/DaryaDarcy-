/** Bound local decoding/preparation as well as network work. Late resources must be released by the task. */
export async function runFileTask<T>(
  task: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
  timeoutMs = 15_000,
): Promise<T> {
  signal?.throwIfAborted();
  const controller = new AbortController();
  let rejectAbort!: (reason: unknown) => void;
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = reject;
  });
  const abort = (reason: unknown) => {
    controller.abort(reason);
    rejectAbort(reason);
  };
  const cancel = () =>
    abort(
      signal?.reason ?? new DOMException("Операция отменена", "AbortError"),
    );
  const timer = setTimeout(
    () =>
      abort(
        new Error(
          "Обработка файла заняла слишком много времени. Попробуйте другой файл.",
        ),
      ),
    timeoutMs,
  );
  signal?.addEventListener("abort", cancel, { once: true });
  try {
    return await Promise.race([task(controller.signal), aborted]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
  }
}
