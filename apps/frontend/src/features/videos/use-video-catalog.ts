"use client";
import { useEffect, useRef, useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { trpc } from "@/shared/api/trpc";
import {
  contentRefreshOptions,
  CONTENT_REFRESH_INTERVAL_MS,
} from "@/shared/api/content-refresh";
import { cancelInactiveCursorQuery } from "@/shared/api/cursor-pages";
import type { VisibleItem } from "@/shared/ui/types";
import {
  nextVideoCursor,
  parseVideoCatalog,
  stalledVideoCursor,
  videoCatalogInput,
  type VideoCard,
} from "./catalog-api";

/** Poll the head and at most two visible pages. Revisited pages may be at most
 * one minute old; an explicit refresh starts a new cursor chain on success. */
export function useVideoCatalog(enabled: boolean, ownerScope: string) {
  const client = useQueryClient();
  const utils = trpc.useUtils();
  const [requests, setRequests] = useState<
    { cursor: number | undefined; requestedAt: number }[]
  >([{ cursor: undefined, requestedAt: 0 }]);
  const cursors = requests.map(({ cursor }) => cursor);
  const [visibleCursors, setVisibleCursors] = useState<number[]>([]);
  const restart = useRef(0);
  const pageKey = (cursor?: number) => [
    ...getQueryKey(trpc.videos.catalog, videoCatalogInput(20, cursor), "query"),
    { ownerScope },
  ];
  const keys = cursors.map(pageKey);
  const queries = useQueries({
    queries: cursors.map((cursor, index) => {
      const watched = index === 0 || visibleCursors.includes(cursor!);
      const cached = client.getQueryState(keys[index]);
      const needsPage =
        !cached?.data || cached.dataUpdatedAt < requests[index].requestedAt;
      return {
        queryKey: keys[index],
        queryFn: async ({ signal }: { signal: AbortSignal }) =>
          parseVideoCatalog(
            await utils.client.videos.catalog.query(
              videoCatalogInput(20, cursor),
              { signal },
            ),
          ),
        ...contentRefreshOptions(enabled && (watched || needsPage)),
        refetchInterval:
          enabled && watched ? CONTENT_REFRESH_INTERVAL_MS : (false as const),
        staleTime: CONTENT_REFRESH_INTERVAL_MS,
        refetchOnMount: "always" as const,
      };
    }),
  });
  // A changed boundary invalidates the following cursor chain. Keep the
  // confirmed prefix; never join new pages to an old, disconnected tail.
  const disconnected = cursors.findIndex(
    (cursor, index) =>
      index > 0 &&
      queries[index - 1].data !== undefined &&
      queries[index - 1].data!.nextCursor !== cursor,
  );
  if (disconnected > 0) setRequests(requests.slice(0, disconnected));
  const connected = disconnected > 0 ? queries.slice(0, disconnected) : queries;
  const pages = connected.flatMap((query, index) =>
    query.data && query.dataUpdatedAt >= requests[index].requestedAt
      ? [query.data]
      : [],
  );
  const tail = connected.at(-1)!;
  const waitingForTail =
    !tail.data ||
    tail.dataUpdatedAt < requests[connected.length - 1].requestedAt;
  const params = cursors.slice(0, pages.length);
  const stalled = stalledVideoCursor(pages.at(-1), params);
  const next =
    pages.length === connected.length && pages.length
      ? nextVideoCursor(pages.at(-1)!, params)
      : undefined;
  const queryIdentity = JSON.stringify(keys);
  const visibleIdentity = JSON.stringify(visibleCursors);
  useEffect(() => {
    const currentKeys = JSON.parse(queryIdentity);
    for (const key of currentKeys) cancelInactiveCursorQuery(client, key);
    return () => {
      for (const key of currentKeys) cancelInactiveCursorQuery(client, key);
    };
  }, [client, enabled, queryIdentity, visibleIdentity]);
  useEffect(
    () => () => {
      restart.current++;
    },
    [enabled],
  );
  const onVisibleItemsChange = ({
    visibleItems,
  }: {
    visibleItems: VisibleItem<VideoCard>[];
  }) => {
    const ids = new Set(visibleItems.map(({ item }) => item.id));
    const visible = pages
      .flatMap((page, index) =>
        index > 0 && page.items.some((item) => ids.has(item.id))
          ? [cursors[index]!]
          : [],
      )
      .slice(0, 2);
    setVisibleCursors((before) =>
      before.length === visible.length &&
      before.every((cursor, index) => cursor === visible[index])
        ? before
        : visible,
    );
  };
  const refresh = async () => {
    const ticket = ++restart.current;
    const result = await queries[0].refetch({ cancelRefetch: false });
    if (ticket === restart.current && result.isSuccess && !result.isFetching) {
      setRequests([{ cursor: undefined, requestedAt: 0 }]);
    }
  };
  const isFetching = connected.some((query) => query.isFetching);
  const fetchNextPage = () => {
    if (!enabled || isFetching) return;
    if (tail.isError && waitingForTail)
      return tail.refetch({ cancelRefetch: false });
    // An explicit page request needs a fresh reply even if that cursor was
    // cached before a restart or a changed boundary.
    if (next !== undefined)
      setRequests([...requests, { cursor: next, requestedAt: Date.now() }]);
  };
  const retry = () => {
    if (isFetching) return;
    if (stalled) return refresh();
    return Promise.all(
      connected
        .filter((query) => query.isError)
        .map((query) => query.refetch({ cancelRefetch: false })),
    );
  };
  return {
    pages,
    stalled,
    onVisibleItemsChange,
    refresh,
    retry,
    fetchNextPage,
    hasNextPage: next !== undefined,
    isPending: queries[0].isPending,
    isError: connected.some((query) => query.isError),
    isRefetchError: connected.some(
      (query, index) => query.isRefetchError && index < pages.length,
    ),
    isFetching,
    isFetchingNextPage:
      connected.length > 1 && waitingForTail && tail.isFetching,
    isFetchNextPageError:
      connected.length > 1 && tail.isError && waitingForTail,
  };
}
