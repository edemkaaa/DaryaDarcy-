/** Minimal transaction transport double. NOT native IndexedDB scheduling/browser acceptance. */
export function journalObjectStore() {
  const records = new Map<string, unknown>();
  const noBlobs = (value: unknown, seen = new Set<object>()) => {
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
      const opened: { result?: unknown; onsuccess?: () => void } = {};
      queueMicrotask(() => {
        opened.result = {
          close() {},
          transaction() {
            let aborted = false;
            const writes = new Map<string, unknown>();
            const deleted = new Set<string>();
            const tx: Events & { abort(): void; objectStore(): unknown } = {
              abort() {
                aborted = true;
                queueMicrotask(() => tx.onabort?.());
              },
              objectStore() {
                return {
                  get(key: string) {
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
                    noBlobs(value);
                    writes.set(key, structuredClone(value));
                  },
                  delete(key: string) {
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
