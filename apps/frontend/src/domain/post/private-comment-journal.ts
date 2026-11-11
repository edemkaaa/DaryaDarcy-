/** Локальный журнал комментария ограничен аккаунтом и постом; сохранённая версия защищает от перезаписи другим редактором. */
import {
  requirePrivateCommentRecord,
  type PrivateCommentRecord,
  type PrivateCommentPhoto,
} from "./private-comment-save";
import { isPersonalDataOwner } from "@/shared/browser/storage";
type StoredFile = Omit<PrivateCommentPhoto, "file"> & {
  data: {
    bytes: ArrayBuffer;
    name: string;
    type: string;
    lastModified: number;
  };
};
type Stored = {
  revision: number;
  record: Omit<PrivateCommentRecord, "files"> & { files: StoredFile[] };
};
const failed = () =>
  new Error(
    "Не удалось проверить сохранённый комментарий на этом устройстве. Новая отправка не начата.",
  );
const changed = () =>
  new Error(
    "Сохранённая отправка комментария изменилась. Откройте обсуждение заново.",
  );
async function pack(record: PrivateCommentRecord): Promise<Stored["record"]> {
  requirePrivateCommentRecord(record);
  const snapshot = { ...record };
  const files = await Promise.all(
    record.files.map(async ({ file, ...intent }) => ({
      ...intent,
      data: {
        bytes: await file.arrayBuffer(),
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
      },
    })),
  );
  return { ...snapshot, files };
}
function unpack(value: unknown): {
  stored: Stored;
  record: PrivateCommentRecord;
} {
  const stored = value as Stored;
  if (
    !stored ||
    Object.keys(stored).some((key) => !["revision", "record"].includes(key)) ||
    !Number.isSafeInteger(stored.revision) ||
    stored.revision < 1 ||
    !Array.isArray(stored.record?.files)
  )
    throw failed();
  const files = stored.record.files.map(({ data, ...intent }) => {
    if (
      !data ||
      Object.keys(data).some(
        (key) => !["bytes", "name", "type", "lastModified"].includes(key),
      ) ||
      !(data.bytes instanceof ArrayBuffer) ||
      typeof data.name !== "string" ||
      typeof data.type !== "string" ||
      !Number.isFinite(data.lastModified)
    )
      throw failed();
    return {
      ...intent,
      file: new File([data.bytes], data.name, {
        type: data.type,
        lastModified: data.lastModified,
      }),
    };
  });
  return {
    stored,
    record: requirePrivateCommentRecord({ ...stored.record, files }),
  };
}
function sameIntent(a: Stored["record"], b: Stored["record"]): boolean {
  if (
    JSON.stringify([a.ownerId, a.postId, a.parentId, a.text, a.key]) !==
      JSON.stringify([b.ownerId, b.postId, b.parentId, b.text, b.key]) ||
    a.files.length !== b.files.length
  )
    return false;
  return a.files.every((file, index) => {
    const next = b.files[index];
    if (
      JSON.stringify([
        file.key,
        file.data.name,
        file.data.type,
        file.data.lastModified,
      ]) !==
      JSON.stringify([
        next.key,
        next.data.name,
        next.data.type,
        next.data.lastModified,
      ])
    )
      return false;
    const before = new Uint8Array(file.data.bytes),
      after = new Uint8Array(next.data.bytes);
    return (
      before.length === after.length &&
      before.every((byte, i) => byte === after[i])
    );
  });
}
function advances(before: Stored["record"], after: Stored["record"]): boolean {
  return (
    sameIntent(before, after) &&
    (before.phase !== "write" ||
      (after.phase === "write" && after.payloadJson === before.payloadJson)) &&
    (before.savedId === null || before.savedId === after.savedId) &&
    before.files.every(
      (file, i) =>
        (!file.attempted || after.files[i].attempted) &&
        (!file.receipt ||
          (file.receipt.assetId === after.files[i].receipt?.assetId &&
            (file.receipt.state !== "ready" ||
              JSON.stringify(file.receipt) ===
                JSON.stringify(after.files[i].receipt)))),
    )
  );
}
/** One account/post slot. File bytes are explicit buffers, never session tokens or S3 keys. */
export class PrivateCommentJournal {
  private revision: number | null = null;
  constructor(
    readonly ownerId: number,
    readonly postId: number,
  ) {}
  private assertOwner(record?: PrivateCommentRecord) {
    if (
      !isPersonalDataOwner(this.ownerId) ||
      !Number.isSafeInteger(this.postId) ||
      this.postId <= 0 ||
      (record &&
        (record.ownerId !== this.ownerId || record.postId !== this.postId))
    )
      throw changed();
  }
  private async transaction<T>(
    mode: IDBTransactionMode,
    work: (
      store: IDBObjectStore,
      value: unknown,
      finish: (result: T) => void,
    ) => void,
  ): Promise<T> {
    this.assertOwner();
    return new Promise((resolve, reject) => {
      let db: IDBDatabase | undefined,
        tx: IDBTransaction | undefined,
        result: T,
        done = false;
      const fail = (error: unknown = failed()) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          tx?.abort();
        } catch {
          /* Already completed. */
        }
        db?.close();
        reject(error);
      };
      const timer = setTimeout(() => fail(), 5000);
      try {
        const opening = indexedDB.open("darcy-private-comments", 1);
        opening.onupgradeneeded = () =>
          opening.result.createObjectStore("operations");
        opening.onerror = opening.onblocked = () => fail();
        opening.onsuccess = () => {
          db = opening.result;
          if (done) {
            db.close();
            return;
          }
          db.onversionchange = () => db?.close();
          try {
            this.assertOwner();
            tx = db.transaction("operations", mode, { durability: "strict" });
            tx.onerror = tx.onabort = () => fail();
            tx.oncomplete = () => {
              if (done) return;
              try {
                this.assertOwner();
              } catch (error) {
                fail(error);
                return;
              }
              done = true;
              clearTimeout(timer);
              db?.close();
              resolve(result);
            };
            const store = tx.objectStore("operations"),
              read = store.get(`${this.ownerId}:${this.postId}`);
            read.onsuccess = () => {
              try {
                this.assertOwner();
                work(store, read.result, (value) => {
                  result = value;
                });
              } catch (error) {
                fail(error);
              }
            };
          } catch (error) {
            fail(error);
          }
        };
      } catch (error) {
        fail(error);
      }
    });
  }
  async load(): Promise<PrivateCommentRecord | null> {
    const loaded = await this.transaction<{
      revision: number;
      record: PrivateCommentRecord;
    } | null>("readonly", (_store, value, finish) => {
      if (value === undefined) {
        finish(null);
        return;
      }
      const { stored, record } = unpack(value);
      this.assertOwner(record);
      finish({ revision: stored.revision, record });
    });
    this.revision = loaded?.revision ?? null;
    return loaded?.record ?? null;
  }
  async prepare(
    record: PrivateCommentRecord,
  ): Promise<{ record: PrivateCommentRecord; restored: boolean }> {
    this.assertOwner(record);
    const packed = await pack(record);
    this.assertOwner(record);
    const result = await this.transaction<{
      revision: number;
      record: PrivateCommentRecord;
      restored: boolean;
    }>("readwrite", (store, value, finish) => {
      if (value !== undefined) {
        const previous = unpack(value);
        this.assertOwner(previous.record);
        finish({
          revision: previous.stored.revision,
          record: previous.record,
          restored: true,
        });
        return;
      }
      store.put(
        { revision: 1, record: packed },
        `${this.ownerId}:${this.postId}`,
      );
      finish({ revision: 1, record, restored: false });
    });
    this.revision = result.revision;
    return { record: result.record, restored: result.restored };
  }
  async checkpoint(record: PrivateCommentRecord): Promise<void> {
    this.assertOwner(record);
    const expected = this.revision;
    if (expected === null || expected === Number.MAX_SAFE_INTEGER)
      throw changed();
    const packed = await pack(record);
    this.assertOwner(record);
    await this.transaction<void>("readwrite", (store, value, finish) => {
      const previous = unpack(value);
      this.assertOwner(previous.record);
      if (
        previous.stored.revision !== expected ||
        !advances(previous.stored.record, packed)
      )
        throw changed();
      store.put(
        { revision: expected + 1, record: packed },
        `${this.ownerId}:${this.postId}`,
      );
      finish(undefined);
    });
    this.revision = expected + 1;
  }
  async clear(record: PrivateCommentRecord): Promise<void> {
    this.assertOwner(record);
    requirePrivateCommentRecord(record);
    const expected = this.revision;
    if (expected === null) throw changed();
    const packed = await pack(record);
    this.assertOwner(record);
    await this.transaction<void>("readwrite", (store, value, finish) => {
      const previous = unpack(value);
      this.assertOwner(previous.record);
      if (
        previous.stored.revision !== expected ||
        !advances(previous.stored.record, packed)
      )
        throw changed();
      store.delete(`${this.ownerId}:${this.postId}`);
      finish(undefined);
    });
    this.revision = null;
  }
}
