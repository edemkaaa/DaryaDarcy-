"use client";
import { Action, Typography } from "./elements";
import { StatusNotice, StatusNoticeAction } from "./status-notice";

type PageReader = {
  hasPreviousPage: boolean;
  isFetching: boolean;
  isFetchingPreviousPage: boolean;
  isFetchPreviousPageError: boolean;
  denied?: boolean;
  fetchPreviousPage: () => unknown;
};

export function CursorPagePrevious({
  query,
  label = "Показать предыдущие",
}: {
  query: PageReader;
  label?: string;
}) {
  if (!query.hasPreviousPage || query.denied) return null;
  if (query.isFetchPreviousPageError)
    return (
      <StatusNotice
        tone="error"
        actions={
          <StatusNoticeAction
            disabled={query.isFetching}
            aria-busy={query.isFetchingPreviousPage}
            onClick={() => void query.fetchPreviousPage()}
          >
            {query.isFetchingPreviousPage ? "Загрузка…" : "Повторить"}
          </StatusNoticeAction>
        }
      >
        Не удалось загрузить предыдущие записи
      </StatusNotice>
    );
  return (
    <Action
      disabled={query.isFetching || query.isFetchingPreviousPage}
      aria-busy={query.isFetchingPreviousPage}
      onClick={() => void query.fetchPreviousPage()}
    >
      <Typography>
        {query.isFetchingPreviousPage ? "Загрузка…" : label}
      </Typography>
    </Action>
  );
}
