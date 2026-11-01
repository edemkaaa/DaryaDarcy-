"use client";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useCallback,
} from "react";
import {
  QueryObserver,
  useQueries,
  useQueryClient,
} from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { trpc } from "@/shared/api/trpc";
import {
  contentRefreshOptions,
  CONTENT_REFRESH_INTERVAL_MS,
} from "@/shared/api/content-refresh";
import {
  cancelInactiveCursorQuery,
  CURSOR_PAGE_LIMIT,
  CursorChainError,
} from "@/shared/api/cursor-pages";
import { OperationScope } from "@/shared/browser/operation-scope";
import { getSessionRequestSignal } from "@/shared/api/request-lifecycle";
import { checkOperationAccessError } from "@/domain/session/use-session-operation";
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
  const [windowed, setWindowed] = useState(false);
  const previousCursors = useRef(new Map<number, number | undefined>());
  const previousReservation = useRef<(() => void) | null>(null);
  const [previousFailure, setPreviousFailure] = useState<unknown>(null);
  const [previousRead] = useState(() => new OperationScope());
  const previousBusy =
    useSyncExternalStore(
      previousRead.subscribe,
      previousRead.getSnapshot,
      () => null,
    ) !== null;
  useEffect(() => () => previousRead.cancel(), [previousRead, enabled]);
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
        // Removed observers must release their pages, including after restart.
        gcTime: 0,
        refetchOnMount: false,
      };
    }),
  });
  // A changed boundary invalidates the following cursor chain. Keep the
  // confirmed prefix; never join new pages to an old, disconnected tail.
  const disconnected = cursors.findIndex(
    (cursor, index) =>
      index > 0 &&
      (index > 1 || !windowed) &&
      queries[index - 1].data !== undefined &&
      queries[index - 1].data!.nextCursor !== cursor,
  );
  if (disconnected > 0) setRequests(requests.slice(0, disconnected));
  const connected = disconnected > 0 ? queries.slice(0, disconnected) : queries;
  const pages = connected.flatMap((query, index) =>
    !(windowed && index === 0) &&
    query.data &&
    query.dataUpdatedAt >= requests[index].requestedAt
      ? [query.data]
      : [],
  );
  const tail = connected.at(-1)!;
  const waitingForTail =
    !tail.data ||
    tail.dataUpdatedAt < requests[connected.length - 1].requestedAt;
  const params = cursors.slice(0, pages.length + (windowed ? 1 : 0));
  const stalled = stalledVideoCursor(pages.at(-1), params);
  const next =
    pages.length === connected.length - (windowed ? 1 : 0) && pages.length
      ? nextVideoCursor(pages.at(-1)!, params)
      : undefined;
  const queryIdentity = JSON.stringify(keys);
  useEffect(() => {
    // Keep a directly read page observed until useQueries adopts it. Otherwise
    // setQueryData would create a second cache with the default five-minute GC.
    previousReservation.current?.();
    previousReservation.current = null;
    return () => {
      previousReservation.current?.();
      previousReservation.current = null;
    };
  }, [queryIdentity, enabled]);
  const headBoundary = useRef<number | null | undefined>(undefined);
  const headNext = queries[0].data?.nextCursor;
  useEffect(() => {
    if (
      headBoundary.current !== undefined &&
      headNext !== undefined &&
      headBoundary.current !== headNext &&
      windowed
    ) {
      previousRead.cancel();
      previousCursors.current.clear();
      setRequests([{ cursor: undefined, requestedAt: 0 }]);
      setWindowed(false);
    }
    headBoundary.current = headNext;
  }, [headNext, windowed, previousRead]);
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
    const visible = connected
      .flatMap((query, index) =>
        index > 0 && query.data?.items.some((item) => ids.has(item.id))
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
    previousRead.cancel();
    const ticket = ++restart.current;
    const result = await queries[0].refetch({ cancelRefetch: false });
    if (ticket === restart.current && result.isSuccess && !result.isFetching) {
      setRequests([{ cursor: undefined, requestedAt: 0 }]);
      previousCursors.current.clear();
      setWindowed(false);
      setPreviousFailure(null);
    }
  };
  const isFetching =
    previousBusy || connected.some((query) => query.isFetching);
  const fetchNextPage = useCallback(() => {
    if (!enabled || isFetching) return;
    if (tail.isError && waitingForTail)
      return tail.refetch({ cancelRefetch: false });
    // An explicit page request needs a fresh reply even if that cursor was
    // cached before a restart or a changed boundary.
    if (next !== undefined) {
      setPreviousFailure(null);
      previousCursors.current.set(next, cursors.at(-1));
      const extended = [...requests, { cursor: next, requestedAt: Date.now() }];
      if (extended.length > CURSOR_PAGE_LIMIT) {
        setRequests([extended[0], ...extended.slice(-(CURSOR_PAGE_LIMIT - 1))]);
        setWindowed(true);
      } else setRequests(extended);
    }
  }, [
    enabled,
    isFetching,
    tail,
    waitingForTail,
    next,
    requests,
    cursors,
    setWindowed,
    setPreviousFailure,
  ]);
  const hasPreviousPage =
    windowed &&
    cursors[1] !== undefined &&
    previousCursors.current.has(cursors[1]);
  const fetchPreviousPage = async () => {
    if (!enabled || isFetching || !hasPreviousPage) return;
    if (previousFailure instanceof CursorChainError) return refresh();
    const task = previousRead.begin(
      "previous",
      getSessionRequestSignal(),
      () => enabled,
    );
    if (!task) return;
    const cursor = previousCursors.current.get(cursors[1]!);
    const reservation = new QueryObserver(client, {
      queryKey: pageKey(cursor),
      enabled: false,
      gcTime: 0,
    });
    const release = reservation.subscribe(() => {});
    let adopted = false;
    try {
      const page = parseVideoCatalog(
        await utils.client.videos.catalog.query(videoCatalogInput(20, cursor), {
          signal: task.signal,
        }),
      );
      task.assertCurrent();
      if (page.nextCursor !== cursors[1]) throw new CursorChainError();
      client.setQueryData(pageKey(cursor), page);
      previousReservation.current?.();
      previousReservation.current = release;
      setRequests(
        cursor === undefined
          ? requests
          : [
              requests[0],
              { cursor, requestedAt: 0 },
              ...requests.slice(1, CURSOR_PAGE_LIMIT - 1),
            ],
      );
      setWindowed(
        cursor !== undefined && cursor !== queries[0].data?.nextCursor,
      );
      adopted = cursor !== undefined;
      setPreviousFailure(null);
      if (!adopted) {
        release();
        previousReservation.current = null;
      }
    } catch (error) {
      checkOperationAccessError(error);
      if (task.isCurrent()) setPreviousFailure(error);
    } finally {
      if (!adopted) release();
      task.finish();
    }
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
    hasPreviousPage,
    fetchPreviousPage,
    isFetchingPreviousPage: previousBusy,
    isFetchPreviousPageError: Boolean(previousFailure),
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
