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
const storageError = () =>
  new Error(
    "Не удалось сохранить или прочитать черновик статьи на устройстве. Не закрывайте редактор; разрешите хранение данных сайта или освободите место.",
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
    ) => void,
    editingId?: number | null,
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
            const read =
              editingId === undefined
                ? store.getAll(
                    IDBKeyRange.bound(
                      `${this.ownerId}:`,
                      `${this.ownerId}:\uffff`,
                    ),
                  )
                : store.get(this.key(editingId));
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
      } catch {
        fail();
      }
    });
  }
  load(): Promise<ArticleDraftRecord[]> {
    return this.transaction("readonly", (_store, value, finish) =>
      finish((value as unknown[]).map((record) => parse(record, this.ownerId))),
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
      (store, value, finish) => {
        this.requireRevision(value, expected);
        store.put(record, this.key(snapshot.editingId));
        finish(record);
      },
      snapshot.editingId,
    );
  }
  clear(editingId: number | null, expected: string | null): Promise<void> {
    return this.transaction(
      "readwrite",
      (store, value, finish) => {
        this.requireRevision(value, expected);
        store.delete(this.key(editingId));
        finish(undefined);
      },
      editingId,
    );
  }
  private requireRevision(value: unknown, expected: string | null) {
    const revision =
      value === undefined ? null : parse(value, this.ownerId).revision;
    if (revision !== expected)
      throw new Error(
        "Черновик статьи изменился в другой вкладке. Текущий ввод не перезаписан; скопируйте его перед перезагрузкой страницы.",
      );
  }
}
