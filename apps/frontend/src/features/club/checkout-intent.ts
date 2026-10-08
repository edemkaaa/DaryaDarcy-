import { z } from "zod";
import { TRPCClientError, type TRPCClient } from "@trpc/client";
import type { AppRouter } from "@/shared/api/contract";
import { getSessionRequestSignal } from "@/shared/api/request-lifecycle";
import { parseClubCheckoutState } from "./checkout-state";

const storageKey = "daryadarcy:club-checkout:yookassa-test:v1";
const lockWaitMs = 5000;
const selectionSchema = z
  .object({
    email: z.string().trim().toLowerCase().max(254).email(),
    plan: z.enum(["monthly", "semiannual"]).default("monthly"),
  })
  .strict();
const recordSchema = z
  .object({
    version: z.literal(1),
    idempotencyKey: z.uuidv4(),
    selectionHash: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();

const messages = {
  "invalid-selection": "Проверьте почту и срок доступа.",
  unavailable:
    "Браузер не может безопасно сохранить заявку. Новая оплата не начата. Попробуйте ещё раз.",
  unreadable:
    "Сохранённую заявку не удалось проверить. Новая оплата не начата. Обратитесь в поддержку.",
  "selection-conflict":
    "Сначала завершите предыдущую покупку. Не меняйте почту или срок доступа до проверки её результата.",
  "stale-intent": "Сохранённая заявка изменилась. Повторите проверку.",
  "not-terminal":
    "Предыдущая покупка ещё не завершена. Проверьте её результат перед новой оплатой.",
};

class CheckoutIntentError extends Error {
  constructor(readonly reason: keyof typeof messages) {
    super(messages[reason]);
    this.name = "CheckoutIntentError";
  }
}

export type ClubCheckoutSelection = {
  email: string;
  plan?: "monthly" | "semiannual";
};

export type ClubCheckoutIntent = {
  idempotencyKey: string;
  input: { email: string; plan: "monthly" | "semiannual" };
};

async function fingerprintSelection(input: ClubCheckoutIntent["input"]) {
  // Read browser globals only on invocation, never during server rendering.
  if (
    typeof window === "undefined" ||
    !window.isSecureContext ||
    typeof navigator === "undefined" ||
    !navigator.locks?.request ||
    typeof crypto === "undefined" ||
    !crypto.randomUUID ||
    !crypto.subtle?.digest
  )
    throw new CheckoutIntentError("unavailable");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      JSON.stringify(["yookassa-test-club", input.email, input.plan]),
    ),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function persistIntent(
  storage: Storage,
  selectionHash: string,
  previousIdempotencyKey?: string,
) {
  const idempotencyKey = z.uuidv4().parse(crypto.randomUUID());
  if (idempotencyKey.toLowerCase() === previousIdempotencyKey?.toLowerCase())
    throw new CheckoutIntentError("unavailable");
  const encoded = JSON.stringify({ version: 1, idempotencyKey, selectionHash });
  storage.setItem(storageKey, encoded);
  if (storage.getItem(storageKey) !== encoded)
    throw new CheckoutIntentError("unavailable");
  return idempotencyKey;
}

function parseSavedIntent(prior: string) {
  if (prior.length > 1024) throw new CheckoutIntentError("unreadable");
  try {
    return recordSchema.parse(JSON.parse(prior));
  } catch {
    throw new CheckoutIntentError("unreadable");
  }
}

/** Read a return's evidence without reserving, rotating or erasing a purchase. */
export function readSavedClubCheckoutIntent(): {
  idempotencyKey: string;
} | null {
  try {
    if (typeof window === "undefined" || !window.isSecureContext)
      throw new CheckoutIntentError("unavailable");
    // One atomic storage read needs no writer lock. Its validated snapshot is
    // not payment proof; subsequent checks belong to this exact saved key.
    const prior = window.localStorage.getItem(storageKey);
    if (prior === null) return null;
    const saved = parseSavedIntent(prior);
    return { idempotencyKey: saved.idempotencyKey };
  } catch (error) {
    if (error instanceof CheckoutIntentError) throw error;
    throw new CheckoutIntentError("unavailable");
  }
}

/**
 * Reserve one browser-wide test purchase before dispatch. This record is not
 * proof of payment. Never rotate it after a timeout, elapsed time or URL return;
 * only the explicit next-purchase flow may replace verified terminal evidence.
 */
export async function getClubCheckoutIntent(
  selection: ClubCheckoutSelection,
): Promise<ClubCheckoutIntent> {
  const parsed = selectionSchema.safeParse(selection);
  if (!parsed.success) throw new CheckoutIntentError("invalid-selection");
  const input = parsed.data;
  try {
    const selectionHash = await fingerprintSelection(input);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), lockWaitMs);
    try {
      // Web Locks coordinate tabs; an in-process mutex cannot protect this write.
      return await navigator.locks.request(
        storageKey,
        { mode: "exclusive", signal: controller.signal },
        () => {
          clearTimeout(timer);
          const storage = window.localStorage;
          const prior = storage.getItem(storageKey);
          if (prior !== null) {
            const saved = parseSavedIntent(prior);
            if (saved.selectionHash !== selectionHash)
              throw new CheckoutIntentError("selection-conflict");
            return { idempotencyKey: saved.idempotencyKey, input };
          }
          const idempotencyKey = persistIntent(storage, selectionHash);
          return { idempotencyKey, input };
        },
      );
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    if (error instanceof CheckoutIntentError) throw error;
    // Storage/crypto errors may contain private browser details. Do not expose
    // them, silently overwrite evidence, or continue with a temporary UUID.
    throw new CheckoutIntentError("unavailable");
  }
}

/** Explicit next purchase: fresh server proof and replacement share one tab lock. */
export async function reserveNextClubCheckoutIntent(
  client: TRPCClient<AppRouter>,
  request: { previousIdempotencyKey: string; selection: ClubCheckoutSelection },
  callerSignal?: AbortSignal,
): Promise<ClubCheckoutIntent> {
  const sessionSignal = getSessionRequestSignal();
  const signal = callerSignal
    ? AbortSignal.any([sessionSignal, callerSignal])
    : sessionSignal;
  signal.throwIfAborted();
  if (!z.uuidv4().safeParse(request.previousIdempotencyKey).success)
    throw new CheckoutIntentError("stale-intent");
  const parsed = selectionSchema.safeParse(request.selection);
  if (!parsed.success) throw new CheckoutIntentError("invalid-selection");
  const input = parsed.data;
  try {
    const selectionHash = await fingerprintSelection(input);
    signal.throwIfAborted();
    const waiting = new AbortController();
    const timer = setTimeout(() => waiting.abort(), lockWaitMs);
    try {
      return await navigator.locks.request(
        storageKey,
        {
          mode: "exclusive",
          signal: AbortSignal.any([signal, waiting.signal]),
        },
        async () => {
          clearTimeout(timer);
          signal.throwIfAborted();
          const storage = window.localStorage;
          const prior = storage.getItem(storageKey);
          if (prior === null) throw new CheckoutIntentError("stale-intent");
          const saved = parseSavedIntent(prior);
          if (saved.idempotencyKey !== request.previousIdempotencyKey)
            throw new CheckoutIntentError("stale-intent");
          const result = await client.club.reconcileCheckout.mutate(undefined, {
            context: { idempotencyKey: saved.idempotencyKey },
            signal,
          });
          signal.throwIfAborted();
          const { state } = parseClubCheckoutState(result);
          if (state !== "succeeded" && state !== "canceled")
            throw new CheckoutIntentError("not-terminal");
          // Also fence writers that do not cooperate with the browser lock.
          if (storage.getItem(storageKey) !== prior)
            throw new CheckoutIntentError("stale-intent");
          signal.throwIfAborted();
          const idempotencyKey = persistIntent(
            storage,
            selectionHash,
            saved.idempotencyKey,
          );
          return { idempotencyKey, input };
        },
      );
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    if (
      error instanceof CheckoutIntentError ||
      error instanceof TRPCClientError
    )
      throw error;
    throw new CheckoutIntentError("unavailable");
  }
}
