import { z } from "zod";
import { isPersonalDataOwner } from "@/shared/browser/storage";
import { invalidResponse } from "@/shared/api/errors";
import { articleDraftSchema } from "./article-creation-journal";
import {
  selectArticleFiles,
  type PrivateArticleFile,
} from "./private-article-files";

const keySchema = z.string().regex(/^[A-Za-z0-9._:-]{16,128}$/);
const uploadSchema = z
  .object({
    base64: z
      .string()
      .min(4)
      .max(6 * 1024 * 1024)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
    filename: z.string().min(1).max(512),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    purpose: z.literal("publicCover"),
  })
  .strict();
const snapshotSchema = articleDraftSchema.extend({
  editingId: z.number().int().positive().safe().nullable(),
});
const packedSchema = z
  .object({
    version: z.literal(1),
    ownerId: z.number().int().positive().safe(),
    idempotencyKey: keySchema,
    snapshot: snapshotSchema,
    upload: uploadSchema,
    files: z.array(
      z
        .object({
          key: keySchema,
          usage: z.enum(["articlePhoto", "articleDocument"]),
          bytes: z.custom<ArrayBuffer>(
            (value) =>
              value instanceof ArrayBuffer &&
              value.byteLength > 0 &&
              value.byteLength <= 32 * 1024 * 1024,
          ),
          name: z.string().min(1).max(512),
          type: z.string(),
          lastModified: z.number().finite(),
        })
        .strict(),
    ),
  })
  .strict();
export type ArticleCoverSnapshot = z.infer<typeof snapshotSchema>;
export type ArticleCoverUpload = z.infer<typeof uploadSchema>;
export type ArticleCoverRecord = Omit<z.infer<typeof packedSchema>, "files"> & {
  files: PrivateArticleFile[];
};

function restoreRecord(value: unknown, ownerId: number): ArticleCoverRecord {
  const stored = packedSchema.parse(value);
  if (stored.ownerId !== ownerId) throw storageError();
  const files = stored.files.map(
    ({ key, usage, bytes, name, type, lastModified }) => ({
      key,
      usage,
      file: new File([bytes], name, { type, lastModified }),
    }),
  );
  if (
    selectArticleFiles(stored.snapshot.sections, files).length !== files.length
  )
    throw storageError();
  return { ...stored, files };
}
export function requirePublicCoverReceipt(value: unknown) {
  const result = z
    .union([
      z.object({ state: z.enum(["missing", "pending"]) }).strict(),
      z
        .object({
          state: z.literal("ready"),
          url: z
            .string()
            .url()
            .regex(/^https?:\/\//),
          avatarApplied: z.literal(false),
          isCurrent: z.null(),
        })
        .strict(),
    ])
    .safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data;
}
const storageError = () =>
  new Error(
    "Не удалось сохранить или прочитать загрузку баннера на этом устройстве. Проверьте доступность хранилища браузера.",
  );

/** One immutable cover intent per account, separate from article publication. */
export class ArticleCoverJournal {
  constructor(readonly ownerId: number) {}
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
        reject(error);
      };
      const timer = setTimeout(() => fail(), 5000);
      try {
        const request = indexedDB.open("darcy-article-covers", 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("operations");
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
            tx = database.transaction("operations", mode, {
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
            const store = tx.objectStore("operations");
            const read = store.get(this.ownerId);
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
  load(): Promise<ArticleCoverRecord | null> {
    return this.transaction("readonly", (_store, value, finish) =>
      finish(value === undefined ? null : restoreRecord(value, this.ownerId)),
    );
  }
  async prepare(
    snapshot: ArticleCoverSnapshot,
    upload: Omit<ArticleCoverUpload, "mimeType"> & { mimeType: string },
    files: PrivateArticleFile[],
  ) {
    this.assertOwner();
    const proposed = {
      version: 1 as const,
      ownerId: this.ownerId,
      idempotencyKey: crypto.randomUUID(),
      snapshot: snapshotSchema.parse(snapshot),
      upload: uploadSchema.parse(upload),
      files: await Promise.all(
        selectArticleFiles(snapshot.sections, files).map(
          async ({ key, usage, file }) => ({
            key,
            usage,
            bytes: await file.arrayBuffer(),
            name: file.name,
            type: file.type,
            lastModified: file.lastModified,
          }),
        ),
      ),
    };
    const record = restoreRecord(proposed, this.ownerId);
    return this.transaction<{ record: ArticleCoverRecord; restored: boolean }>(
      "readwrite",
      (store, value, finish) => {
        if (value !== undefined) {
          finish({
            record: restoreRecord(value, this.ownerId),
            restored: true,
          });
          return;
        }
        store.put(proposed, this.ownerId);
        finish({ record, restored: false });
      },
    );
  }
  async requireCurrent(record: ArticleCoverRecord) {
    const current = await this.load();
    if (
      current?.idempotencyKey !== record.idempotencyKey ||
      record.ownerId !== this.ownerId
    )
      throw new Error(
        "Загрузка баннера изменилась в другой вкладке. Откройте статьи заново.",
      );
  }
  clear(record: ArticleCoverRecord): Promise<void> {
    return this.transaction("readwrite", (store, value, finish) => {
      const current =
        value === undefined ? null : restoreRecord(value, this.ownerId);
      if (
        current?.idempotencyKey !== record.idempotencyKey ||
        record.ownerId !== this.ownerId
      )
        throw new Error(
          "Загрузка баннера изменилась в другой вкладке. Откройте статьи заново.",
        );
      store.delete(this.ownerId);
      finish(undefined);
    });
  }
}
