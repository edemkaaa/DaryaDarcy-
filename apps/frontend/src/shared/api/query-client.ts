import {
  QueryClient,
  QueryCache,
  MutationCache,
  type Query,
} from "@tanstack/react-query";
import { getHttpStatus, shouldRetryQuery } from "./errors";
import { requestSessionCheck } from "./session-events";

export const INACTIVE_COMMENT_QUERY_LIMIT = 48;
export const INACTIVE_FEED_QUERY_LIMIT = 2;

/** Bound abandoned data without evicting a retained screen or a reply draft. */
function limitContentCache(cache: QueryCache) {
  const comments = new Map<string, Query>();
  const feeds = new Map<string, Query>();
  let scheduled = false;
  const trim = (entries: Map<string, Query>, limit: number) => {
    const inactive = [...entries.values()].filter(
      (query) =>
        query.getObserversCount() === 0 &&
        query.state.fetchStatus === "idle" &&
        query.state.data !== undefined,
    );
    for (const query of inactive.slice(0, Math.max(0, inactive.length - limit)))
      cache.remove(query);
  };
  cache.subscribe((event) => {
    const path = event.query.queryKey[0];
    if (!Array.isArray(path)) return;
    const entries =
      path.length === 2 && path[0] === "club" && path[1] === "comments"
        ? comments
        : path.length === 2 && path[0] === "feed" && path[1] === "listPaginated"
          ? feeds
          : null;
    if (!entries) return;
    if (event.type === "removed") {
      entries.delete(event.query.queryHash);
      return;
    }
    if (
      event.type !== "added" &&
      event.type !== "updated" &&
      event.type !== "observerAdded" &&
      event.type !== "observerRemoved"
    )
      return;
    entries.delete(event.query.queryHash);
    entries.set(event.query.queryHash, event.query);
    if (scheduled) return;
    scheduled = true;
    // Observers subscribe during the same turn; never remove a query in render.
    queueMicrotask(() => {
      scheduled = false;
      trim(comments, INACTIVE_COMMENT_QUERY_LIMIT);
      trim(feeds, INACTIVE_FEED_QUERY_LIMIT);
    });
  });
}

/** Defaults keep cache stable; content refresh and access checks opt in separately. */
export function createAppQueryClient() {
  const checkAccess = (error: unknown) => {
    const status = getHttpStatus(error);
    if (status === 401 || status === 403) requestSessionCheck(status);
  };
  const queryCache = new QueryCache({ onError: checkAccess });
  limitContentCache(queryCache);
  return new QueryClient({
    queryCache,
    mutationCache: new MutationCache({ onError: checkAccess }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: shouldRetryQuery,
      },
      mutations: { retry: false },
    },
  });
}
