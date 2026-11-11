/** TEST-покупка использует отдельные параметры и подтверждения, чтобы её нельзя было принять за LIVE-заказ. */
import type { TRPCClient } from "@trpc/client";
import type { AppRouter } from "@/shared/api/contract";
import { getSessionRequestSignal } from "@/shared/api/request-lifecycle";
import { parseClubCheckoutState } from "./checkout-state";
import {
  getClubCheckoutIntent,
  readSavedClubCheckoutIntent,
  reserveNextClubCheckoutIntent,
  type ClubCheckoutSelection,
  type NextClubCheckoutRequest,
} from "./checkout-intent";

/** Explicit TEST-only next purchase; never retry or restore the terminal key. */
export async function createNextClubTestCheckout(
  client: TRPCClient<AppRouter>,
  request: NextClubCheckoutRequest,
  callerSignal?: AbortSignal,
) {
  const sessionSignal = getSessionRequestSignal();
  const signal = callerSignal
    ? AbortSignal.any([sessionSignal, callerSignal])
    : sessionSignal;
  signal.throwIfAborted();
  const intent = await reserveNextClubCheckoutIntent(client, request, signal);
  signal.throwIfAborted();
  if (readSavedClubCheckoutIntent()?.idempotencyKey !== intent.idempotencyKey)
    throw new Error("Сохранённая заявка изменилась. Повторите проверку.");
  const result = await client.club.createCheckout.mutate(intent.input, {
    context: { idempotencyKey: intent.idempotencyKey },
    signal,
  });
  signal.throwIfAborted();
  if (readSavedClubCheckoutIntent()?.idempotencyKey !== intent.idempotencyKey)
    throw new Error("Сохранённая заявка изменилась. Повторите проверку.");
  return result;
}

/** Test-only caller; enablement and terminal purchase lifecycle are separate gates. */
export async function createClubTestCheckout(
  client: TRPCClient<AppRouter>,
  selection: ClubCheckoutSelection,
  callerSignal?: AbortSignal,
) {
  const sessionSignal = getSessionRequestSignal();
  const signal = callerSignal
    ? AbortSignal.any([sessionSignal, callerSignal])
    : sessionSignal;
  signal.throwIfAborted();
  const intent = await getClubCheckoutIntent(selection, signal);
  // Preparation may await another tab. Do not dispatch under a new identity.
  signal.throwIfAborted();
  if (readSavedClubCheckoutIntent()?.idempotencyKey !== intent.idempotencyKey)
    throw new Error("Сохранённая заявка изменилась. Повторите проверку.");
  const result = await client.club.createCheckout.mutate(intent.input, {
    context: { idempotencyKey: intent.idempotencyKey },
    signal,
  });
  signal.throwIfAborted();
  if (readSavedClubCheckoutIntent()?.idempotencyKey !== intent.idempotencyKey)
    throw new Error("Сохранённая заявка изменилась. Повторите проверку.");
  return result;
}

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
  return {
    idempotencyKey: intent.idempotencyKey,
    ...parseClubCheckoutState(result),
  };
}
