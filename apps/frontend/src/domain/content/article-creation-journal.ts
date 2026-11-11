/** Журнал создания статьи хранит неизменяемую полезную нагрузку и ключ операции, чтобы восстановление не создавало другую статью. */
import { z } from "zod";
import { isPersonalDataOwner } from "@/shared/browser/storage";
import { invalidResponse } from "@/shared/api/errors";
import { editBaseSchema, type ContentEditBase } from "./edit-revision";
import {
  selectArticleFiles,
  resolveArticleFiles,
  type PrivateArticleFile,
} from "./private-article-files";
import {
  requirePrivateContentReceipt,
  validatePrivateContentFile,
} from "@/shared/media/private-content-upload";

const payloadSchema = z
  .object({
    title: z.string().min(1).max(255),
    coverUrl: z.string().nullable(),
    access: z.enum(["public", "club"]),
    published: z.boolean(),
    sections: z.array(
      z
        .object({
          type: z.enum(["heading", "text", "photo", "png", "link", "carousel"]),
          text: z.string().optional(),
          url: z.string().optional(),
          label: z.string().optional(),
          caption: z.string().optional(),
          urls: z.array(z.string()).optional(),
        })
        .strict(),
    ),
  })
  .strict();
const keySchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
const recordSchema = z
  .object({
    version: z.literal(1),
    ownerId: z.number().int().positive().safe(),
    idempotencyKey: keySchema,
    payload: payloadSchema,
    editBase: editBaseSchema.optional(),
    editConflict: z.union([z.literal(409), z.literal(412)]).optional(),
    media: z
      .object({
        editingId: z.number().int().positive().safe().nullable(),
        phase: z.enum(["upload", "write"]),
        revision: z.number().int().nonnegative().safe(),
        files: z
          .array(
            z.custom<PrivateArticleFile>((value) => {
              try {
                const file = value as PrivateArticleFile;
                if (
                  !file ||
                  !["articlePhoto", "articleDocument"].includes(file.usage) ||
                  Object.keys(file).some(
                    (key) =>
                      ![
                        "key",
                        "file",
                        "usage",
                        "attempted",
                        "receipt",
                      ].includes(key),
                  ) ||
                  (file.attempted !== undefined &&
                    typeof file.attempted !== "boolean")
                )
                  return false;
                validatePrivateContentFile(file, file.usage);
                if (file.receipt) {
                  if (!file.attempted) return false;
                  requirePrivateContentReceipt(
                    file.receipt,
                    file.file,
                    file.usage,
                  );
                }
                return true;
              } catch {
                return false;
              }
            }),
          )
          .min(1),
      })
      .strict()
      .optional(),
  })
  .strict();
// An unsaved editor may still have an empty or overlong title.
export const articleDraftSchema = payloadSchema.extend({
  title: z.string(),
  editBase: editBaseSchema.optional(),
});
export type ArticleCreationPayload = z.infer<typeof payloadSchema>;
export type ArticleCreationRecord = z.infer<typeof recordSchema>;

/** Проверяем strict write-payload, владельца и фазу файлов: upload содержит локальные ссылки, write — только готовые подтверждённые URL. */
export function parseArticleCreationRecord(
  value: unknown,
  ownerId: number,
): ArticleCreationRecord {
  const result = recordSchema.safeParse(value);
  if (!result.success || result.data.ownerId !== ownerId)
    throw new Error(
      "Сохранённая операция статьи повреждена. Проверьте список статей; новая операция автоматически не создаётся.",
    );
  if (result.data.media) {
    const { files, phase } = result.data.media;
    const local = selectArticleFiles(result.data.payload.sections, files);
    if (
      phase === "upload"
        ? local.length !== files.length
        : local.length > 0 ||
          files.some((file) => file.receipt?.state !== "ready")
    )
      throw storageError();
    if (phase === "write") {
      const links = result.data.payload.sections.flatMap((block) =>
        block.type === "carousel"
          ? (block.urls ?? [])
          : block.url
            ? [block.url]
            : [],
      );
      if (files.some((file) => !links.includes(file.receipt!.url!)))
        throw storageError();
    }
  }
  return result.data;
}

/** Поддерживаем старый формат и восстанавливаем бинарную версию File перед полной проверкой intent. */
function restoreRecord(value: unknown, ownerId: number): ArticleCreationRecord {
  if ((value as { version?: unknown } | null)?.version !== 2)
    return parseArticleCreationRecord(value, ownerId);
  const stored = value as Omit<ArticleCreationRecord, "media"> & {
    media: Omit<NonNullable<ArticleCreationRecord["media"]>, "files"> & {
      files: (Omit<PrivateArticleFile, "file"> & {
        fileData: {
          bytes: ArrayBuffer;
          name: string;
          type: string;
          lastModified: number;
        };
      })[];
    };
  };
  if (!Array.isArray(stored.media?.files)) throw storageError();
  const files = stored.media.files.map(({ fileData, ...metadata }) => {
    if (
      !fileData ||
      !(fileData.bytes instanceof ArrayBuffer) ||
      typeof fileData.name !== "string" ||
      typeof fileData.type !== "string" ||
      !Number.isFinite(fileData.lastModified)
    )
      throw storageError();
    return {
      ...metadata,
      file: new File([fileData.bytes], fileData.name, {
        type: fileData.type,
        lastModified: fileData.lastModified,
      }),
    };
  });
  return parseArticleCreationRecord(
    { ...stored, version: 1, media: { ...stored.media, files } },
    ownerId,
  );
}
/** Выносим чтение File в ArrayBuffer до IndexedDB-транзакции, сохраняя метаданные и квитанции. */
async function storeRecord(record: ArticleCreationRecord) {
  if (!record.media) return record;
  const files = await Promise.all(
    record.media.files.map(async ({ file, ...metadata }) => ({
      ...metadata,
      fileData: {
        bytes: await file.arrayBuffer(),
        name: file.name,
        type: file.type,
        lastModified: file.lastModified,
      },
    })),
  );
  return { ...record, version: 2, media: { ...record.media, files } };
}
/** Для media-intent сравниваем owner/key/revision/editingId; простую immutable-операцию сверяем целиком. */
function matches(
  current: ArticleCreationRecord | null,
  expected: ArticleCreationRecord,
): boolean {
  return current?.media && expected.media
    ? current.idempotencyKey === expected.idempotencyKey &&
        current.ownerId === expected.ownerId &&
        current.media.revision === expected.media.revision &&
        current.media.editingId === expected.media.editingId
    : JSON.stringify(current) === JSON.stringify(expected);
}

/** Принимаем только notRecorded, created или deleted с валидным articleId; удалённую запись не создаём повторно. */
export function parseArticleCreationStatus(
  value: unknown,
):
  | { status: "notRecorded" }
  | { status: "created" | "deleted"; articleId: number } {
  const result = z
    .discriminatedUnion("status", [
      z.object({ status: z.literal("notRecorded") }).strict(),
      z
        .object({
          status: z.literal("created"),
          articleId: z.number().int().positive().safe(),
        })
        .strict(),
      z
        .object({
          status: z.literal("deleted"),
          articleId: z.number().int().positive().safe(),
        })
        .strict(),
    ])
    .safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data;
}

/** Сбой или нарушение фазы журнала запрещает новый сетевой intent без восстановления исходного. */
const storageError = () =>
  new Error(
    "Не удалось сохранить или прочитать операцию статьи на этом устройстве. Разрешите хранение данных сайта и попробуйте снова.",
  );

/** A read/write IndexedDB transaction claims one account slot across tabs. */
export class ArticleCreationJournal {
  /** Журнал занимает один account-slot для незавершённого создания или файловой записи статьи. */
  constructor(readonly ownerId: number) {}
  /** Проверяем текущую личность до и после асинхронной подготовки данных. */
  private assertOwner() {
    if (!isPersonalDataOwner(this.ownerId))
      throw new Error("Аккаунт редактора изменился. Откройте статьи заново.");
  }
  /** Сериализуем один account-slot транзакцией IndexedDB с дедлайном; успех означает завершённый commit. */
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
      /** Закрываем транзакцию и соединение только один раз, не разрешая позднему onsuccess оживить завершённую операцию. */
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
        const request = indexedDB.open("darcy-article-creations", 1);
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
  /** Читаем текущую операцию без её повторной отправки или изменения ключа. */
  load(): Promise<ArticleCreationRecord | null> {
    return this.transaction("readonly", (_store, value, finish) =>
      finish(value === undefined ? null : restoreRecord(value, this.ownerId)),
    );
  }
  /** Снимаем immutable payload до ожидания storage; пустой слот атомарно занимает новый key, занятый возвращает прежнюю операцию. */
  async prepare(
    payload: ArticleCreationPayload,
    media?: { editingId: number | null; files: PrivateArticleFile[] },
    editBase?: ContentEditBase,
  ): Promise<{ record: ArticleCreationRecord; restored: boolean }> {
    // Snapshot before awaiting storage: replay must preserve empty blocks and URLs.
    const snapshot = payloadSchema.parse(payload);
    this.assertOwner();
    if (typeof globalThis.crypto?.randomUUID !== "function")
      throw new Error(
        "Для безопасного сохранения откройте сайт через HTTPS в актуальном браузере.",
      );
    const proposed = parseArticleCreationRecord(
      {
        version: 1,
        ownerId: this.ownerId,
        idempotencyKey: crypto.randomUUID().toLowerCase(),
        payload: snapshot,
        ...(editBase ? { editBase } : {}),
        ...(media ? { media: { ...media, phase: "upload", revision: 0 } } : {}),
      },
      this.ownerId,
    );
    const packed = await storeRecord(proposed);
    this.assertOwner();
    return this.transaction("readwrite", (store, value, finish) => {
      if (value !== undefined) {
        finish({
          record: restoreRecord(value, this.ownerId),
          restored: true,
        });
        return;
      }
      store.put(packed, this.ownerId);
      finish({ record: proposed, restored: false });
    });
  }
  /** Перечитываем ключ и локальную ревизию перед следующим шагом восстановления. */
  async requireCurrent(record: ArticleCreationRecord): Promise<void> {
    const current = await this.load();
    if (!matches(current, record))
      throw new Error(
        "Операция статьи изменилась в другой вкладке. Откройте статьи заново.",
      );
  }
  /** Сохраняем только подтверждённый конфликт write существующей статьи, увеличивая ревизию durable-intent. */
  async recordConflict(
    record: ArticleCreationRecord,
    status: 409 | 412,
  ): Promise<ArticleCreationRecord> {
    if (!record.media?.editingId || record.media.phase !== "write")
      throw storageError();
    const next = parseArticleCreationRecord(
      {
        ...record,
        editConflict: status,
        media: { ...record.media, revision: record.media.revision + 1 },
      },
      this.ownerId,
    );
    const packed = await storeRecord(next);
    this.assertOwner();
    return this.transaction("readwrite", (store, value, finish) => {
      const current =
        value === undefined ? null : restoreRecord(value, this.ownerId);
      if (!matches(current, record)) throw storageError();
      store.put(packed, this.ownerId);
      finish(next);
    });
  }
  /** Продвигаем только upload-фазу того же intent; переход к write разрешает лишь точную замену локальных файлов их квитанциями. */
  async checkpoint(
    record: ArticleCreationRecord,
    payload: ArticleCreationPayload,
    phase: "upload" | "write",
  ): Promise<ArticleCreationRecord> {
    if (!record.media || record.media.phase !== "upload")
      throw new Error(
        "Исходная операция статьи уже отправлена и не может быть изменена",
      );
    if (phase === "write") {
      const resolved = {
        ...record.payload,
        sections: resolveArticleFiles(
          record.payload.sections,
          record.media.files,
        ),
      };
      if (JSON.stringify(resolved) !== JSON.stringify(payload))
        throw storageError();
    } else if (JSON.stringify(payload) !== JSON.stringify(record.payload))
      throw storageError();
    const next = parseArticleCreationRecord(
      {
        ...record,
        payload,
        media: { ...record.media, phase, revision: record.media.revision + 1 },
      },
      this.ownerId,
    );
    const packed = await storeRecord(next);
    this.assertOwner();
    return this.transaction("readwrite", (store, value, finish) => {
      const current =
        value === undefined ? null : restoreRecord(value, this.ownerId);
      if (!matches(current, record))
        throw new Error(
          "Операция статьи изменилась в другой вкладке. Откройте статьи заново.",
        );
      store.put(packed, this.ownerId);
      finish(next);
    });
  }
  /** Удаляем только совпадающую durable-операцию; более новая запись другой вкладки остаётся нетронутой. */
  clear(record: ArticleCreationRecord): Promise<void> {
    return this.transaction("readwrite", (store, value, finish) => {
      const current =
        value === undefined ? null : restoreRecord(value, this.ownerId);
      if (!matches(current, record))
        throw new Error(
          "Операция статьи изменилась в другой вкладке. Откройте статьи заново.",
        );
      store.delete(this.ownerId);
      finish(undefined);
    });
  }
}
