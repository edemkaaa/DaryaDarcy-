import { z } from "zod";
import {
  adminActionKey,
  adminActionOutcome,
  type AdminActionKind,
} from "@shared/admin-action";
import { isPersonalDataOwner } from "@/shared/browser/storage";
import {
  adminActionRetryAt,
  parseAdminActionStatus,
  type AdminActionApi,
} from "@/shared/api/admin-actions";
import { getHttpStatus, invalidResponse } from "@/shared/api/errors";

const schema = z
  .object({
    version: z.literal(1),
    ownerId: z.number().int().positive().safe(),
    idempotencyKey: adminActionKey,
    kind: z.enum(["grantClub", "resendAccessEmail"]),
    userId: z.number().int().positive().safe(),
    attempted: z.boolean(),
    retryAt: z.number().int().positive().safe().optional(),
    outcome: adminActionOutcome.optional(),
  })
  .strict()
  .refine(
    (value) =>
      !value.outcome ||
      (value.outcome.kind === value.kind &&
        value.outcome.userId === value.userId),
  );
export type AdminActionIntent = z.infer<typeof schema>;
export const adminActionStorageKey = (ownerId: number) =>
  `darcy:user:${ownerId}:admin-action:v1`;
export class AdminActionJournalError extends Error {}
const storageError = () =>
  new AdminActionJournalError(
    "Не удалось надёжно сохранить или прочитать действие. Новый запрос не отправлен. Проверьте хранение данных сайта.",
  );
const changedError = () =>
  new AdminActionJournalError(
    "Сохранённое действие изменилось или потеряно. Проверьте результат исходного запроса; новый ключ не создан.",
  );

/** One durable intent per actor; only navigation-safe metadata, never email or tokens. */
export class AdminActionJournal {
  constructor(
    readonly ownerId: number,
    readonly api: AdminActionApi,
    private readonly checkpoint: (intent: AdminActionIntent) => void = () => {},
  ) {}
  private assertOwner(signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (!isPersonalDataOwner(this.ownerId)) throw changedError();
  }
  read(): AdminActionIntent | null {
    this.assertOwner();
    try {
      const raw = window.localStorage.getItem(
        adminActionStorageKey(this.ownerId),
      );
      if (raw === null) return null;
      if (raw.length > 4096) throw storageError();
      const parsed = schema.safeParse(JSON.parse(raw));
      if (!parsed.success || parsed.data.ownerId !== this.ownerId)
        throw storageError();
      return parsed.data;
    } catch {
      throw storageError();
    }
  }
  private persist(intent: AdminActionIntent, signal: AbortSignal) {
    this.assertOwner(signal);
    try {
      const encoded = JSON.stringify(schema.parse(intent));
      window.localStorage.setItem(adminActionStorageKey(this.ownerId), encoded);
      if (
        window.localStorage.getItem(adminActionStorageKey(this.ownerId)) !==
        encoded
      )
        throw storageError();
    } catch {
      throw storageError();
    }
    this.assertOwner(signal);
    this.checkpoint(intent);
    return intent;
  }
  private async locked<T>(
    signal: AbortSignal,
    work: () => Promise<T>,
  ): Promise<T> {
    this.assertOwner(signal);
    if (!window.isSecureContext || !navigator.locks?.request)
      throw storageError();
    const waiting = new AbortController();
    const timer = setTimeout(() => waiting.abort(), 5000);
    try {
      return await navigator.locks.request(
        adminActionStorageKey(this.ownerId),
        {
          mode: "exclusive",
          signal: AbortSignal.any([signal, waiting.signal]),
        },
        async () => {
          clearTimeout(timer);
          this.assertOwner(signal);
          const result = await work();
          this.assertOwner(signal);
          return result;
        },
      );
    } finally {
      clearTimeout(timer);
    }
  }
  private current(known?: AdminActionIntent | null) {
    const current = this.read();
    if (known && !current) throw changedError();
    if (
      known &&
      current?.idempotencyKey === known.idempotencyKey &&
      (current.kind !== known.kind || current.userId !== known.userId)
    )
      throw changedError();
    return current;
  }
  private async inspect(intent: AdminActionIntent, signal: AbortSignal) {
    const status = parseAdminActionStatus(
      await this.api.status(intent, signal),
      intent,
    );
    this.assertOwner(signal);
    const current = this.current(intent);
    if (!current || current.idempotencyKey !== intent.idempotencyKey)
      throw changedError();
    if (status.state === "notFound") {
      if (current.outcome) throw invalidResponse();
      this.checkpoint(current);
      return current;
    }
    if (
      current.outcome &&
      JSON.stringify(current.outcome) !== JSON.stringify(status)
    )
      throw invalidResponse();
    return this.persist({ ...current, outcome: status }, signal);
  }
  private async send(intent: AdminActionIntent, signal: AbortSignal) {
    if (
      intent.kind === "resendAccessEmail" &&
      (intent.retryAt ?? 0) > Date.now()
    )
      throw new AdminActionJournalError(
        "Слишком много запросов. Выдержите указанную задержку и проверьте результат без повторной отправки письма.",
      );
    const attempted = this.persist({ ...intent, attempted: true }, signal);
    try {
      const outcome = parseAdminActionStatus(
        await this.api.write(attempted, signal),
        attempted,
      );
      this.assertOwner(signal);
      if (outcome.state === "notFound") throw invalidResponse();
      return this.persist({ ...attempted, outcome }, signal);
    } catch (error) {
      this.assertOwner(signal);
      const retryAt =
        getHttpStatus(error) === 429 ? adminActionRetryAt(error) : undefined;
      const current = retryAt
        ? this.persist({ ...attempted, retryAt }, signal)
        : attempted;
      // Business denials may already have a durable receipt. Reads never replay.
      const status = getHttpStatus(error);
      if (
        status &&
        status >= 400 &&
        status < 500 &&
        ![401, 403].includes(status)
      ) {
        const result = await this.inspect(current, signal);
        if (result.outcome) return result;
      }
      throw error;
    }
  }
  check(known: AdminActionIntent | null, signal: AbortSignal) {
    return this.locked(signal, async () => {
      const current = this.current(known);
      return current ? this.inspect(current, signal) : null;
    });
  }
  start(
    kind: AdminActionKind,
    userId: number,
    known: AdminActionIntent | null,
    confirmedKey: string | undefined,
    signal: AbortSignal,
  ) {
    return this.locked(signal, async () => {
      let current = this.current(known);
      if (current) {
        current = await this.inspect(current, signal);
        // A request that appeared while this tab waited belongs to the existing
        // intent, even if the other tab completed it before we acquired the lock.
        if (!current.outcome || current.idempotencyKey !== confirmedKey)
          return current;
      }
      if (!Number.isSafeInteger(userId) || userId <= 0) throw invalidResponse();
      const idempotencyKey = adminActionKey.parse(crypto.randomUUID());
      if (idempotencyKey === current?.idempotencyKey) throw changedError();
      const intent = this.persist(
        {
          version: 1,
          ownerId: this.ownerId,
          kind,
          userId,
          idempotencyKey,
          attempted: false,
          ...(current?.retryAt ? { retryAt: current.retryAt } : {}),
        },
        signal,
      );
      return this.send(intent, signal);
    });
  }
  replay(known: AdminActionIntent, signal: AbortSignal) {
    return this.locked(signal, async () => {
      const current = this.current(known);
      if (!current || current.idempotencyKey !== known.idempotencyKey)
        throw changedError();
      const inspected = await this.inspect(current, signal);
      return inspected.outcome ? inspected : this.send(inspected, signal);
    });
  }
}
