/** Гостевой NORMAL-заказ восстанавливается по исходному намерению; URL возврата не считается подтверждением покупки. */
import { z } from "zod";
import { TRPCClientError, type TRPCClient } from "@trpc/client";
import type { AppRouter } from "@/shared/api/contract";
import { ApiError, getHttpStatus, invalidResponse } from "@/shared/api/errors";
import { isPersonalDataOwner } from "@/shared/browser/storage";
import {
  parseNormalCheckoutResult,
  parseNormalCheckoutStatus,
  type NormalCheckoutStatus,
} from "./normal-checkout";

import { contactPhoneSchema } from "@shared/checkout-contact";

export const GUEST_CHECKOUT_STORAGE_KEY = "darcy:guest:normal-checkout:v1";
const selectionSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(320)
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/),
  plan: z.enum(["monthly", "semiannual"]),
  contactPhone: contactPhoneSchema.optional(),
});
const intentSchema = selectionSchema
  .extend({
    email: z
      .string()
      .max(320)
      .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
      .refine((value) => value === value.trim().toLowerCase()),
    version: z.literal(1),
    idempotencyKey: z
      .string()
      .regex(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      ),
    recoveryToken: z.string().regex(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/),
    ownerId: z.number().int().positive().safe().nullable(),
    orderId: z.string().trim().min(1).optional(),
    retryAt: z.number().int().nonnegative().safe().optional(),
  })
  .strict();
export type GuestCheckoutIntent = z.infer<typeof intentSchema>;
export type GuestCheckoutSelection = z.infer<typeof selectionSchema>;
export type GuestCheckoutActor = { id: number; email: string | null } | null;

const unavailable = () =>
  new Error(
    "Не удалось проверить или сохранить покупку на устройстве. Новая покупка не начата. Разрешите хранение данных сайта и попробуйте снова.",
  );
const changed = () =>
  new Error(
    "Сохранённая покупка изменилась или её ключ восстановления утрачен. Другой заказ автоматически не создаётся. Проверьте оплату или обратитесь в поддержку.",
  );
export class GuestCheckoutRecipientError extends Error {
  constructor() {
    super(
      "На устройстве сохранена гостевая покупка другого получателя. Для восстановления войдите в соответствующий аккаунт. Прежняя покупка сохранена.",
    );
    this.name = "GuestCheckoutRecipientError";
  }
}
const differentRecipient = () => new GuestCheckoutRecipientError();

/** One durable guest intent. Its secret is never a login credential or payment proof. */
export class GuestCheckoutJournal {
  constructor(readonly actor: GuestCheckoutActor) {}

  private assertActor(signal?: AbortSignal) {
    signal?.throwIfAborted();
    if (!isPersonalDataOwner(this.actor?.id ?? null)) throw changed();
  }
  // Вошедший аккаунт должен совпасть с получателем гостевой покупки; чужое намерение не присваивается ему автоматически.
  private assertRecipient(intent: GuestCheckoutIntent) {
    if (intent.ownerId !== null && intent.ownerId !== this.actor?.id)
      throw differentRecipient();
    if (this.actor && this.actor.email?.trim().toLowerCase() !== intent.email)
      throw differentRecipient();
  }
  read(): GuestCheckoutIntent | null {
    this.assertActor();
    let intent: GuestCheckoutIntent;
    try {
      const raw = window.localStorage.getItem(GUEST_CHECKOUT_STORAGE_KEY);
      if (raw === null) return null;
      if (raw.length > 4096) throw unavailable();
      intent = intentSchema.parse(JSON.parse(raw));
      if (intent.email !== intent.email.trim().toLowerCase())
        throw unavailable();
    } catch {
      throw unavailable();
    }
    this.assertRecipient(intent);
    return intent;
  }
  private persist(intent: GuestCheckoutIntent) {
    this.assertActor();
    this.assertRecipient(intent);
    try {
      const raw = JSON.stringify(intentSchema.parse(intent));
      if (window.localStorage.getItem(GUEST_CHECKOUT_STORAGE_KEY) === raw)
        return intent;
      window.localStorage.setItem(GUEST_CHECKOUT_STORAGE_KEY, raw);
      if (window.localStorage.getItem(GUEST_CHECKOUT_STORAGE_KEY) !== raw)
        throw unavailable();
    } catch {
      throw unavailable();
    }
    return intent;
  }
  private async locked<T>(
    signal: AbortSignal,
    work: () => Promise<T> | T,
  ): Promise<T> {
    this.assertActor(signal);
    if (!window.isSecureContext || !navigator.locks?.request)
      throw unavailable();
    const budget = new AbortController();
    const timer = setTimeout(() => budget.abort(), 5000);
    try {
      return await navigator.locks.request(
        GUEST_CHECKOUT_STORAGE_KEY,
        {
          mode: "exclusive",
          signal: AbortSignal.any([signal, budget.signal]),
        },
        async () => {
          clearTimeout(timer);
          this.assertActor(signal);
          const result = await work();
          this.assertActor(signal);
          return result;
        },
      );
    } finally {
      clearTimeout(timer);
    }
  }
  private reserve(
    selection: GuestCheckoutSelection,
    previous?: GuestCheckoutIntent,
  ) {
    if (this.actor)
      throw new Error(
        "Новую покупку после входа нужно начать из своего аккаунта.",
      );
    const parsed = selectionSchema.omit({ contactPhone: true }).safeParse(selection);
    if (!parsed.success)
      throw new Error("Укажите корректную почту для чека и входа.");
    const phone = contactPhoneSchema.safeParse(selection.contactPhone);
    if (!phone.success)
      throw new Error("Укажите корректный номер телефона с кодом страны.");
    if (
      typeof crypto === "undefined" ||
      !crypto.randomUUID ||
      !crypto.getRandomValues
    )
      throw unavailable();
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const recoveryToken = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const idempotencyKey = crypto.randomUUID().toLowerCase();
    if (
      previous &&
      (idempotencyKey === previous.idempotencyKey ||
        recoveryToken === previous.recoveryToken)
    )
      throw unavailable();
    return this.persist({
      version: 1,
      ...parsed.data,
      contactPhone: phone.data,
      idempotencyKey,
      recoveryToken,
      ownerId: null,
    });
  }
  requireCurrent(intent: GuestCheckoutIntent, signal: AbortSignal) {
    this.assertActor(signal);
    const current = this.read();
    if (
      !current ||
      current.idempotencyKey !== intent.idempotencyKey ||
      current.recoveryToken !== intent.recoveryToken ||
      current.email !== intent.email ||
      current.plan !== intent.plan ||
      current.contactPhone !== intent.contactPhone ||
      current.ownerId !== intent.ownerId
    )
      throw changed();
    return current;
  }
  assertReady(intent: GuestCheckoutIntent, signal: AbortSignal) {
    const current = this.requireCurrent(intent, signal);
    if ((current.retryAt ?? 0) > Date.now())
      throw new ApiError(
        "Повторная проверка оплаты пока недоступна. Дождитесь окончания паузы.",
        429,
        Math.ceil((current.retryAt! - Date.now()) / 1000),
      );
    return current;
  }
  prepare(selection: GuestCheckoutSelection, signal: AbortSignal) {
    return this.locked(signal, () => {
      const current = this.read();
      if (current) {
        const parsed = selectionSchema.safeParse(selection);
        if (
          !parsed.success ||
          parsed.data.email !== current.email ||
          parsed.data.plan !== current.plan ||
          parsed.data.contactPhone !== current.contactPhone
        )
          throw new Error(
            "Сначала проверьте сохранённую покупку. Её почту и срок доступа менять нельзя.",
          );
        return current;
      }
      return this.reserve(selection);
    });
  }
  remember(
    intent: GuestCheckoutIntent,
    result: NormalCheckoutStatus,
    signal: AbortSignal,
  ) {
    return this.locked(signal, () => {
      const current = this.requireCurrent(intent, signal);
      if (result.state === "notRecorded") {
        if (current.orderId) throw invalidResponse();
        return current;
      }
      if (current.orderId && current.orderId !== result.orderId)
        throw invalidResponse();
      // Bind only after the server accepted this account's proof, never by email alone.
      return this.persist({
        ...current,
        orderId: result.orderId,
        ownerId: this.actor?.id ?? current.ownerId,
      });
    });
  }
  async rememberRateLimit(
    intent: GuestCheckoutIntent,
    cause: unknown,
    signal: AbortSignal,
  ) {
    if (getHttpStatus(cause) !== 429) return;
    const delay =
      cause instanceof TRPCClientError
        ? cause.meta?.retryAfterSec
        : cause instanceof ApiError
          ? cause.retryAfterSec
          : undefined;
    const seconds =
      typeof delay === "number" && Number.isSafeInteger(delay) && delay > 0
        ? Math.min(delay, 86400)
        : 60;
    await this.locked(signal, () => {
      const current = this.requireCurrent(intent, signal);
      return this.persist({
        ...current,
        retryAt: Math.max(current.retryAt ?? 0, Date.now() + seconds * 1000),
      });
    });
  }
  async next(
    client: TRPCClient<AppRouter>,
    intent: GuestCheckoutIntent,
    selection: GuestCheckoutSelection,
    signal: AbortSignal,
  ) {
    try {
      return await this.locked(signal, async () => {
        const current = this.assertReady(intent, signal);
        const result = await readStatus(client, current, signal);
        this.requireCurrent(current, signal);
        if (result.state !== "succeeded" && result.state !== "failed")
          throw new Error(
            "Предыдущая покупка ещё не завершена. Проверьте её результат перед новой оплатой.",
          );
        if (current.orderId && current.orderId !== result.orderId)
          throw invalidResponse();
        if (this.actor) {
          // Explicit terminal completion hands control back to authenticated NORMAL.
          window.localStorage.removeItem(GUEST_CHECKOUT_STORAGE_KEY);
          if (window.localStorage.getItem(GUEST_CHECKOUT_STORAGE_KEY) !== null)
            throw unavailable();
          return null;
        }
        return this.reserve(selection, current);
      });
    } catch (cause) {
      if (cause instanceof TRPCClientError)
        await this.rememberRateLimit(intent, cause, signal);
      throw cause;
    }
  }
}
const proof = (intent: GuestCheckoutIntent) => ({
  idempotencyKey: intent.idempotencyKey,
  recoveryToken: intent.recoveryToken,
});
async function readStatus(
  client: TRPCClient<AppRouter>,
  intent: GuestCheckoutIntent,
  signal: AbortSignal,
) {
  return parseNormalCheckoutStatus(
    await client.club.guestNormalCheckoutStatus.mutate(proof(intent), {
      signal,
    }),
  );
}
// Запрос статуса использует сохранённые параметры и возвращает доказательство исходного заказа, не новый checkout.
export async function checkGuestCheckout(
  client: TRPCClient<AppRouter>,
  journal: GuestCheckoutJournal,
  intent: GuestCheckoutIntent,
  signal: AbortSignal,
) {
  journal.assertReady(intent, signal);
  try {
    const result = await readStatus(client, intent, signal);
    const current = await journal.remember(intent, result, signal);
    journal.requireCurrent(current, signal);
    return { intent: current, result };
  } catch (cause) {
    await journal.rememberRateLimit(intent, cause, signal);
    throw cause;
  }
}
// Создание или восстановление ссылки сохраняет прежний ключ и контакт, чтобы сетевой повтор не дублировал покупку.
export async function createGuestCheckout(
  client: TRPCClient<AppRouter>,
  journal: GuestCheckoutJournal,
  intent: GuestCheckoutIntent,
  signal: AbortSignal,
) {
  journal.assertReady(intent, signal);
  try {
    const result = parseNormalCheckoutResult(
      await client.club.createGuestNormalCheckout.mutate(
        {
          ...proof(intent),
          email: intent.email,
          plan: intent.plan,
          contactPhone: intent.contactPhone,
        },
        { signal },
      ),
    );
    const current = await journal.remember(intent, result, signal);
    journal.requireCurrent(current, signal);
    return { intent: current, result };
  } catch (cause) {
    await journal.rememberRateLimit(intent, cause, signal);
    throw cause;
  }
}
