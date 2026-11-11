"use client";
/** Ответы загружаются своей цепочкой страниц и связаны с конкретным родительским комментарием. */
import { CursorPagePrevious } from "@/shared/ui/cursor-page-previous";
import { useEffect, useState, type ReactNode } from "react";
import { getQueryKey } from "@trpc/react-query";
import { trpc } from "@/shared/api/trpc";
import { useCursorPages } from "@/shared/api/use-cursor-pages";
import { Action, Typography } from "@/shared/ui/elements";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { StatusNotice, StatusNoticeAction } from "@/shared/ui/status-notice";
import { getHttpStatus } from "@/shared/api/errors";
import type { ApiOutputs } from "@/shared/api/types";
import classes from "./club-comments.module.scss";
export type PagedComment = ApiOutputs["club"]["commentsPage"]["items"][number];
type Props = {
  postId: number;
  parentId: number;
  count: number;
  depth: number;
  enabled: boolean;
  scope: string;
  render: (item: PagedComment, depth: number) => ReactNode;
  onDenied: (error: unknown) => void;
  onMissing: (parentId: number) => void;
};
/** Не загружаем ответы до явного раскрытия; отдельный keyed родитель владеет своей цепочкой страниц. */
export function CommentReplies(props: Props) {
  const [open, setOpen] = useState(false);
  if (!props.count) return null;
  return open ? (
    <ReplyGroup {...props} />
  ) : (
    <Action onClick={() => setOpen(true)} disabled={!props.enabled}>
      <Typography className={classes.replyBtn}>
        Показать ответы ({props.count})
      </Typography>
    </Action>
  );
}
/** Читаем ответы одного родителя в account-scope; 404 ветки не трактуем как потерю доступа ко всему посту. */
function ReplyGroup({
  postId,
  parentId,
  depth,
  enabled,
  scope,
  render,
  onDenied,
  onMissing,
}: Props) {
  const utils = trpc.useUtils();
  const input = { postId, parentId, limit: 20 };
  const page = useCursorPages({
    key: getQueryKey(trpc.club.commentsPage, input, "query"),
    scope,
    staleTime: 60_000,
    gcTime: 60_000,
    enabled,
    fetchPage: (cursor, signal) =>
      utils.client.club.commentsPage.query({ ...input, cursor }, { signal }),
  });
  /** Передаём наверх только отказ доступа; исчезнувший родитель остаётся локальным состоянием этой ветки. */
  useEffect(() => {
    if (page.denied && getHttpStatus(page.error) !== 404) onDenied(page.error);
  }, [page.denied, page.error, onDenied]);
  // A deleted parent is local to this branch; it does not revoke post access.
  if (getHttpStatus(page.error) === 404)
    return (
      <StatusNotice
        actions={
          <StatusNoticeAction
            disabled={!enabled}
            onClick={() => onMissing(parentId)}
          >
            Обновить обсуждение
          </StatusNoticeAction>
        }
      >
        Этот комментарий больше недоступен.
      </StatusNotice>
    );
  return (
    <div className="ui-stack" data-comment-replies={parentId}>
      <CursorPagePrevious query={page} label="Предыдущие ответы" />
      <QueryRetryState
        isLoading={page.isLoading}
        isError={
          page.denied ||
          (page.isError &&
            !page.isFetchNextPageError &&
            !page.isFetchPreviousPageError)
        }
        onRetry={() => void page.refetch()}
        message="Не удалось загрузить ответы"
      />
      {page.items.map((item) => render(item, depth))}
      {page.hasNextPage && !page.denied ? (
        <Action
          disabled={page.isFetching || page.isFetchingNextPage}
          onClick={() => void page.fetchNextPage()}
          aria-label={
            page.isFetchNextPageError
              ? `Повторить ответы (${parentId})`
              : `Ещё ответы (${parentId})`
          }
        >
          <Typography className={classes.replyBtn}>
            {page.isFetchingNextPage
              ? "Загрузка…"
              : page.isFetchNextPageError
                ? "Повторить загрузку"
                : "Ещё ответы"}
          </Typography>
        </Action>
      ) : null}
    </div>
  );
}
