/** Редактируемый черновик статьи хранится отдельно от уже отправленной операции; ревизия локальной записи выявляет конфликт вкладок. */
import { z } from "zod";
import { isPersonalDataOwner } from "@/shared/browser/storage";
import { articleDraftSchema } from "./article-creation-journal";
import {
  selectArticleFiles,
  type PrivateArticleFile,
} from "./private-article-files";

const snapshotSchema = articleDraftSchema.extend({
  editingId: z.number().int().positive().safe().nullable(),
  writeUncertain: z.boolean().optional(),
  editConflict: z.union([z.literal(409), z.literal(412)]).optional(),
});
export type ArticleDraftSnapshot = z.infer<typeof snapshotSchema>;
export type ArticleDraftRecord = {
  version: 1;
  ownerId: number;
  revision: string;
  snapshot: ArticleDraftSnapshot;
  files: PrivateArticleFile[];
};
export type DamagedArticleDraft = { key: string };
export type ArticleDraftInspection = {
  records: ArticleDraftRecord[];
  damaged: DamagedArticleDraft[];
};
const storageError = () =>
  new Error(
    "Не удалось сохранить или прочитать черновик статьи на устройстве. Не закрывайте редактор.",
  );
function parse(value: unknown, ownerId: number): ArticleDraftRecord {
  const record = value as ArticleDraftRecord;
  if (
    !record ||
    record.version !== 1 ||
    record.ownerId !== ownerId ||
    typeof record.revision !== "string" ||
    !record.revision ||
    !Array.isArray(record.files)
  )
    throw storageError();
  const snapshot = snapshotSchema.parse(record.snapshot);
  // IndexedDB preserves File objects, not temporary blob URLs. Reject lost or extra files.
  const files = selectArticleFiles(snapshot.sections, record.files);
  if (files.length !== record.files.length) throw storageError();
  return { version: 1, ownerId, revision: record.revision, snapshot, files };
}

/** Drafts are separate per account/article; revisions protect concurrent tabs. */
export class ArticleDraftJournal {
  constructor(readonly ownerId: number) {}
  private key(editingId: number | null) {
    return `${this.ownerId}:${editingId ?? "new"}`;
  }
  private parseEntry(key: string, value: unknown) {
    const record = parse(value, this.ownerId);
    if (key !== this.key(record.snapshot.editingId)) throw storageError();
    return record;
  }
  private assertOwner() {
    if (!isPersonalDataOwner(this.ownerId))
      throw new Error("Аккаунт редактора изменился. Откройте статьи заново.");
  }
  private transaction<T>(
    mode: IDBTransactionMode,
    work: (
      store: IDBObjectStore,
      value: unknown,
      finish: (result: T) => void,
      exists: boolean,
    ) => void,
    editingId?: number | null | string,
  ): Promise<T> {
    this.assertOwner();
    return new Promise((resolve, reject) => {
      let database: IDBDatabase | undefined;
      let tx: IDBTransaction | undefined;
      let result: T;
      let settled = false;
      const fail = (error: unknown = storageError()) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        try {
          tx?.abort();
        } catch {
          /* Already completed. */
        }
        database?.close();
        reject(error instanceof DOMException ? storageError() : error);
      };
      const timer = setTimeout(() => fail(), 5000);
      try {
        const request = indexedDB.open("darcy-article-drafts", 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("drafts");
        request.onerror = () => fail();
        request.onblocked = () => fail();
        request.onsuccess = () => {
          database = request.result;
          if (settled) {
            database.close();
            return;
          }
          database.onversionchange = () => database?.close();
          try {
            this.assertOwner();
            tx = database.transaction("drafts", mode, {
              durability: "strict",
            });
            tx.onerror = () => fail();
            tx.onabort = () => fail();
            tx.oncomplete = () => {
              if (settled) return;
              try {
                this.assertOwner();
              } catch (error) {
                fail(error);
                return;
              }
              settled = true;
              clearTimeout(timer);
              database?.close();
              resolve(result);
            };
            const store = tx.objectStore("drafts");
            const apply = (value: unknown, exists = true) => {
              try {
                this.assertOwner();
                work(
                  store,
                  value,
                  (value) => {
                    result = value;
                  },
                  exists,
                );
              } catch (error) {
                fail(error);
              }
            };
            if (editingId === undefined) {
              const entries: { key: string; value: unknown }[] = [];
              const read = store.openCursor(
                IDBKeyRange.bound(`${this.ownerId}:`, `${this.ownerId}:\uffff`),
              );
              read.onsuccess = () => {
                const cursor = read.result;
                if (!cursor) {
                  apply(entries);
                  return;
                }
                entries.push({ key: String(cursor.key), value: cursor.value });
                cursor.continue();
              };
            } else {
              const read = store.openCursor(
                IDBKeyRange.only(
                  typeof editingId === "string"
                    ? editingId
                    : this.key(editingId),
                ),
              );
              read.onsuccess = () =>
                apply(read.result?.value, read.result !== null);
            }
          } catch (error) {
            fail(error);
          }
        };
      } catch {
        fail();
      }
    });
  }
  inspect(): Promise<ArticleDraftInspection> {
    return this.transaction("readonly", (_store, value, finish) => {
      const result: ArticleDraftInspection = { records: [], damaged: [] };
      for (const entry of value as { key: string; value: unknown }[]) {
        try {
          result.records.push(this.parseEntry(entry.key, entry.value));
        } catch {
          result.damaged.push({ key: entry.key });
        }
      }
      finish(result);
    });
  }
  async load(): Promise<ArticleDraftRecord[]> {
    return (await this.inspect()).records;
  }
  /** Keep the original structured clone (including File bytes) atomically. */
  archiveDamaged(key: string): Promise<void> {
    if (!key.startsWith(`${this.ownerId}:`)) throw storageError();
    return this.transaction(
      "readwrite",
      (store, value, finish, exists) => {
        if (!exists)
          throw new Error(
            "Черновик уже изменился. Повторите чтение черновиков.",
          );
        let damaged = false;
        try {
          this.parseEntry(key, value);
        } catch {
          damaged = true;
        }
        if (!damaged)
          throw new Error(
            "Черновик уже восстановлен в другой вкладке. Повторите чтение черновиков.",
          );
        store.add(
          { originalKey: key, record: value },
          `recovery:${this.ownerId}:${crypto.randomUUID()}`,
        );
        store.delete(key);
        finish(undefined);
      },
      key,
    );
  }
  save(
    snapshot: ArticleDraftSnapshot,
    files: PrivateArticleFile[],
    expected: string | null,
  ): Promise<ArticleDraftRecord> {
    const record = parse(
      {
        version: 1,
        ownerId: this.ownerId,
        revision: crypto.randomUUID(),
        snapshot,
        files: selectArticleFiles(snapshot.sections, files),
      },
      this.ownerId,
    );
    return this.transaction(
      "readwrite",
      (store, value, finish, exists) => {
        this.requireRevision(value, expected, snapshot.editingId, exists);
        store.put(record, this.key(snapshot.editingId));
        finish(record);
      },
      snapshot.editingId,
    );
  }
  clear(editingId: number | null, expected: string | null): Promise<void> {
    return this.transaction(
      "readwrite",
      (store, value, finish, exists) => {
        this.requireRevision(value, expected, editingId, exists);
        store.delete(this.key(editingId));
        finish(undefined);
      },
      editingId,
    );
  }
  private requireRevision(
    value: unknown,
    expected: string | null,
    editingId: number | null,
    exists: boolean,
  ) {
    const revision = !exists
      ? null
      : this.parseEntry(this.key(editingId), value).revision;
    if (revision !== expected)
      throw new Error(
        "Черновик статьи изменился в другой вкладке. Текущий ввод не перезаписан; скопируйте его перед перезагрузкой страницы.",
      );
  }
}
