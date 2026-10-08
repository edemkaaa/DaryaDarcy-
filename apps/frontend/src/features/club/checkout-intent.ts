import { z } from "zod";

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
 * a future explicit new-purchase flow must first verify the terminal server state.
 */
export async function getClubCheckoutIntent(
  selection: ClubCheckoutSelection,
): Promise<ClubCheckoutIntent> {
  const parsed = selectionSchema.safeParse(selection);
  if (!parsed.success) throw new CheckoutIntentError("invalid-selection");
  const input = parsed.data;
  try {
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
    const selectionHash = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
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
          const idempotencyKey = z.uuidv4().parse(crypto.randomUUID());
          const encoded = JSON.stringify({
            version: 1,
            idempotencyKey,
            selectionHash,
          });
          storage.setItem(storageKey, encoded);
          if (storage.getItem(storageKey) !== encoded)
            throw new CheckoutIntentError("unavailable");
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
