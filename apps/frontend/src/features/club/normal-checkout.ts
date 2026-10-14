import { z } from "zod";
import type { TRPCClient } from "@trpc/client";
import type { AppRouter } from "@/shared/api/contract";
import { isPersonalDataOwner } from "@/shared/browser/storage";
import { invalidResponse } from "@/shared/api/errors";
import { requirePaymentUrl } from "@/shared/navigation/external-url";

const key = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
const orderId = z.string().trim().min(1);
const succeeded = z
  .object({ state: z.literal("succeeded"), orderId, expiresAt: z.date() })
  .strict();
const failed = z.object({ state: z.literal("failed"), orderId }).strict();
const statusSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("notRecorded") }).strict(),
  z.object({ state: z.literal("pending"), orderId }).strict(),
  succeeded,
  failed,
]);
const resultSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("pending"), orderId, url: z.string() }).strict(),
  succeeded,
  failed,
]);
const intentSchema = z
  .object({
    version: z.literal(1),
    ownerId: z.number().int().positive().safe(),
    idempotencyKey: key,
    plan: z.enum(["monthly", "semiannual"]),
    orderId: orderId.optional(),
  })
  .strict();
export type NormalCheckoutIntent = z.infer<typeof intentSchema>;
export type NormalCheckoutStatus = z.infer<typeof statusSchema>;
export type NormalCheckoutResult = z.infer<typeof resultSchema>;
export function parseNormalCheckoutStatus(
  value: unknown,
): NormalCheckoutStatus {
  const result = statusSchema.safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data;
}
export function parseNormalCheckoutResult(
  value: unknown,
): NormalCheckoutResult {
  const result = resultSchema.safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data.state === "pending"
    ? { ...result.data, url: requirePaymentUrl(result.data.url) }
    : result.data;
}
const unreadable = () =>
  new Error(
    "Не удалось проверить сохранённую покупку. Новая покупка не начата. Разрешите хранение данных сайта и попробуйте снова.",
  );
const changed = () =>
  new Error(
    "Сохранённая покупка изменилась. Повторите проверку её результата.",
  );

/** One account's NORMAL intent; URL, email and payment proof are never persisted. */
export class NormalCheckoutJournal {
  constructor(readonly ownerId: number) {}
  private storageKey() {
    return `darcy:user:${this.ownerId}:normal-checkout:v1`;
  }
  private assertOwner(signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (!isPersonalDataOwner(this.ownerId)) throw changed();
  }
  read(): NormalCheckoutIntent | null {
    this.assertOwner();
    try {
      const raw = window.localStorage.getItem(this.storageKey());
      if (raw === null) return null;
      if (raw.length > 2048) throw unreadable();
      const result = intentSchema.safeParse(JSON.parse(raw));
      if (!result.success || result.data.ownerId !== this.ownerId)
        throw unreadable();
      return result.data;
    } catch {
      throw unreadable();
    }
  }
  private persist(value: NormalCheckoutIntent) {
    this.assertOwner();
    try {
      const encoded = JSON.stringify(intentSchema.parse(value));
      window.localStorage.setItem(this.storageKey(), encoded);
      if (window.localStorage.getItem(this.storageKey()) !== encoded)
        throw unreadable();
    } catch {
      throw unreadable();
    }
    return value;
  }
  private async locked<T>(
    signal: AbortSignal,
    work: () => Promise<T> | T,
  ): Promise<T> {
    this.assertOwner(signal);
    if (
      typeof navigator === "undefined" ||
      !navigator.locks?.request ||
      !window.isSecureContext
    )
      throw unreadable();
    const waiting = new AbortController();
    const timer = setTimeout(() => waiting.abort(), 5000);
    try {
      return await navigator.locks.request(
        this.storageKey(),
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
  private newIntent(
    plan: NormalCheckoutIntent["plan"],
    previous?: NormalCheckoutIntent,
  ): NormalCheckoutIntent {
    if (typeof crypto?.randomUUID !== "function") throw unreadable();
    const idempotencyKey = key.parse(crypto.randomUUID().toLowerCase());
    if (previous?.idempotencyKey === idempotencyKey) throw unreadable();
    return this.persist({
      version: 1,
      ownerId: this.ownerId,
      idempotencyKey,
      plan,
    });
  }
  requireCurrent(
    intent: NormalCheckoutIntent,
    signal: AbortSignal,
  ): NormalCheckoutIntent {
    this.assertOwner(signal);
    const current = this.read();
    if (
      !current ||
      current.idempotencyKey !== intent.idempotencyKey ||
      current.plan !== intent.plan
    )
      throw changed();
    return current;
  }
  prepare(signal: AbortSignal): Promise<NormalCheckoutIntent> {
    return this.locked(signal, () => this.read() ?? this.newIntent("monthly"));
  }
  rememberOrder(
    intent: NormalCheckoutIntent,
    result: NormalCheckoutStatus,
    signal: AbortSignal,
  ): Promise<NormalCheckoutIntent> {
    return this.locked(signal, () => {
      const current = this.requireCurrent(intent, signal);
      if (result.state === "notRecorded") {
        if (current.orderId) throw invalidResponse();
        return current;
      }
      if (current.orderId && current.orderId !== result.orderId)
        throw invalidResponse();
      return this.persist({ ...current, orderId: result.orderId });
    });
  }
  next(
    client: TRPCClient<AppRouter>,
    intent: NormalCheckoutIntent,
    signal: AbortSignal,
  ): Promise<NormalCheckoutIntent> {
    return this.locked(signal, async () => {
      const prior = this.requireCurrent(intent, signal);
      const status = parseNormalCheckoutStatus(
        await client.club.normalCheckoutStatus.query(
          { idempotencyKey: prior.idempotencyKey },
          { signal },
        ),
      );
      this.requireCurrent(prior, signal);
      if (status.state !== "succeeded" && status.state !== "failed")
        throw new Error(
          "Предыдущая покупка ещё не завершена. Проверьте её результат перед новой оплатой.",
        );
      if (prior.orderId && prior.orderId !== status.orderId)
        throw invalidResponse();
      return this.newIntent("monthly", prior);
    });
  }
}

export async function checkNormalCheckout(
  client: TRPCClient<AppRouter>,
  journal: NormalCheckoutJournal,
  intent: NormalCheckoutIntent,
  signal: AbortSignal,
) {
  journal.requireCurrent(intent, signal);
  const result = parseNormalCheckoutStatus(
    await client.club.normalCheckoutStatus.query(
      { idempotencyKey: intent.idempotencyKey },
      { signal },
    ),
  );
  const current = await journal.rememberOrder(intent, result, signal);
  journal.requireCurrent(current, signal);
  return { intent: current, result };
}
export async function createNormalCheckout(
  client: TRPCClient<AppRouter>,
  journal: NormalCheckoutJournal,
  intent: NormalCheckoutIntent,
  signal: AbortSignal,
) {
  journal.requireCurrent(intent, signal);
  // NORMAL uses the payload key. The backend rejects the TEST-only header.
  const result = parseNormalCheckoutResult(
    await client.club.createNormalCheckout.mutate(
      { idempotencyKey: intent.idempotencyKey, plan: intent.plan },
      { signal },
    ),
  );
  const current = await journal.rememberOrder(intent, result, signal);
  journal.requireCurrent(current, signal);
  return { intent: current, result };
}
