import type { TRPCClient } from "@trpc/client";
import type { AppRouter } from "@/shared/api/contract";
import { ApiError } from "@/shared/api/errors";
import { getSessionRequestSignal } from "@/shared/api/request-lifecycle";
import { readSavedClubCheckoutIntent } from "./checkout-intent";
import { reconcileClubTestCheckout } from "./test-checkout";

type ReturnResult = Awaited<ReturnType<typeof reconcileClubTestCheckout>>;
type PollOptions = {
  signal: AbortSignal;
  onResult: (result: ReturnResult) => void;
};

function waitForNextCheck(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, 5000);
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** One finite check campaign; only pending is polled, never errors or unknown. */
export async function pollClubTestCheckout(
  client: TRPCClient<AppRouter>,
  options: PollOptions,
): Promise<ReturnResult> {
  const sessionSignal = getSessionRequestSignal();
  const caller = AbortSignal.any([sessionSignal, options.signal]);
  caller.throwIfAborted();
  const intent = readSavedClubCheckoutIntent();
  caller.throwIfAborted();
  if (!intent) {
    options.onResult(null);
    return null;
  }
  const budget = new AbortController();
  const timer = setTimeout(() => {
    budget.abort(new DOMException("Время проверки истекло.", "TimeoutError"));
  }, 30_000);
  const signal = AbortSignal.any([caller, budget.signal]);
  let latest: ReturnResult = null;
  try {
    for (let attempt = 0; attempt < 6; attempt++) {
      signal.throwIfAborted();
      if (
        readSavedClubCheckoutIntent()?.idempotencyKey !== intent.idempotencyKey
      )
        throw new Error("Сохранённая заявка изменилась. Повторите проверку.");
      const result = await reconcileClubTestCheckout(client, signal);
      signal.throwIfAborted();
      if (result?.idempotencyKey !== intent.idempotencyKey)
        throw new Error("Сохранённая заявка изменилась. Повторите проверку.");
      latest = result;
      options.onResult(result);
      if (result.state !== "pending" || attempt === 5) return result;
      // Wait after completion, not on an interval: checks cannot overlap.
      await waitForNextCheck(signal);
    }
    return latest;
  } catch (error) {
    // A campaign deadline is not cancellation/payment proof. Keep the last
    // pending observation; caller/session aborts and API errors still propagate.
    const deadlineAbort =
      error === budget.signal.reason ||
      (error instanceof Error &&
        error.cause instanceof ApiError &&
        error.cause.kind === "cancelled");
    if (
      budget.signal.aborted &&
      !caller.aborted &&
      latest?.state === "pending" &&
      deadlineAbort
    )
      return latest;
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
