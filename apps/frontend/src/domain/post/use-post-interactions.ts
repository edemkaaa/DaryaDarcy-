"use client";
import { useEffect } from "react";
import { useQueries, useQueryClient, type Query } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { cancelInactiveCursorQuery } from "@/shared/api/cursor-pages";
import {
  interactionBatches,
  requirePostInteractions,
  type PostInteractions,
} from "./post-interaction-data";
import { usePostInteractionState } from "./post-interactions-context";
import { useScreenActive } from "@/shared/navigation/screen-activity";
import { trpc } from "@/shared/api/trpc";
import { useAuth } from "@/domain/session/session-context";
import { checkOperationAccessError } from "@/domain/session/use-session-operation";
import { OperationScope } from "@/shared/browser/operation-scope";
import { isPersonalDataOwner } from "@/shared/browser/storage";
import { getSessionRequestSignal } from "@/shared/api/request-lifecycle";
import {
  getHttpStatus,
  getRequestErrorMessage,
  invalidResponse,
} from "@/shared/api/errors";

type InteractionKind = "like" | "save";
export function usePostInteractions(postIds: readonly number[]) {
  const { user } = useAuth();
  const active = useScreenActive();
  const utils = trpc.useUtils();
  const cache = useQueryClient();
  const ownerScope = String(user?.id ?? "guest");
  const batches = interactionBatches(postIds);
  const queryKeys = batches.map((ids) => [
    ...getQueryKey(trpc.feed.interactionsForPosts, { postIds: ids }, "query"),
    { ownerScope },
  ]);
  const enabled = Boolean(user) && active;
  const queries = useQueries({
    queries: batches.map((ids, index) => ({
      queryKey: queryKeys[index],
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const data = await utils.client.feed.interactionsForPosts.query(
          { postIds: ids },
          { signal },
        );
        signal.throwIfAborted();
        return requirePostInteractions(data, ids);
      },
      enabled,
      staleTime: 0,
      refetchOnMount: "always" as const,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    })),
  });
  const identity = JSON.stringify(queryKeys);
  useEffect(() => {
    const cancelUnused = () => {
      for (const key of JSON.parse(identity))
        cancelInactiveCursorQuery(cache, key);
    };
    if (!enabled) cancelUnused();
    return cancelUnused;
  }, [cache, enabled, identity]);
  const affectedQueries = (postId: number) => ({
    queryKey: getQueryKey(trpc.feed.interactionsForPosts),
    predicate: (query: Query) => {
      const input = query.queryKey[1] as
        | { input?: { postIds?: number[] } }
        | undefined;
      const scope = query.queryKey[2] as { ownerScope?: string } | undefined;
      return (
        scope?.ownerScope === ownerScope &&
        Boolean(input?.input?.postIds?.includes(postId))
      );
    },
  });
  const {
    scopes,
    overrides,
    setOverrides,
    pending,
    setPending,
    failures,
    setFailures,
  } = usePostInteractionState();
  const requested = new Set(batches.flat());
  const likedIds = new Set<number>();
  const savedIds = new Set<number>();
  const readyIds = new Set<number>();
  queries.forEach((query, index) => {
    if ([401, 403, 404].includes(getHttpStatus(query.error) ?? 0)) return;
    for (const id of query.data?.likedIds ?? []) likedIds.add(id);
    for (const id of query.data?.savedIds ?? []) savedIds.add(id);
    if (enabled && query.isSuccess && !query.isFetching && !query.isError)
      for (const id of batches[index]) readyIds.add(id);
  });
  for (const [key, value] of overrides) {
    const [kind, id] = key.split(":");
    if (!requested.has(Number(id))) continue;
    const ids = kind === "like" ? likedIds : savedIds;
    if (value) ids.add(Number(id));
    else ids.delete(Number(id));
  }
  const relevantFailures = [...failures].filter(([key]) =>
    requested.has(Number(key.split(":")[1])),
  );
  const retry = async () => {
    if (!enabled) return;
    const parent = getSessionRequestSignal();
    const owner = user?.id;
    const failuresBeforeRead = relevantFailures;
    const recovered = new Set<number>();
    await Promise.all(
      queries.map(async (query, index) => {
        const updatedBeforeRead = query.dataUpdatedAt;
        const result = await query.refetch();
        if (result.isSuccess && result.dataUpdatedAt > updatedBeforeRead)
          for (const id of batches[index]) recovered.add(id);
      }),
    );
    if (parent.aborted || !owner || !isPersonalDataOwner(owner)) return;
    // Only a fresh successful read of this post may release its earlier failure.
    setFailures((current) => {
      const next = new Map(current);
      for (const [key, failure] of failuresBeforeRead)
        if (
          recovered.has(Number(key.split(":")[1])) &&
          next.get(key) === failure
        )
          next.delete(key);
      return next;
    });
  };
  const toggle = async (kind: InteractionKind, postId: number) => {
    if (!readyIds.has(postId) || !user) return;
    const key = `${kind}:${postId}`;
    if (failures.get(key)?.blocked) return;
    let scope = scopes.get(key);
    if (!scope) {
      scope = new OperationScope();
      scopes.set(key, scope);
    }
    const owner = user.id;
    const task = scope.begin(kind, getSessionRequestSignal(), () =>
      isPersonalDataOwner(owner),
    );
    if (!task) return;
    const previous = (kind === "like" ? likedIds : savedIds).has(postId);
    setFailures((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
    setPending((prev) => new Set(prev).add(key));
    setOverrides((prev) => new Map(prev).set(key, !previous));
    try {
      await cache.cancelQueries(affectedQueries(postId));
      task.assertCurrent();
      const confirmed =
        kind === "like"
          ? await utils.client.feed.toggleLike.mutate(
              { postId },
              { signal: task.signal },
            )
          : await utils.client.feed.toggleSave.mutate(
              { postId },
              { signal: task.signal },
            );
      if (typeof confirmed !== "boolean") throw invalidResponse();
      task.assertCurrent();
      // Cancel any read that started before this write was confirmed.
      await cache.cancelQueries(affectedQueries(postId));
      task.assertCurrent();
      cache.setQueriesData<PostInteractions>(
        affectedQueries(postId),
        (data) => {
          if (!data) return data;
          const field = kind === "like" ? "likedIds" : "savedIds";
          const values = new Set(data?.[field] ?? []);
          if (confirmed) values.add(postId);
          else values.delete(postId);
          return {
            likedIds: data?.likedIds ?? [],
            savedIds: data?.savedIds ?? [],
            [field]: [...values],
          };
        },
      );
      void cache.invalidateQueries(affectedQueries(postId));
      void utils.feed.savedPosts.invalidate();
      void utils.feed.savedPostsPage.invalidate();
      if (kind === "like") {
        void utils.feed.getById.invalidate({ id: postId });
        void utils.feed.list.invalidate();
        void utils.feed.listPaginated.invalidate();
        void utils.club.listByCategory.invalidate();
      }
    } catch (cause) {
      checkOperationAccessError(cause);
      if (task.isCurrent()) {
        const status = getHttpStatus(cause);
        setFailures((prev) =>
          new Map(prev).set(key, {
            message: getRequestErrorMessage(cause),
            blocked: !status || status >= 500,
          }),
        );
      }
    } finally {
      setOverrides((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      task.finish();
      if (!scope.getSnapshot()) scopes.delete(key);
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };
  return {
    likedIds,
    savedIds,
    isReady: (id: number) => readyIds.has(id),
    // Counts are read from refreshed post data, rather than guessed after a server write.
    error:
      relevantFailures[0]?.[1].message ??
      (queries.find((query) => query.error)?.error
        ? getRequestErrorMessage(queries.find((query) => query.error)!.error)
        : null),
    retry,
    isPending: (kind: InteractionKind, id: number) =>
      pending.has(`${kind}:${id}`) ||
      Boolean(failures.get(`${kind}:${id}`)?.blocked),
    like: (id: number) => void toggle("like", id),
    save: (id: number) => void toggle("save", id),
  };
}
