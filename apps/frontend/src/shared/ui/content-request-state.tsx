"use client";
/** Отсутствие материала, отказ доступа и временный сбой отображаются разными состояниями по данным ошибки запроса. */
import { getHttpStatus, getRequestErrorMessage } from "@/shared/api/errors";
import { QueryRetryState } from "./query-retry-state";
import { StatusNotice } from "./status-notice";

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
      <StatusNotice>{notFoundText}</StatusNotice>
    </QueryRetryState>
  );
}
