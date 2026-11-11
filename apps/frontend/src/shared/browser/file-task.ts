/** Локальная подготовка файла тоже имеет срок и сигнал отмены; поздно созданные ресурсы должны освобождаться вызывающей операцией. */
/** Даём локальной обработке общий сигнал с timeout и ждём гонку завершения/отмены; очистку ресурсов позднего task выполняет его реализация. */
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
  /** Один исход прерывает signal и ожидающее Promise.race, даже если нативный декодер не умеет остановиться сразу. */
  const abort = (reason: unknown) => {
    controller.abort(reason);
    rejectAbort(reason);
  };
  /** Переносим причину внешнего abort, чтобы вызывающий код различал отмену владельца и собственный timeout задачи. */
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
