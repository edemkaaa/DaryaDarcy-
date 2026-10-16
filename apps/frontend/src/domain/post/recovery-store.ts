import type { PostDraft } from "./draft";
import type { PostAttachment, PostSaveSnapshot } from "./save-post";
import { isPersonalDataOwner } from "@/shared/browser/storage";
import { requireUploadedMedia } from "@/shared/media/upload-result";
import { requirePrivateReceipt } from "./private-upload";
import {
  validatePrivatePostVideo,
  requirePrivateVideoReceipt,
  selectPrivatePostVideos,
  type PrivatePostVideo,
} from "./private-video-upload";
import {
  requirePrivatePostPhotoReceipt,
  selectPrivatePostPhotos,
  validatePrivatePostPhoto,
  type PrivatePostPhoto,
} from "./private-photo-upload";

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
  privatePhotos?: PrivatePostPhoto[];
  privateVideos?: PrivatePostVideo[];
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
type FileData = {
  bytes: ArrayBuffer;
  name: string;
  type: string;
  lastModified: number;
};
type StoredAttachment = PostAttachment & { fileData?: FileData };
type StoredPhoto = Omit<PrivatePostPhoto, "file"> & { fileData: FileData };
type StoredVideo = Omit<PrivatePostVideo, "file" | "poster"> & {
  fileData: FileData;
  poster?: StoredPhoto;
};
type StoredRecord =
  | PostRecoveryRecord
  | (Omit<PostRecoveryRecord, "version" | "editor" | "save"> & {
      version: 2;
      editor: Omit<PostEditorSnapshot, "privatePhotos" | "privateVideos"> & {
        privatePhotos?: StoredPhoto[];
        privateVideos?: StoredVideo[];
      };
      save: Omit<PostSaveSnapshot, "privatePhotos" | "privateVideos"> & {
        privatePhotos?: StoredPhoto[];
        privateVideos?: StoredVideo[];
      };
    });
const storageError = () =>
  new Error(
    "Не удалось сохранить черновик на этом устройстве. Освободите место или разрешите хранение данных сайта и попробуйте снова. Не закрывайте редактор.",
  );

function restoreFile(data: FileData): File {
  if (
    !data ||
    !(data.bytes instanceof ArrayBuffer) ||
    typeof data.name !== "string" ||
    typeof data.type !== "string" ||
    !Number.isFinite(data.lastModified)
  )
    throw storageError();
  return new File([data.bytes], data.name, {
    type: data.type,
    lastModified: data.lastModified,
  });
}
function validPhotos(
  editor: PostEditorSnapshot,
  save: PostSaveSnapshot,
): boolean {
  try {
    const selected = editor.privatePhotos ?? [];
    const attempted = save.privatePhotos ?? [];
    if (!Array.isArray(selected) || !Array.isArray(attempted)) return false;
    const keys = new Set<string>();
    for (const photo of selected) {
      validatePrivatePostPhoto(photo);
      if (
        keys.has(photo.key) ||
        (photo.attempted !== undefined && typeof photo.attempted !== "boolean")
      )
        return false;
      keys.add(photo.key);
      if (photo.receipt !== undefined) {
        if (!photo.attempted) return false;
        requirePrivatePostPhotoReceipt(photo.receipt, photo.file);
      }
    }
    selectPrivatePostPhotos(editor.draft.photos, selected);
    const uploadKeys = new Set<string>();
    return attempted.every((photo) => {
      if (uploadKeys.has(photo.key) || !selected.includes(photo)) return false;
      uploadKeys.add(photo.key);
      return true;
    });
  } catch {
    return false;
  }
}

function validVideos(
  editor: PostEditorSnapshot,
  save: PostSaveSnapshot,
): boolean {
  try {
    const selected = editor.privateVideos ?? [],
      attempted = save.privateVideos ?? [];
    if (!Array.isArray(selected) || !Array.isArray(attempted)) return false;
    for (const video of selected) {
      validatePrivatePostVideo(video);
      if (video.attempted !== undefined && typeof video.attempted !== "boolean")
        return false;
      if (video.receipt !== undefined) {
        if (!video.attempted) return false;
        requirePrivateVideoReceipt(video.receipt, video.file);
      }
      const poster = video.poster;
      if (poster) {
        if (
          poster.attempted !== undefined &&
          typeof poster.attempted !== "boolean"
        )
          return false;
        if (poster.receipt !== undefined) {
          if (!poster.attempted) return false;
          requirePrivatePostPhotoReceipt(poster.receipt, poster.file);
        }
      }
    }
    selectPrivatePostVideos(editor.draft.videos, selected);
    const keys = new Set<string>();
    return attempted.every((video) => {
      if (keys.has(video.key) || !selected.includes(video)) return false;
      keys.add(video.key);
      return true;
    });
  } catch {
    return false;
  }
}

/** Binary data uses ArrayBuffer: some WebKit contexts cannot persist Blob/File. */
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
    validPhotos(record.editor, save) &&
    validVideos(record.editor, save) &&
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
    (save.privateUploads === undefined ||
      (Array.isArray(save.privateUploads) &&
        save.privateUploads.every((pair) => {
          if (!Array.isArray(pair) || pair.length !== 2) return false;
          const [item, intent] = pair;
          if (
            !item ||
            !["audio", "document"].includes(item.type) ||
            typeof item.name !== "string" ||
            typeof item.mimeType !== "string" ||
            !(item.file instanceof File) ||
            !intent ||
            typeof intent.key !== "string" ||
            !/^[A-Za-z0-9._:-]{16,128}$/.test(intent.key)
          )
            return false;
          if (intent.receipt === undefined) return true;
          try {
            const receipt = requirePrivateReceipt(intent.receipt);
            return (
              receipt.state === "ready" &&
              receipt.type === item.type &&
              receipt.filename === item.name.trim() &&
              receipt.fileSize === item.file.size
            );
          } catch {
            return false;
          }
        }))) &&
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
  private fileBytes = new WeakMap<File, Promise<ArrayBuffer>>();
  private async fileData(file: File): Promise<FileData> {
    let bytes = this.fileBytes.get(file);
    if (!bytes) {
      bytes = file.arrayBuffer();
      this.fileBytes.set(file, bytes);
      void bytes.catch(() => this.fileBytes.delete(file));
    }
    return {
      bytes: await bytes,
      name: file.name,
      type: file.type,
      lastModified: file.lastModified,
    };
  }
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
    const stored = await transaction<StoredRecord | undefined>(
      "readonly",
      (store, finish) => {
        const request = store.get(this.key());
        request.onsuccess = () => finish(request.result);
      },
    );
    this.assertOwner();
    if (stored === undefined) {
      this.loaded = true;
      return null;
    }
    this.revision = Number.isSafeInteger(stored?.revision)
      ? stored.revision
      : 0;
    let record: PostRecoveryRecord;
    try {
      if (stored.version === 2) {
        const restored = new Map<PostAttachment, PostAttachment>();
        const restore = (attachment: StoredAttachment): PostAttachment => {
          const existing = restored.get(attachment);
          if (existing) return existing;
          const { fileData, ...result } = attachment;
          if (fileData !== undefined) {
            result.file = restoreFile(fileData);
          }
          restored.set(attachment, result);
          return result;
        };
        const restoredPhotos = new Map<StoredPhoto, PrivatePostPhoto>();
        const restorePhoto = (stored: StoredPhoto): PrivatePostPhoto => {
          const existing = restoredPhotos.get(stored);
          if (existing) return existing;
          const { fileData, ...photo } = stored;
          const result = { ...photo, file: restoreFile(fileData) };
          restoredPhotos.set(stored, result);
          return result;
        };
        const restoredVideos = new Map<StoredVideo, PrivatePostVideo>();
        const restoreVideo = (stored: StoredVideo): PrivatePostVideo => {
          const existing = restoredVideos.get(stored);
          if (existing) return existing;
          const { fileData, poster, ...metadata } = stored;
          const result = {
            ...metadata,
            file: restoreFile(fileData),
            ...(poster ? { poster: restorePhoto(poster) } : {}),
          };
          restoredVideos.set(stored, result);
          return result;
        };
        record = {
          ...stored,
          version: 1,
          editor: {
            ...stored.editor,
            attachments: stored.editor.attachments.map(restore),
            privatePhotos: stored.editor.privatePhotos?.map(restorePhoto),
            privateVideos: stored.editor.privateVideos?.map(restoreVideo),
          },
          save: {
            ...stored.save,
            uploaded: stored.save.uploaded.map(([item, uploaded]) => [
              restore(item),
              uploaded,
            ]),
            privateUploads: stored.save.privateUploads?.map(
              ([item, intent]) => [restore(item), intent],
            ),
            privatePhotos: stored.save.privatePhotos?.map(restorePhoto),
            privateVideos: stored.save.privateVideos?.map(restoreVideo),
          },
        };
      } else record = stored as PostRecoveryRecord;
    } catch {
      throw new Error(
        "Локальный черновик повреждён. Сначала проверьте список публикаций, затем удалите локальную копию.",
      );
    }
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
      // File bytes are immutable. Preserve their identity to avoid rereading
      // every attachment on each text checkpoint; metadata remains snapshotted.
      editor.attachments.forEach((item, index) => {
        snapshot.editor.attachments[index].file = item.file;
      });
      save.uploaded.forEach(([item], index) => {
        snapshot.save.uploaded[index][0].file = item.file;
      });
      save.privateUploads?.forEach(([item], index) => {
        snapshot.save.privateUploads![index][0].file = item.file;
      });
      editor.privatePhotos?.forEach((photo, index) => {
        Object.assign(snapshot.editor.privatePhotos![index], {
          file: photo.file,
        });
      });
      save.privatePhotos?.forEach((photo, index) => {
        Object.assign(snapshot.save.privatePhotos![index], {
          file: photo.file,
        });
      });
      const copyVideoFiles = (
        videos: PrivatePostVideo[] | undefined,
        copies: PrivatePostVideo[] | undefined,
      ) => {
        videos?.forEach((video, index) => {
          Object.assign(copies![index], { file: video.file });
          if (video.poster)
            Object.assign(copies![index].poster!, { file: video.poster.file });
        });
      };
      copyVideoFiles(editor.privateVideos, snapshot.editor.privateVideos);
      copyVideoFiles(save.privateVideos, snapshot.save.privateVideos);
      if (!validVideos(snapshot.editor, snapshot.save)) throw storageError();
    } catch {
      return Promise.reject(storageError());
    }
    const action = this.queue.then(async () => {
      this.assertOwner();
      const packed = new Map<PostAttachment, StoredAttachment>();
      const pack = async (item: PostAttachment): Promise<StoredAttachment> => {
        const existing = packed.get(item);
        if (existing) return existing;
        const { file, ...result } = item;
        const attachment: StoredAttachment = result;
        if (file) {
          attachment.fileData = await this.fileData(file);
        }
        packed.set(item, attachment);
        return attachment;
      };
      // Read before opening the transaction: awaiting file I/O inside it would
      // let IndexedDB auto-commit. Keep attachment aliases for upload recovery.
      const attachments: PostAttachment[] = [];
      for (const item of snapshot.editor.attachments)
        attachments.push(await pack(item));
      const uploaded: PostSaveSnapshot["uploaded"] = [];
      for (const [item, result] of snapshot.save.uploaded)
        uploaded.push([await pack(item), result]);
      const privateUploads: NonNullable<PostSaveSnapshot["privateUploads"]> =
        [];
      for (const [item, intent] of snapshot.save.privateUploads ?? [])
        privateUploads.push([await pack(item), intent]);
      const packedPhotos = new Map<PrivatePostPhoto, StoredPhoto>();
      const packPhoto = async (
        photo: PrivatePostPhoto,
      ): Promise<StoredPhoto> => {
        const existing = packedPhotos.get(photo);
        if (existing) return existing;
        const { file, ...metadata } = photo;
        const result = { ...metadata, fileData: await this.fileData(file) };
        packedPhotos.set(photo, result);
        return result;
      };
      const editorPhotos: StoredPhoto[] = [],
        savePhotos: StoredPhoto[] = [];
      for (const photo of snapshot.editor.privatePhotos ?? [])
        editorPhotos.push(await packPhoto(photo));
      for (const photo of snapshot.save.privatePhotos ?? [])
        savePhotos.push(await packPhoto(photo));
      const packedVideos = new Map<PrivatePostVideo, StoredVideo>();
      const packVideo = async (
        video: PrivatePostVideo,
      ): Promise<StoredVideo> => {
        const existing = packedVideos.get(video);
        if (existing) return existing;
        const { file, poster, ...metadata } = video;
        const result = {
          ...metadata,
          fileData: await this.fileData(file),
          ...(poster ? { poster: await packPhoto(poster) } : {}),
        };
        packedVideos.set(video, result);
        return result;
      };
      const editorVideos: StoredVideo[] = [],
        saveVideos: StoredVideo[] = [];
      for (const video of snapshot.editor.privateVideos ?? [])
        editorVideos.push(await packVideo(video));
      for (const video of snapshot.save.privateVideos ?? [])
        saveVideos.push(await packVideo(video));
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
                version: 2,
                ownerId: this.ownerId,
                slot: this.slot,
                revision: next,
                updatedAt: Date.now(),
                editor: {
                  ...snapshot.editor,
                  attachments,
                  privatePhotos: editorPhotos,
                  privateVideos: editorVideos,
                },
                save: {
                  ...snapshot.save,
                  uploaded,
                  privateUploads,
                  privatePhotos: savePhotos,
                  privateVideos: saveVideos,
                },
              } satisfies StoredRecord,
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
