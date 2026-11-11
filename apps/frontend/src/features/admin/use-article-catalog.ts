"use client";
/** Список статей остаётся смонтированным рядом с редактором и сохраняет ограниченное окно страниц и позицию прокрутки. */
import { useEffect, useRef } from "react";
import { getQueryKey } from "@trpc/react-query";
import { trpc } from "@/shared/api/trpc";
import { useCursorPages } from "@/shared/api/use-cursor-pages";

// Keep this hook mounted while the editor is open, so its page state survives.
export function useArticleCatalog(ownerId: number, enabled: boolean) {
  // Держит окно страниц статьи в области владельца, чтобы открытие редактора не сбрасывало список и прокрутку.

  const utils = trpc.useUtils();
  const list = useCursorPages({
    key: getQueryKey(trpc.admin.articlesPage, { limit: 20 }, "query"),
    scope: String(ownerId),
    enabled,
    fetchPage: (cursor, signal) =>
      /* Запрашивает только следующую административную страницу с сигналом отмены; ограничение объёма задано серверным контрактом. */ utils.client.admin.articlesPage.query({ limit: 20, cursor }, { signal }),
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCardRef = useRef<HTMLDivElement>(null);
  const {
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isError,
    fetchNextPage,
  } = list;
  const cardCount = list.items.length;
  useEffect(() => {
    // Подгружает страницу при приближении последней карточки к окну списка; во время ошибки или запроса наблюдатель не создаёт повторов.

    if (
      !enabled ||
      !hasNextPage ||
      isFetching ||
      isFetchingNextPage ||
      isError ||
      !lastCardRef.current ||
      !scrollRef.current
    )
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void fetchNextPage();
      },
      { root: scrollRef.current, rootMargin: "200px" },
    );
    observer.observe(lastCardRef.current);
    return () => observer.disconnect();
  }, [
    enabled,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isError,
    fetchNextPage,
    cardCount,
  ]);
  return { list, scrollRef, lastCardRef };
}

export type ArticleCatalogState = ReturnType<typeof useArticleCatalog>;
