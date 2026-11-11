/** Minimal transaction transport double. NOT native IndexedDB scheduling/browser acceptance. */
export function journalObjectStore() {
  // Минимальный транспортный double проверяет протокол журнала, но не заменяет native IndexedDB и её расписание.

  const records = new Map<string, unknown>();
  const noBlobs = (value: unknown, seen = new Set<object>()) => {
    // Рекурсивно моделирует отсутствие поддержки File, обходя циклы объектов без зацикливания.

    if (value instanceof Blob)
      throw new DOMException("File storage unsupported", "DataCloneError");
    if (!value || typeof value !== "object" || seen.has(value)) return;
    seen.add(value);
    for (const item of Object.values(value)) noBlobs(item, seen);
  };
  type Events = {
    oncomplete?: () => void;
    onabort?: () => void;
    onerror?: () => void;
  };
  const factory = {
    open() {
      // Имитирует асинхронное открытие object store через microtask, без записи браузерных данных.

      const opened: { result?: unknown; onsuccess?: () => void } = {};
      queueMicrotask(() => {
        opened.result = {
          close() {
            // Пустое закрытие допустимо для in-memory double; настоящие ресурсы IndexedDB здесь не моделируются.
},
          transaction() {
            // Буферизует изменения отдельно от основного Map и применяет их только в имитации успешного завершения.

            let aborted = false;
            const writes = new Map<string, unknown>();
            const deleted = new Set<string>();
            const tx: Events & { abort(): void; objectStore(): unknown } = {
              abort() {
                // Отмечает транзакцию отменённой до microtask, запрещая применение накопленных записей.

                aborted = true;
                queueMicrotask(() => tx.onabort?.());
              },
              objectStore() {
                // Предоставляет лишь операции, необходимые журналу; полного поведения IDB API этот double не обещает.

                return {
                  get(key: string) {
                    // Возвращает clone и запускает обработчик; ошибка обработчика отменяет ещё не применённые записи транзакции.

                    const request: {
                      result?: unknown;
                      onsuccess?: () => void;
                    } = {};
                    queueMicrotask(() => {
                      request.result = structuredClone(records.get(key));
                      try {
                        request.onsuccess?.();
                      } catch {
                        tx.abort();
                      }
                      queueMicrotask(() => {
                        if (aborted) return;
                        for (const key of deleted) records.delete(key);
                        for (const [key, value] of writes)
                          records.set(key, value);
                        tx.oncomplete?.();
                      });
                    });
                    return request;
                  },
                  put(value: unknown, key: string) {
                    // Проверяет клонируемость поддерживаемого режима и откладывает запись до завершения.

                    noBlobs(value);
                    writes.set(key, structuredClone(value));
                  },
                  delete(key: string) {
                    // Планирует удаление ключа, не меняя хранилище до commit microtask.

                    deleted.add(key);
                  },
                };
              },
            };
            return tx;
          },
        };
        opened.onsuccess?.();
      });
      return opened;
    },
  };
  return { records, factory: factory as unknown as IDBFactory };
}
