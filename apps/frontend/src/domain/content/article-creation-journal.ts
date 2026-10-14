import { z } from "zod";
import { isPersonalDataOwner } from "@/shared/browser/storage";
import { invalidResponse } from "@/shared/api/errors";

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
  })
  .strict();
export type ArticleCreationPayload = z.infer<typeof payloadSchema>;
export type ArticleCreationRecord = z.infer<typeof recordSchema>;

export function parseArticleCreationRecord(
  value: unknown,
  ownerId: number,
): ArticleCreationRecord {
  const result = recordSchema.safeParse(value);
  if (!result.success || result.data.ownerId !== ownerId)
    throw new Error(
      "Сохранённая операция статьи повреждена. Проверьте список статей; новая операция автоматически не создаётся.",
    );
  return result.data;
}

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

const storageError = () =>
  new Error(
    "Не удалось сохранить или прочитать операцию статьи на этом устройстве. Разрешите хранение данных сайта и попробуйте снова.",
  );

/** A read/write IndexedDB transaction claims one account slot across tabs. */
export class ArticleCreationJournal {
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
  load(): Promise<ArticleCreationRecord | null> {
    return this.transaction("readonly", (_store, value, finish) =>
      finish(
        value === undefined
          ? null
          : parseArticleCreationRecord(value, this.ownerId),
      ),
    );
  }
  prepare(
    payload: ArticleCreationPayload,
  ): Promise<{ record: ArticleCreationRecord; restored: boolean }> {
    // Snapshot before awaiting storage: replay must preserve empty blocks and URLs.
    const snapshot = payloadSchema.parse(payload);
    return this.transaction("readwrite", (store, value, finish) => {
      if (value !== undefined) {
        finish({
          record: parseArticleCreationRecord(value, this.ownerId),
          restored: true,
        });
        return;
      }
      if (typeof globalThis.crypto?.randomUUID !== "function")
        throw new Error(
          "Для безопасного сохранения откройте сайт через HTTPS в актуальном браузере.",
        );
      const record = parseArticleCreationRecord(
        {
          version: 1,
          ownerId: this.ownerId,
          idempotencyKey: crypto.randomUUID().toLowerCase(),
          payload: snapshot,
        },
        this.ownerId,
      );
      store.put(record, this.ownerId);
      finish({ record, restored: false });
    });
  }
  async requireCurrent(record: ArticleCreationRecord): Promise<void> {
    const current = await this.load();
    if (JSON.stringify(current) !== JSON.stringify(record))
      throw new Error(
        "Операция статьи изменилась в другой вкладке. Откройте статьи заново.",
      );
  }
  clear(record: ArticleCreationRecord): Promise<void> {
    return this.transaction("readwrite", (store, value, finish) => {
      const current =
        value === undefined
          ? null
          : parseArticleCreationRecord(value, this.ownerId);
      if (JSON.stringify(current) !== JSON.stringify(record))
        throw new Error(
          "Операция статьи изменилась в другой вкладке. Откройте статьи заново.",
        );
      store.delete(this.ownerId);
      finish(undefined);
    });
  }
}
