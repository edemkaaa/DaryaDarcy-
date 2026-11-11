"use client";
/** Проверку подписки и ошибку доступа показываем отдельным состоянием, не подменяя их предложением покупки. */
import { useClub } from "./subscription-context";
import { QueryRetryState } from "@/shared/ui/query-retry-state";

/** Отображаем проверку и ошибку прав отдельно от подтверждённого отсутствия подписки; повтор читает сервер заново. */
export function SubscriptionStatus() {
  const { status, refreshSubscription } = useClub();
  return (
    <QueryRetryState
      isLoading={status === "checking"}
      isError={status === "error"}
      message="Не удалось проверить подписку. Попробуйте ещё раз."
      onRetry={refreshSubscription}
    />
  );
}
