import type { PostDraft } from "./draft";
import type { PostAttachment, PostSaveSnapshot } from "./save-post";
import { isPersonalDataOwner } from "@/shared/browser/storage";
import { requireUploadedMedia } from "@/shared/media/upload-result";

export type PendingPostUpload = {
  id: number;
  name: string;
  sending: boolean;
  uncertain: boolean;
};
export type PostEditorSnapshot = {
  draft: PostDraft;
  attachments: PostAttachment[];
  removedIds: number[];
  pending: PendingPostUpload[];
};
export type PostRecoveryRecord = {
  version: 1;
  ownerId: number;
  slot: string;
  revision: number;
  updatedAt: number;
  editor: PostEditorSnapshot;
  save: PostSaveSnapshot;
};
const DATABASE = "darcy-post-drafts";
const STORE = "drafts";
const storageError = () =>
  new Error(
    "Не удалось сохранить черновик на этом устройстве. Освободите место или разрешите хранение данных сайта и попробуйте снова. Не закрывайте редактор.",
  );

/** Files use IndexedDB structured cloning; no base64 copies or unowned localStorage. */
function transaction<T>(
  mode: IDBTransactionMode,
  work: (
    store: IDBObjectStore,
    finish: (value: T) => void,
    fail: (error: Error) => void,
  ) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let database: IDBDatabase | undefined;
    let tx: IDBTransaction | undefined;
    let value: T;
    let settled = false;
    const fail = (error = storageError()) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        tx?.abort();
      } catch {
        /* The transaction may already have ended. */
      }
      database?.close();
      reject(error);
    };
    const timer = setTimeout(() => fail(), 5000);
    try {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
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
          tx = database.transaction(STORE, mode, { durability: "strict" });
          tx.onabort = () => fail();
          tx.onerror = () => fail();
          tx.oncomplete = () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            database?.close();
            resolve(value);
          };
          work(
            tx.objectStore(STORE),
            (result) => {
              value = result;
            },
            fail,
          );
        } catch {
          fail();
        }
      };
    } catch {
      fail();
    }
  });
}

function validRecord(
  record: PostRecoveryRecord,
  ownerId: number,
  slot: string,
): boolean {
  if (!record || typeof record !== "object") return false;
  const draft = record.editor?.draft;
  const save = record.save;
  return Boolean(
    record.version === 1 &&
    record.ownerId === ownerId &&
    record.slot === slot &&
    Number.isSafeInteger(record.revision) &&
    record.revision > 0 &&
    Number.isFinite(record.updatedAt) &&
    draft &&
    typeof draft.text === "string" &&
    ["feed", "club", "both"].includes(draft.target) &&
    ["draft", "scheduled", "published"].includes(draft.status) &&
    draft.publishedAt instanceof Date &&
    (draft.scheduledAt === null || draft.scheduledAt instanceof Date) &&
    [draft.photos, draft.videos, draft.tags].every(
      (list) =>
        Array.isArray(list) && list.every((item) => typeof item === "string"),
    ) &&
    Array.isArray(record.editor.attachments) &&
    record.editor.attachments.every(
      (item) =>
        item &&
        ["audio", "document"].includes(item.type) &&
        typeof item.name === "string" &&
        typeof item.mimeType === "string" &&
        (item.file === undefined || item.file instanceof File),
    ) &&
    Array.isArray(record.editor.removedIds) &&
    record.editor.removedIds.every(
      (id) => Number.isSafeInteger(id) && id > 0,
    ) &&
    Array.isArray(record.editor.pending) &&
    record.editor.pending.every(
      (item) =>
        item &&
        Number.isSafeInteger(item.id) &&
        typeof item.name === "string" &&
        typeof item.sending === "boolean" &&
        typeof item.uncertain === "boolean",
    ) &&
    save &&
    ["idle", "upload", "create", "update", "complete"].includes(save.phase) &&
    (save.savedId === null ||
      (Number.isSafeInteger(save.savedId) && save.savedId > 0)) &&
    Array.isArray(save.uploaded) &&
    save.uploaded.every((pair) => {
      if (!Array.isArray(pair) || pair.length !== 2) return false;
      const [attachment, uploaded] = pair;
      if (
        !attachment ||
        !["audio", "document"].includes(attachment.type) ||
        typeof attachment.name !== "string" ||
        !uploaded ||
        uploaded.type !== attachment.type ||
        typeof uploaded.filename !== "string"
      )
        return false;
      try {
        requireUploadedMedia(uploaded);
        return true;
      } catch {
        return false;
      }
    }) &&
    (!["update", "complete"].includes(save.phase) || save.savedId !== null) &&
    (save.phase !== "create" ||
      (save.savedId === null &&
        save.creationIntent &&
        /^[A-Za-z0-9._:-]{16,128}$/.test(save.creationIntent.key) &&
        typeof save.creationIntent.payloadJson === "string" &&
        (() => {
          try {
            return (
              typeof JSON.parse(save.creationIntent!.payloadJson)?.text ===
              "string"
            );
          } catch {
            return false;
          }
        })())),
  );
}

/** Revision comparison prevents another tab from overwriting a restored intent. */
export class PostRecoveryJournal {
  private revision = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private closed = false;
  private loaded = false;
  constructor(
    readonly ownerId: number,
    readonly slot: string,
  ) {}
  private key() {
    return `${this.ownerId}:${this.slot}`;
  }
  private assertOwner() {
    if (!isPersonalDataOwner(this.ownerId))
      throw new Error("Войдите в аккаунт владельца черновика");
  }
  async load(): Promise<PostRecoveryRecord | null> {
    this.assertOwner();
    const record = await transaction<PostRecoveryRecord | undefined>(
      "readonly",
      (store, finish) => {
        const request = store.get(this.key());
        request.onsuccess = () => finish(request.result);
      },
    );
    this.assertOwner();
    if (record === undefined) {
      this.loaded = true;
      return null;
    }
    this.revision = Number.isSafeInteger(record?.revision)
      ? record.revision
      : 0;
    if (!validRecord(record, this.ownerId, this.slot))
      throw new Error(
        "Локальный черновик повреждён. Сначала проверьте список публикаций, затем удалите локальную копию.",
      );
    this.loaded = true;
    return record;
  }
  write(editor: PostEditorSnapshot, save: PostSaveSnapshot): Promise<void> {
    if (this.closed) return Promise.reject(new Error("Редактор уже закрыт"));
    if (!this.loaded)
      return Promise.reject(
        new Error(
          "Не удалось проверить сохранённый черновик. Откройте редактор заново.",
        ),
      );
    // Capture now: later form edits must not alter a queued durable request.
    let snapshot: { editor: PostEditorSnapshot; save: PostSaveSnapshot };
    try {
      snapshot = structuredClone({ editor, save });
    } catch {
      return Promise.reject(storageError());
    }
    const action = this.queue.then(async () => {
      this.assertOwner();
      const revision = await transaction<number>(
        "readwrite",
        (store, finish, fail) => {
          const request = store.get(this.key());
          request.onsuccess = () => {
            const current = request.result as PostRecoveryRecord | undefined;
            if ((current?.revision ?? 0) !== this.revision) {
              fail(
                new Error(
                  "Черновик изменён в другой вкладке. Откройте редактор заново перед продолжением.",
                ),
              );
              return;
            }
            const next = this.revision + 1;
            store.put(
              {
                version: 1,
                ownerId: this.ownerId,
                slot: this.slot,
                revision: next,
                updatedAt: Date.now(),
                ...snapshot,
              } satisfies PostRecoveryRecord,
              this.key(),
            );
            finish(next);
          };
        },
      );
      this.revision = revision;
    });
    this.queue = action.catch(() => {});
    return action;
  }
  clear(): Promise<void> {
    this.closed = true;
    const action = this.queue.then(async () => {
      this.assertOwner();
      await transaction<void>("readwrite", (store, finish, fail) => {
        const request = store.get(this.key());
        request.onsuccess = () => {
          const storedRevision = request.result?.revision;
          const revision = Number.isSafeInteger(storedRevision)
            ? storedRevision
            : 0;
          if (revision !== this.revision) {
            fail(
              new Error(
                "Черновик изменён в другой вкладке. Откройте редактор заново.",
              ),
            );
            return;
          }
          store.delete(this.key());
          finish();
        };
      });
    });
    this.queue = action.catch(() => {});
    return action;
  }
}
