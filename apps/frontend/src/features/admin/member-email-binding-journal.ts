import { isPersonalDataOwner } from "@/shared/browser/storage";

const DATABASE = "darcy-member-email-intents";
const STORE = "intents";
const keyPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const unavailable = () =>
  new Error(
    "Не удалось прочитать или сохранить ключ проверки заявки на этом устройстве. Проверьте доступность хранилища сайта и повторите проверку.",
  );
type StoredIntent = { version: 1; requestKey: string };
function parse(value: unknown): StoredIntent | null {
  if (value === undefined) return null;
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== 2 ||
    !("version" in value) ||
    value.version !== 1 ||
    !("requestKey" in value) ||
    typeof value.requestKey !== "string" ||
    !keyPattern.test(value.requestKey)
  )
    throw unavailable();
  return { version: 1, requestKey: value.requestKey };
}

/** Durable key only: no email, proof, payload or cached server outcome. Not an authorization source. */
export class MemberEmailBindingJournal {
  constructor(
    readonly ownerId: number,
    readonly userId: number,
  ) {}

  private access<T>(
    mode: IDBTransactionMode,
    signal: AbortSignal,
    work: (
      stored: StoredIntent | null,
      store: IDBObjectStore,
      key: string,
    ) => T,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      let db: IDBDatabase | undefined;
      let tx: IDBTransaction | undefined;
      let result: T;
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", fail);
        db?.close();
      };
      const fail = () => {
        if (settled) return;
        settled = true;
        try {
          tx?.abort();
        } catch {
          /* Already completed. Never report stale success. */
        }
        cleanup();
        reject(unavailable());
      };
      const check = () => {
        if (
          signal.aborted ||
          !isPersonalDataOwner(this.ownerId) ||
          ![this.ownerId, this.userId].every(
            (id) => Number.isSafeInteger(id) && id > 0 && id <= 2147483647,
          )
        )
          throw unavailable();
      };
      const timer = setTimeout(fail, 5000);
      signal.addEventListener("abort", fail, { once: true });
      try {
        check();
        const opening = indexedDB.open(DATABASE, 1);
        opening.onerror = fail;
        opening.onblocked = fail;
        opening.onupgradeneeded = () => {
          if (settled) {
            opening.transaction?.abort();
            return;
          }
          opening.result.createObjectStore(STORE);
        };
        opening.onsuccess = () => {
          db = opening.result;
          if (settled) {
            db.close();
            return;
          }
          db.onversionchange = fail;
          try {
            check();
            tx = db.transaction(STORE, mode, { durability: "strict" });
            tx.onerror = fail;
            tx.onabort = fail;
            tx.oncomplete = () => {
              if (settled) return;
              try {
                check();
              } catch {
                fail();
                return;
              }
              settled = true;
              cleanup();
              resolve(result);
            };
            const store = tx.objectStore(STORE);
            const key = `${this.ownerId}:${this.userId}`;
            const reading = store.get(key);
            reading.onsuccess = () => {
              if (settled) return;
              try {
                check();
                result = work(parse(reading.result), store, key);
              } catch {
                fail();
              }
            };
          } catch {
            fail();
          }
        };
      } catch {
        fail();
      }
    });
  }

  load(signal: AbortSignal): Promise<string | null> {
    return this.access(
      "readonly",
      signal,
      (stored) => stored?.requestKey ?? null,
    );
  }

  reserve(
    signal: AbortSignal,
  ): Promise<{ requestKey: string; created: boolean }> {
    return this.access("readwrite", signal, (stored, store, key) => {
      if (stored) return { requestKey: stored.requestKey, created: false };
      const requestKey = crypto.randomUUID();
      if (!keyPattern.test(requestKey)) throw unavailable();
      store.add({ version: 1, requestKey } satisfies StoredIntent, key);
      return { requestKey, created: true };
    });
  }

  /** Caller must first verify terminal/refused outcome. CAS protects a newer tab's intent. */
  release(requestKey: string, signal: AbortSignal): Promise<boolean> {
    return this.access("readwrite", signal, (stored, store, key) => {
      if (!stored || stored.requestKey !== requestKey) return false;
      store.delete(key);
      return true;
    });
  }
}
