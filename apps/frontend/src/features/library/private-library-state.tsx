"use client";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { getRequestErrorMessage } from "@/shared/api/errors";
import { StatusNotice } from "@/shared/ui/status-notice";

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
