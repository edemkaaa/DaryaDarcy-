import type { TRPCClient } from "@trpc/client";
import { z } from "zod";
import type { AppRouter } from "@/shared/api/contract";
import { getSessionRequestSignal } from "@/shared/api/request-lifecycle";
import {
  getClubCheckoutIntent,
  readSavedClubCheckoutIntent,
  type ClubCheckoutSelection,
} from "./checkout-intent";

/** Test-only caller; enablement and terminal purchase lifecycle are separate gates. */
export async function createClubTestCheckout(
  client: TRPCClient<AppRouter>,
  selection: ClubCheckoutSelection,
) {
  const signal = getSessionRequestSignal();
  const intent = await getClubCheckoutIntent(selection);
  // Preparation may await another tab. Do not dispatch under a new identity.
  signal.throwIfAborted();
  return client.club.createCheckout.mutate(intent.input, {
    context: { idempotencyKey: intent.idempotencyKey },
    signal,
  });
}

const returnResultSchema = z
  .object({ state: z.enum(["unknown", "pending", "succeeded", "canceled"]) })
  .strict();

/** Check the exact saved test purchase; absence is not permission to create one. */
export async function reconcileClubTestCheckout(
  client: TRPCClient<AppRouter>,
  callerSignal?: AbortSignal,
) {
  const sessionSignal = getSessionRequestSignal();
  const signal = callerSignal
    ? AbortSignal.any([sessionSignal, callerSignal])
    : sessionSignal;
  signal.throwIfAborted();
  const intent = readSavedClubCheckoutIntent();
  signal.throwIfAborted();
  if (!intent) return null;
  const result = await client.club.reconcileCheckout.mutate(undefined, {
    context: { idempotencyKey: intent.idempotencyKey },
    signal,
  });
  signal.throwIfAborted();
  if (readSavedClubCheckoutIntent()?.idempotencyKey !== intent.idempotencyKey)
    throw new Error("Сохранённая заявка изменилась. Повторите проверку.");
  const parsed = returnResultSchema.safeParse(result);
  if (!parsed.success)
    throw new Error(
      "Не удалось проверить результат оплаты. Повторите проверку.",
    );
  return { idempotencyKey: intent.idempotencyKey, ...parsed.data };
}
