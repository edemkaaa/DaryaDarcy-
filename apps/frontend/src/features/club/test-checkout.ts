import type { TRPCClient } from "@trpc/client";
import type { AppRouter } from "@/shared/api/contract";
import { getSessionRequestSignal } from "@/shared/api/request-lifecycle";
import {
  getClubCheckoutIntent,
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
