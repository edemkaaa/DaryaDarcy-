"use client";
import { getHttpStatus, getRequestErrorMessage } from "@/shared/api/errors";
import { QueryRetryState } from "./query-retry-state";
import { Typography } from "./typography";

export function ContentRequestState({
  error,
  onRetry,
  notFoundText,
}: {
  error: unknown;
  onRetry: () => void;
  notFoundText: string;
}) {
  return (
    <QueryRetryState
      isLoading={false}
      isError={Boolean(error) && getHttpStatus(error) !== 404}
      message={getRequestErrorMessage(error)}
      onRetry={onRetry}
    >
      <Typography>{notFoundText}</Typography>
    </QueryRetryState>
  );
}
