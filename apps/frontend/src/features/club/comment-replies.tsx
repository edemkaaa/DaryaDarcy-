"use client";
import { useEffect, useState, type ReactNode } from "react";
import { getQueryKey } from "@trpc/react-query";
import { trpc } from "@/shared/api/trpc";
import { useCursorPages } from "@/shared/api/use-cursor-pages";
import { Action, Typography } from "@/shared/ui/elements";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
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
};
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
function ReplyGroup({
  postId,
  parentId,
  depth,
  enabled,
  scope,
  render,
  onDenied,
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
  useEffect(() => {
    if (page.denied) onDenied(page.error);
  }, [page.denied, page.error, onDenied]);
  return (
    <div className="ui-stack" data-comment-replies={parentId}>
      <QueryRetryState
        isLoading={page.isLoading}
        isError={page.isError && !page.isFetchNextPageError}
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
