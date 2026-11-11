"use client";
/** Общее состояние закрытого материала объясняет ожидание и ошибку чтения без выдачи публичного обходного URL. */
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { getRequestErrorMessage } from "@/shared/api/errors";
import { StatusNotice } from "@/shared/ui/status-notice";

/** Разделяем ожидание, ошибку с повтором и успешный ответ без готового материала. */
export function PrivateLibraryState({
  isLoading,
  error,
  retry,
}: {
  isLoading: boolean;
  error: unknown;
  retry: () => void;
}) {
  return (
    <QueryRetryState
      isLoading={isLoading}
      isError={Boolean(error)}
      onRetry={retry}
      message={getRequestErrorMessage(error)}
    >
      <StatusNotice compact>Материал пока недоступен.</StatusNotice>
    </QueryRetryState>
  );
}
