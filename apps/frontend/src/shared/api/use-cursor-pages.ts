"use client";
/** Хук хранит ограниченное окно страниц; обновление головы и видимых элементов сохраняет непрерывную цепочку курсоров. */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { checkOperationAccessError } from "@/domain/session/use-session-operation";
import { contentRefreshOptions } from "./content-refresh";
import { getHttpStatus, invalidResponse } from "./errors";
import {
  appendCursorPage,
  cancelInactiveCursorQuery,
  refreshCursorChain,
  boundCursorChain,
  CursorChainError,
  cursorQueryKey,
  CURSOR_PAGE_LIMIT,
  prependCursorPage,
  type CursorChain,
  type CursorPage,
} from "./cursor-pages";

import { OperationScope } from "@/shared/browser/operation-scope";
import { getSessionRequestSignal } from "./request-lifecycle";

export function requireCursorPage(value: unknown): void {
  const page = value as CursorPage | null;
  if (
    !page ||
    !Array.isArray(page.items) ||
    !page.items.every(
      (item) => item && Number.isSafeInteger(item.id) && item.id > 0,
    ) ||
    !(
      page.nextCursor === null ||
      (typeof page.nextCursor === "string" && page.nextCursor.length > 0)
    )
  )
    throw invalidResponse();
}

/** Refresh the head and visible pages; explicitly refresh the complete retained window. */
export function useCursorPages<P extends CursorPage>({
  key,
  scope,
  enabled,
  fetchPage,
  staleTime,
  gcTime,
  poll = true,
  window: pageWindow,
  cacheVersion,
}: {
  key: QueryKey;
  scope: string;
  enabled: boolean;
  fetchPage: (cursor: string | null, signal: AbortSignal) => Promise<P>;
  staleTime?: number;
  gcTime?: number;
  poll?: boolean;
  window?: { maxPages: number; pageSize: number };
  cacheVersion?: string;
}) {
  const client = useQueryClient();
  const queryKey = cursorQueryKey(
    key,
    scope,
    `${cacheVersion ?? ""}:bounded-v2`,
  );
  // Фильтр, версия списка и владелец вместе задают право использовать прежние страницы.
  const identity = JSON.stringify(queryKey);
  const refreshMode = useRef<{
    identity: string;
    mode: "all" | "restart";
  } | null>(null);
  const visibleIds = useRef<{ identity: string; ids: Set<number> }>({
    identity,
    ids: new Set(),
  });
  const [operation] = useState(() => new OperationScope());
  const operationKind = useSyncExternalStore(
    operation.subscribe,
    operation.getSnapshot,
    () => null,
  );
  useEffect(() => () => operation.cancel(), [operation, enabled, identity]);
  const [failure, setFailure] = useState<{
    identity: string;
    error: unknown;
    direction: "next" | "previous";
  } | null>(null);
  const query = useQuery<CursorChain<P>>({
    queryKey,
    ...contentRefreshOptions(enabled),
    ...(!poll ? { refetchInterval: false as const } : {}),
    ...(staleTime === undefined ? {} : { staleTime }),
    ...(gcTime === undefined ? {} : { gcTime }),
    // Обновление цепочки и ручная догрузка не должны одновременно применять разные границы страниц.
    queryFn: async ({ signal }) => {
      operation.cancel();
      const mode =
        refreshMode.current?.identity === identity
          ? refreshMode.current.mode
          : "background";
      const chain = await refreshCursorChain(
        client.getQueryData<CursorChain<P>>(queryKey),
        async (cursor) => {
          const page = await fetchPage(cursor, signal);
          signal.throwIfAborted();
          requireCursorPage(page);
          if (
            pageWindow &&
            page.nextCursor !== null &&
            Number(page.nextCursor) <= Number(cursor ?? 0)
          )
            throw new CursorChainError();
          return page;
        },
        visibleIds.current.identity === identity
          ? visibleIds.current.ids
          : new Set(),
        mode,
      );
      refreshMode.current = null;
      setFailure((current) =>
        current?.identity === identity ? null : current,
      );
      return boundCursorChain(
        chain,
        pageWindow?.maxPages ?? CURSOR_PAGE_LIMIT,
        "next",
        !pageWindow,
      );
    },
  });
  useEffect(() => {
    if (!enabled) cancelInactiveCursorQuery(client, JSON.parse(identity));
    return () => {
      cancelInactiveCursorQuery(client, JSON.parse(identity));
    };
  }, [client, enabled, identity]);
  const nextError = failure?.identity === identity ? failure.error : null;
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
  const firstCursor = query.data?.pageParams[0];
  const hasPreviousPage = Boolean(
    pageWindow
      ? firstCursor != null && Number(firstCursor) > 0
      : query.data?.previousCursors?.length,
  );
  const loadPage = async (direction: "next" | "previous") => {
    const before = query.data;
    if (
      !before ||
      !enabled ||
      query.isFetching ||
      (direction === "previous" && !hasPreviousPage)
    )
      return;
    const offset =
      direction === "previous" && pageWindow
        ? Math.max(0, Number(firstCursor) - pageWindow!.pageSize)
        : null;
    const cursor =
      direction === "previous"
        ? !pageWindow
          ? before.previousCursors!.at(-1)!
          : offset === 0
            ? null
            : String(offset)
        : before.pages.at(-1)?.nextCursor;
    if (direction === "next" && !cursor) return;
    if (cursor === undefined) return;
    const task = operation.begin(
      direction,
      getSessionRequestSignal(),
      () => enabled,
    );
    if (!task) return;
    try {
      const page = await fetchPage(cursor, task.signal);
      task.assertCurrent();
      requireCursorPage(page);
      if (
        pageWindow &&
        page.nextCursor !== null &&
        Number(page.nextCursor) <= Number(cursor ?? 0)
      )
        throw new CursorChainError();
      client.setQueryData<CursorChain<P>>(queryKey, (current) => {
        // Если за время запроса список обновился, не присоединяем страницу к уже другой цепочке.
        if (current !== before) return current;
        if (direction === "previous" && page.nextCursor !== firstCursor)
          throw new CursorChainError();
        const chain =
          direction === "next"
            ? appendCursorPage(current, cursor!, page)
            : !pageWindow
              ? prependCursorPage(current, page)
              : {
                  ...current,
                  pages: [page, ...current.pages],
                  pageParams: [cursor, ...current.pageParams],
                  refreshedAt: [
                    Date.now(),
                    ...(current.refreshedAt ?? current.pages.map(() => 0)),
                  ],
                };
        return boundCursorChain(
          chain,
          pageWindow?.maxPages ?? CURSOR_PAGE_LIMIT,
          direction,
          !pageWindow,
        );
      });
      setFailure(null);
    } catch (cause) {
      checkOperationAccessError(cause);
      if (task.isCurrent()) setFailure({ identity, error: cause, direction });
    } finally {
      task.finish();
    }
  };
  const onVisibleItemsChange = useCallback(
    (info: { visibleItems: { item: { id: string | number } }[] }) => {
      const ids = new Set(info.visibleItems.map(({ item }) => Number(item.id)));
      const old = visibleIds.current;
      visibleIds.current = { identity, ids };
      if (
        !enabled ||
        (old.identity === identity && [...ids].every((id) => old.ids.has(id)))
      )
        return;
      const key: QueryKey = JSON.parse(identity);
      const cached = client.getQueryData<CursorChain<P>>(key);
      if (
        cached?.pages.some(
          (page, index) =>
            page.items.some((item) => ids.has(item.id)) &&
            Date.now() - (cached.refreshedAt?.[index] ?? 0) >= 60_000,
        )
      )
        void client.refetchQueries(
          { queryKey: key, exact: true, type: "active" },
          { cancelRefetch: false },
        );
    },
    [client, enabled, identity],
  );
  return {
    ...query,
    identity,
    onVisibleItemsChange,
    items,
    error,
    denied,
    isError: Boolean(error),
    isFetching: query.isFetching || operationKind !== null,
    isFetchNextPageError: Boolean(nextError && failure?.direction === "next"),
    isFetchPreviousPageError: Boolean(
      nextError && failure?.direction === "previous",
    ),
    isFetchingNextPage: operationKind === "next",
    isFetchingPreviousPage: operationKind === "previous",
    hasPreviousPage,
    fetchPreviousPage: () => {
      if (nextError instanceof CursorChainError) {
        refreshMode.current = { identity, mode: "restart" };
        return query.refetch();
      }
      return loadPage("previous");
    },
    hasNextPage: Boolean(query.data?.pages.at(-1)?.nextCursor),
    fetchNextPage: () => {
      if (nextError instanceof CursorChainError) {
        refreshMode.current = { identity, mode: "all" };
        return query.refetch();
      }
      return loadPage("next");
    },
    refetch: (options?: Parameters<typeof query.refetch>[0]) => {
      refreshMode.current = { identity, mode: "all" };
      return query.refetch(options);
    },
    restart: async () => {
      operation.cancel();
      await client.cancelQueries({ queryKey, exact: true });
      // Keep confirmed pages through failures; the next successful head starts
      // a fresh chain, including when the user retries the failed refresh.
      refreshMode.current = { identity, mode: "restart" };
      return query.refetch();
    },
  };
}
