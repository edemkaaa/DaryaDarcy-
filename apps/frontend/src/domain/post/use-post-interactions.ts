"use client";
import { useEffect, useRef, useState } from "react";
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
export function usePostInteractions() {
  const { user } = useAuth();
  const active = useScreenActive();
  const utils = trpc.useUtils();
  const query = trpc.feed.userInteractions.useQuery(undefined, {
    enabled: Boolean(user) && active,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const scopes = useRef(new Map<string, OperationScope>());
  const blocked = useRef(new Set<string>());
  const [overrides, setOverrides] = useState(new Map<string, boolean>());
  const [pending, setPending] = useState(new Set<string>());
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const activeScopes = scopes.current;
    return () => {
      for (const scope of activeScopes.values()) scope.cancel();
      activeScopes.clear();
    };
  }, [user?.id]);
  const idsAreValid = (value: unknown): value is number[] =>
    Array.isArray(value) &&
    value.every((id) => Number.isSafeInteger(id) && id > 0);
  const validData =
    query.data &&
    idsAreValid(query.data.likedIds) &&
    idsAreValid(query.data.savedIds)
      ? query.data
      : null;
  const likedIds = new Set(validData?.likedIds ?? []);
  const savedIds = new Set(validData?.savedIds ?? []);
  for (const [key, value] of overrides) {
    const [kind, id] = key.split(":");
    const ids = kind === "like" ? likedIds : savedIds;
    if (value) ids.add(Number(id));
    else ids.delete(Number(id));
  }
  const ready = Boolean(
    active && user && validData && !query.isFetching && !query.isError,
  );
  const retry = async () => {
    const parent = getSessionRequestSignal();
    const owner = user?.id;
    const result = await query.refetch();
    if (parent.aborted || !owner || !isPersonalDataOwner(owner)) return;
    if (
      result.isSuccess &&
      idsAreValid(result.data?.likedIds) &&
      idsAreValid(result.data?.savedIds)
    ) {
      blocked.current.clear();
      setError(null);
    }
  };
  const toggle = async (kind: InteractionKind, postId: number) => {
    if (!ready || !user || !Number.isSafeInteger(postId) || postId <= 0) return;
    const key = `${kind}:${postId}`;
    if (blocked.current.has(key)) {
      setError("Изменение не подтверждено. Обновите отметки перед повтором.");
      return;
    }
    let scope = scopes.current.get(key);
    if (!scope) {
      scope = new OperationScope();
      scopes.current.set(key, scope);
    }
    const owner = user.id;
    const task = scope.begin(kind, getSessionRequestSignal(), () =>
      isPersonalDataOwner(owner),
    );
    if (!task) return;
    const previous = (kind === "like" ? likedIds : savedIds).has(postId);
    setError(null);
    setPending((prev) => new Set(prev).add(key));
    setOverrides((prev) => new Map(prev).set(key, !previous));
    try {
      await utils.feed.userInteractions.cancel();
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
      await utils.feed.userInteractions.cancel();
      task.assertCurrent();
      utils.feed.userInteractions.setData(undefined, (data) => {
        const field = kind === "like" ? "likedIds" : "savedIds";
        const values = new Set(data?.[field] ?? []);
        if (confirmed) values.add(postId);
        else values.delete(postId);
        return {
          likedIds: data?.likedIds ?? [],
          savedIds: data?.savedIds ?? [],
          [field]: [...values],
        };
      });
      void utils.feed.userInteractions.invalidate();
      void utils.feed.savedPosts.invalidate();
      void utils.feed.savedPostsPage.invalidate();
      if (kind === "like") {
        void utils.feed.getById.invalidate({ id: postId });
        void utils.feed.list.invalidate();
        void utils.feed.listPaginated.invalidate();
        void utils.club.list.invalidate();
      }
    } catch (cause) {
      checkOperationAccessError(cause);
      if (task.isCurrent()) {
        const status = getHttpStatus(cause);
        if (!status || status >= 500) blocked.current.add(key);
        setError(getRequestErrorMessage(cause));
      }
    } finally {
      if (task.isCurrent())
        setOverrides((prev) => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      else setOverrides(new Map());
      task.finish();
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
    ready,
    // Counts are read from refreshed post data, rather than guessed after a server write.
    error:
      error ??
      (query.error
        ? getRequestErrorMessage(query.error)
        : query.data && !validData
          ? invalidResponse().message
          : null),
    retry,
    isPending: (kind: InteractionKind, id: number) =>
      pending.has(`${kind}:${id}`) || blocked.current.has(`${kind}:${id}`),
    like: (id: number) => void toggle("like", id),
    save: (id: number) => void toggle("save", id),
  };
}
