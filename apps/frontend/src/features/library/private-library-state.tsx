"use client";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { getRequestErrorMessage } from "@/shared/api/errors";
import { Typography } from "@/shared/ui/elements";

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
      <Typography>Материал пока недоступен.</Typography>
    </QueryRetryState>
  );
}
