/** Контроллер результата связывает возврат, опрос и состояние доступа; поздние ответы относятся к своему запуску проверки. */
import type { TRPCClient } from "@trpc/client";
import type { AppRouter } from "@/shared/api/contract";
import type { reconcileClubTestCheckout } from "./test-checkout";
import { TRPCClientError } from "@trpc/client";
import { getHttpStatus, getRequestErrorMessage } from "@/shared/api/errors";
import { getSessionRequestSignal } from "@/shared/api/request-lifecycle";
import { pollClubTestCheckout } from "./checkout-polling";

export type ClubCheckoutResultState =
  | { phase: "idle" | "checking" | "paused" }
  | {
      phase: "result";
      result: Awaited<ReturnType<typeof reconcileClubTestCheckout>>;
      checking: boolean;
    }
  | { phase: "error"; message: string; retryAt: number };

/** Из 429 строим допустимое время следующей проверки; непроверенный или чрезмерный Retry-After заменяем минутой. */
export function clubCheckoutRetryAt(error: unknown): number {
  if (getHttpStatus(error) !== 429) return 0;
  const seconds =
    error instanceof TRPCClientError ? error.meta?.retryAfterSec : undefined;
  return (
    Date.now() +
    (typeof seconds === "number" &&
    Number.isInteger(seconds) &&
    seconds > 0 &&
    seconds <= 60
      ? seconds
      : 60) *
      1000
  );
}

/** Сериализуем кампании проверки и отделяем паузу от ошибки и результата; dispose прекращает публикацию состояния. */
export function createClubCheckoutResultController(
  client: TRPCClient<AppRouter>,
  onChange: (state: ClubCheckoutResultState) => void,
): { check(): Promise<void>; cancel(): void; dispose(): void } {
  let disposed = false;
  let current: AbortController | null = null;
  let retryAt = 0;
  /** Доставляем изменения только живому владельцу контроллера. */
  const publish = (state: ClubCheckoutResultState) => {
    if (!disposed) onChange(state);
  };
  return {
    /** Запускаем одну кампанию с текущим сигналом сессии и соблюдаем сохранённую паузу после 429. */
    async check() {
      if (disposed || current || Date.now() < retryAt) return;
      const controller = new AbortController();
      current = controller;
      const signal = AbortSignal.any([
        controller.signal,
        getSessionRequestSignal(),
      ]);
      try {
        publish({ phase: "checking" });
        const result = await pollClubTestCheckout(client, {
          signal,
          onResult: (result) => {
            if (result?.state === "pending")
              publish({ phase: "result", result, checking: true });
          },
        });
        signal.throwIfAborted();
        publish({ phase: "result", result, checking: false });
      } catch (error) {
        if (signal.aborted) publish({ phase: "paused" });
        else {
          retryAt = clubCheckoutRetryAt(error);
          publish({
            phase: "error",
            message: getRequestErrorMessage(error),
            retryAt,
          });
        }
      } finally {
        current = null;
      }
    },
    // Остановка опроса сохраняет возможность новой явной проверки; она не отменяет сам платёж.
    /** Прерываем текущую проверку, сохраняя возможность явного повтора; платёж у провайдера не отменяем. */
    cancel() {
      current?.abort();
    },
    /** Запрещаем новые уведомления и прекращаем незавершённую кампанию после ухода экрана. */
    dispose() {
      disposed = true;
      current?.abort();
    },
  };
}
