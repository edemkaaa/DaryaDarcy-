/** Старый протокол сохраняет признак неизвестного результата; пока он не проверен, автоматический новый checkout не запускается. */
import { z } from "zod";
import { TRPCClientError } from "@trpc/client";
import { isPersonalDataOwner } from "@/shared/browser/storage";

const schema = z
  .object({
    version: z.literal(1),
    ownerId: z.number().int().positive().safe().nullable(),
    mode: z.enum(["legacy", "prodamus-test"]),
    id: z.uuidv4(),
    state: z.enum(["unknown", "acknowledged", "rejected"]),
  })
  .strict();
export type LegacyCheckoutIntent = z.infer<typeof schema>;
export class LegacyCheckoutJournalError extends Error {}

/** Local coordination only. The existing createCheckout API has no replay key.
 * Never present this ID as server idempotency or an order/payment receipt. */
export class LegacyCheckoutJournal {
  constructor(
    readonly ownerId: number | null,
    readonly mode: LegacyCheckoutIntent["mode"],
  ) {}
  get storageKey() {
    return `darcy:${this.ownerId === null ? "guest" : `user:${this.ownerId}`}:${this.mode}:checkout-guard:v1`;
  }
  private assertOwner(signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (!isPersonalDataOwner(this.ownerId))
      throw new LegacyCheckoutJournalError(
        "Аккаунт оплаты изменился. Прежняя заявка сохранена.",
      );
  }
  read(): LegacyCheckoutIntent | null {
    this.assertOwner();
    try {
      const raw = window.localStorage.getItem(this.storageKey);
      if (raw === null) return null;
      if (raw.length > 1024) throw Error();
      const intent = schema.parse(JSON.parse(raw));
      if (intent.ownerId !== this.ownerId || intent.mode !== this.mode)
        throw Error();
      return intent;
    } catch {
      throw new LegacyCheckoutJournalError(
        "Не удалось прочитать сохранённую заявку оплаты. Новый запрос не отправлен. Проверьте хранение данных сайта.",
      );
    }
  }
  private persist(intent: LegacyCheckoutIntent, signal: AbortSignal) {
    this.assertOwner(signal);
    try {
      const raw = JSON.stringify(schema.parse(intent));
      window.localStorage.setItem(this.storageKey, raw);
      if (window.localStorage.getItem(this.storageKey) !== raw) throw Error();
    } catch {
      throw new LegacyCheckoutJournalError(
        "Не удалось надёжно сохранить заявку оплаты. Не начинайте другую оплату до проверки результата.",
      );
    }
    this.assertOwner(signal);
  }
  async submit<T>(
    knownId: string | null,
    replaceUnknown: boolean,
    signal: AbortSignal,
    send: () => Promise<T>,
  ): Promise<T> {
    this.assertOwner(signal);
    if (!window.isSecureContext || !navigator.locks?.request)
      throw new LegacyCheckoutJournalError(
        "Не удалось согласовать оплату между вкладками. Новый запрос не отправлен. Откройте сайт в поддерживаемом браузере по HTTPS.",
      );
    const waiting = new AbortController();
    const timer = setTimeout(() => waiting.abort(), 5000);
    try {
      return await navigator.locks.request(
        this.storageKey,
        {
          mode: "exclusive",
          signal: AbortSignal.any([signal, waiting.signal]),
        },
        async () => {
          clearTimeout(timer);
          this.assertOwner(signal);
          const previous = this.read();
          if ((previous?.id ?? null) !== knownId)
            throw new LegacyCheckoutJournalError(
              "Заявка оплаты изменилась в другой вкладке. Проверьте предыдущую оплату перед новым запросом.",
            );
          if (previous?.state === "unknown" && !replaceUnknown)
            throw new LegacyCheckoutJournalError(
              "Результат прежней заявки неизвестен. Новый запрос не отправлен.",
            );
          const intent: LegacyCheckoutIntent = {
            version: 1,
            ownerId: this.ownerId,
            mode: this.mode,
            id: crypto.randomUUID(),
            state: "unknown",
          };
          this.persist(intent, signal);
          let result: T;
          try {
            result = await send();
          } catch (error) {
            // A decoded tRPC business refusal confirms rejection; a proxy HTML
            // status or a broken body does not confirm the outcome of a mutation.
            const status: unknown =
              error instanceof TRPCClientError
                ? error.data?.httpStatus
                : undefined;
            if (typeof status === "number" && status >= 400 && status < 500) {
              this.assertOwner(signal);
              if (this.read()?.id === intent.id)
                this.persist({ ...intent, state: "rejected" }, signal);
            }
            throw error;
          }
          this.assertOwner(signal);
          if (this.read()?.id !== intent.id)
            throw new LegacyCheckoutJournalError(
              "Сохранённая заявка оплаты изменилась. Не начинайте повторную оплату.",
            );
          this.persist({ ...intent, state: "acknowledged" }, signal);
          return result;
        },
      );
    } finally {
      clearTimeout(timer);
    }
  }
}
