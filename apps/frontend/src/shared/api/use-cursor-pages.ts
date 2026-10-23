"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import {
  useSessionOperation,
  checkOperationAccessError,
} from "@/domain/session/use-session-operation";
import { contentRefreshOptions } from "./content-refresh";
import { getHttpStatus, invalidResponse } from "./errors";
import {
  appendCursorPage,
  cancelInactiveCursorQuery,
  mergeCursorHead,
  type CursorChain,
  type CursorPage,
} from "./cursor-pages";

export function requireCursorPage(value: unknown): void {
  const page = value as CursorPage | null;
  if (
    !page ||
    !Array.isArray(page.items) ||
    !page.items.every((item) => Number.isSafeInteger(item.id) && item.id > 0) ||
    !(
      page.nextCursor === null ||
      (typeof page.nextCursor === "string" && page.nextCursor.length > 0)
    )
  )
    throw invalidResponse();
}

/** Poll only the head. A changed head replaces its cursor chain, never walks an archive. */
export function useCursorPages<P extends CursorPage>({
  key,
  scope,
  enabled,
  fetchPage,
}: {
  key: QueryKey;
  scope: string;
  enabled: boolean;
  fetchPage: (cursor: string | null, signal: AbortSignal) => Promise<P>;
}) {
  const client = useQueryClient();
  const queryKey = [...key, { ownerScope: scope }];
  const identity = JSON.stringify(queryKey);
  const operation = useSessionOperation(enabled, identity);
  const [failure, setFailure] = useState<{
    identity: string;
    error: unknown;
    at: number;
  } | null>(null);
  const query = useQuery<CursorChain<P>>({
    queryKey,
    ...contentRefreshOptions(enabled),
    queryFn: async ({ signal }) => {
      const head = await fetchPage(null, signal);
      requireCursorPage(head);
      return mergeCursorHead(
        client.getQueryData<CursorChain<P>>(queryKey),
        head,
      );
    },
  });
  useEffect(() => {
    if (!enabled) cancelInactiveCursorQuery(client, JSON.parse(identity));
    return () => {
      cancelInactiveCursorQuery(client, JSON.parse(identity));
    };
  }, [client, enabled, identity]);
  const nextError =
    failure?.identity === identity && failure.at === query.dataUpdatedAt
      ? failure.error
      : null;
  const error = query.error ?? nextError;
  const denied = [401, 403, 404].includes(getHttpStatus(error) ?? 0);
  const items = useMemo(() => {
    const rows = new Map<number, P["items"][number]>();
    if (!denied)
      for (const page of query.data?.pages ?? [])
        for (const item of page.items)
          if (!rows.has(item.id)) rows.set(item.id, item);
    return [...rows.values()] as P["items"];
  }, [query.data, denied]);
  const loadMore = async () => {
    const before = query.data;
    const cursor = before?.pages.at(-1)?.nextCursor;
    if (!cursor || query.isFetching) return;
    const task = operation.begin("page");
    if (!task) return;
    setFailure(null);
    const at = query.dataUpdatedAt;
    try {
      const page = await fetchPage(cursor, task.signal);
      task.assertCurrent();
      requireCursorPage(page);
      client.setQueryData<CursorChain<P>>(queryKey, (current) =>
        current === before ? appendCursorPage(current, cursor, page) : current,
      );
    } catch (cause) {
      checkOperationAccessError(cause);
      if (task.isCurrent()) setFailure({ identity, error: cause, at });
    } finally {
      task.finish();
    }
  };
  return {
    ...query,
    items,
    error,
    denied,
    isError: Boolean(error),
    isFetchNextPageError: Boolean(nextError),
    isFetchingNextPage: operation.kind === "page",
    hasNextPage: Boolean(query.data?.pages.at(-1)?.nextCursor),
    fetchNextPage: loadMore,
  };
}
