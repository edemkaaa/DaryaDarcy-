/** Serialize each owner's read/compare/write across browser tabs. */
export async function withQuizStorageLock<T>(
  ownerId: number | null,
  work: () => T,
): Promise<T> {
  const key = `darcy:quiz:${ownerId ?? "guest"}`;
  if (navigator.locks?.request) {
    return navigator.locks.request(
      key,
      { signal: AbortSignal.timeout(5000) },
      work,
    );
  }
  // Readwrite IndexedDB transactions also serialize across connections/tabs.
  // No localStorage mutation is attempted without an acquired browser lock.
  return new Promise<T>((resolve, reject) => {
    const request = indexedDB.open("darcy-quiz-coordination", 1);
    let db: IDBDatabase | undefined;
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      db?.close();
      reject(
        new Error("Не удалось согласовать сохранение теста между вкладками."),
      );
    }, 5000);
    const fail = (error: unknown) => {
      clearTimeout(timer);
      settled = true;
      db?.close();
      reject(error);
    };
    request.onupgradeneeded = () => request.result.createObjectStore("locks");
    request.onerror = () => fail(request.error);
    request.onblocked = () => fail(new Error("Хранилище теста занято."));
    request.onsuccess = () => {
      db = request.result;
      if (settled) {
        db.close();
        return;
      }
      const transaction = db.transaction("locks", "readwrite");
      let value: T;
      transaction.onerror = () => fail(transaction.error);
      transaction.onabort = () => fail(transaction.error);
      transaction.oncomplete = () => {
        clearTimeout(timer);
        db?.close();
        if (!settled) resolve(value);
        settled = true;
      };
      transaction.objectStore("locks").get(key).onsuccess = () => {
        if (settled) return;
        try {
          value = work();
        } catch (cause) {
          transaction.abort();
          fail(cause);
        }
      };
    };
  });
}
