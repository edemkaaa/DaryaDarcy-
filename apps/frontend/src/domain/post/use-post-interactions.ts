"use client";
/** Оптимистичная отметка временная: после ответа обновляем подтверждённые данные, а неизвестный результат проверяем чтением. */
import { useEffect } from "react";
import { useQueries, useQueryClient, type Query } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { cancelInactiveCursorQuery } from "@/shared/api/cursor-pages";
import { interactionBatches } from "./post-interaction-data";
import type { PostInteractionSnapshot } from "./post-interaction-reader";
import { usePostInteractionState } from "./post-interactions-context";
import {
  removeCachedSavedPost,
  removeUnavailableCachedPost,
  updateCachedPostLikeCount,
} from "./post-interaction-cache";
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
/** Согласуем пер-постовый кеш чтения и общие записи владельца; неизвестный исход toggle блокирует повтор до нового подтверждённого чтения. */
export function usePostInteractions(postIds: readonly number[]) {
  const { user } = useAuth();
  const active = useScreenActive();
  const utils = trpc.useUtils();
  const cache = useQueryClient();
  const ownerScope = String(user?.id ?? "guest");
  const {
    reader,
    scopes,
    overrides,
    setOverrides,
    pending,
    setPending,
    failures,
    setFailures,
  } = usePostInteractionState();
  const ids = interactionBatches(postIds).flat();
  const queryKeys = ids.map((id) => [
    ...getQueryKey(trpc.feed.interactionsForPosts, { postIds: [id] }, "query"),
    { ownerScope },
  ]);
  const enabled = Boolean(user) && active;
  const queries = useQueries({
    queries: ids.map((id, index) => ({
      queryKey: queryKeys[index],
      queryFn: ({ signal }: { signal: AbortSignal }) => reader.read(id, signal),
      enabled,
      staleTime: 30_000,
      gcTime: 60_000,
      refetchOnMount: true,
      refetchOnWindowFocus: "always" as const,
      refetchOnReconnect: "always" as const,
    })),
  });
  const identity = JSON.stringify(queryKeys);
  useEffect(() => {
    /** Отменяем только неиспользуемые query скрытого экрана, оставляя общую отметку другим активным карточкам. */
    const cancelUnused = () => {
      for (const key of JSON.parse(identity))
        cancelInactiveCursorQuery(cache, key);
    };
    if (!enabled) cancelUnused();
    return cancelUnused;
  }, [cache, enabled, identity]);
  /** Ограничиваем отмену/обновление query своим ownerScope и конкретным ID, чтобы поздний ACK не затронул другой аккаунт. */
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
  const requested = new Set(ids);
  const likedIds = new Set<number>();
  const savedIds = new Set<number>();
  const readyIds = new Set<number>();
  queries.forEach((query, index) => {
    if ([401, 403, 404].includes(getHttpStatus(query.error) ?? 0)) return;
    for (const id of query.data?.likedIds ?? []) likedIds.add(id);
    for (const id of query.data?.savedIds ?? []) savedIds.add(id);
    if (enabled && query.isSuccess && !query.isFetching && !query.isError)
      readyIds.add(ids[index]);
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
  /** Получаем фактический счётчик из свежей детали после ACK и распространяем его по кешу; отсутствие поста удаляет карточки. */
  const refreshLikeCount = async (
    postId: number,
    signal: AbortSignal,
    isCurrent: () => boolean,
  ) => {
    const queryKey = getQueryKey(trpc.feed.getById, { id: postId }, "query");
    await cache.cancelQueries({ queryKey, exact: true });
    signal.throwIfAborted();
    if (!isCurrent()) return;
    const post = await cache.fetchQuery({
      queryKey,
      staleTime: 0,
      retry: false,
      queryFn: async ({ signal: querySignal }) => {
        const combined = AbortSignal.any([signal, querySignal]);
        const result = await utils.client.feed.getById.query(
          { id: postId },
          { signal: combined },
        );
        combined.throwIfAborted();
        if (!isCurrent())
          throw new DOMException("Операция отменена", "AbortError");
        if (
          result &&
          (!Number.isSafeInteger(result.likeCount) || result.likeCount < 0)
        )
          throw invalidResponse();
        return result ?? null;
      },
    });
    signal.throwIfAborted();
    if (!isCurrent()) return;
    if (post) updateCachedPostLikeCount(cache, postId, post.likeCount);
    else removeUnavailableCachedPost(cache, postId);
  };
  /** Читаем отметки заново и освобождаем только те ошибки, для которых появилась новая readVersion; лайк дополнительно требует счётчик. */
  const retry = async () => {
    if (!enabled) return;
    const parent = getSessionRequestSignal();
    const owner = user?.id;
    const failuresBeforeRead = relevantFailures;
    const recovered = new Set<number>();
    await Promise.all(
      queries.map(async (query, index) => {
        const versionBeforeRead = query.data?.readVersion;
        const result = await query.refetch();
        if (result.isSuccess && result.data?.readVersion !== versionBeforeRead)
          recovered.add(ids[index]);
      }),
    );
    if (parent.aborted || !owner || !isPersonalDataOwner(owner)) return;
    const recoveredCounts = new Set<number>();
    await Promise.all(
      failuresBeforeRead.map(async ([key, failure]) => {
        if (!key.startsWith("like:")) return;
        const id = Number(key.split(":")[1]);
        if (!recovered.has(id) || failures.get(key) !== failure) return;
        let scope = scopes.get(key);
        if (!scope) {
          scope = new OperationScope();
          scopes.set(key, scope);
        }
        const task = scope.begin("refresh", parent, () =>
          isPersonalDataOwner(owner),
        );
        if (!task) return;
        setPending((current) => new Set(current).add(key));
        try {
          await refreshLikeCount(id, task.signal, task.isCurrent);
          if (task.isCurrent()) recoveredCounts.add(id);
        } catch (cause) {
          checkOperationAccessError(cause);
        } finally {
          task.finish();
          if (!scope.getSnapshot()) scopes.delete(key);
          setPending((current) => {
            const next = new Set(current);
            next.delete(key);
            return next;
          });
        }
      }),
    );
    if (parent.aborted || !isPersonalDataOwner(owner)) return;
    // Only a fresh successful read of this post may release its earlier failure.
    setFailures((current) => {
      const next = new Map(current);
      for (const [key, failure] of failuresBeforeRead)
        if (
          recovered.has(Number(key.split(":")[1])) &&
          (!key.startsWith("like:") ||
            recoveredCounts.has(Number(key.split(":")[1]))) &&
          next.get(key) === failure
        )
          next.delete(key);
      return next;
    });
  };
  /** Оптимистично меняем отметку одной scoped-операцией; ACK обновляет кеш, неизвестный исход блокирует новый toggle, finally убирает временный override. */
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
    let writeConfirmed = false;
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
      writeConfirmed = true;
      // Cancel any read that started before this write was confirmed.
      await cache.cancelQueries(affectedQueries(postId));
      task.assertCurrent();
      cache.setQueriesData<PostInteractionSnapshot>(
        affectedQueries(postId),
        (data) => {
          if (!data) return data;
          const field = kind === "like" ? "likedIds" : "savedIds";
          const values = new Set(data?.[field] ?? []);
          if (confirmed) values.add(postId);
          else values.delete(postId);
          return {
            ...data,
            likedIds: data?.likedIds ?? [],
            savedIds: data?.savedIds ?? [],
            [field]: [...values],
          };
        },
      );
      if (kind === "like") {
        await refreshLikeCount(postId, task.signal, task.isCurrent);
      } else {
        // Cancel older saved-list reads before removing a card from the tail.
        await Promise.all([
          utils.feed.savedPosts.cancel(),
          utils.feed.savedPostsPage.cancel(),
        ]);
        task.assertCurrent();
        if (!confirmed) removeCachedSavedPost(cache, postId);
        void utils.feed.savedPosts.invalidate();
        void utils.feed.savedPostsPage.invalidate();
      }
    } catch (cause) {
      checkOperationAccessError(cause);
      if (task.isCurrent()) {
        const status = getHttpStatus(cause);
        setFailures((prev) =>
          new Map(prev).set(key, {
            message:
              writeConfirmed && kind === "like"
                ? "Отметка обновлена, но не удалось обновить счётчик. Обновите отметки."
                : getRequestErrorMessage(cause),
            blocked: !writeConfirmed && (!status || status >= 500),
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
