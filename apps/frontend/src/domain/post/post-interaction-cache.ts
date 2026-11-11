/** Обновляем представления одного поста во всех известных списках, сохраняя структуру страниц и остальных карточек. */
import type { QueryClient, QueryKey } from "@tanstack/react-query";

const postLists = new Set([
  "feed.list",
  "feed.listPaginated",
  "feed.getById",
  "feed.savedPosts",
  "feed.savedPostsPage",
  "club.list",
  "club.listByCategory",
]);
const savedLists = new Set(["feed.savedPosts", "feed.savedPostsPage"]);

/** Проверяем путь tRPC query, чтобы обновлять только согласованные списки публикаций. */
function matches(key: QueryKey, paths: Set<string>) {
  return Array.isArray(key[0]) && paths.has(key[0].join("."));
}

/** Отличаем объект записи от массива и null перед обходом поддерживаемых envelopes. */
function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Only traverse the supported list envelopes, never media, comments or cursors.
/** Рекурсивно меняем только pages/posts/items; нетронутые ветви сохраняют ссылку, null-count удаляет нужную карточку. */
function updatePost(
  data: unknown,
  postId: number,
  likeCount: number | null,
): unknown {
  if (Array.isArray(data)) {
    const rows = data
      .filter((row) => likeCount !== null || !record(row) || row.id !== postId)
      .map((row) => updatePost(row, postId, likeCount));
    return rows.length === data.length &&
      rows.every((row, i) => row === data[i])
      ? data
      : rows;
  }
  if (!record(data)) return data;
  if (data.id === postId)
    return likeCount === null
      ? null
      : data.likeCount === likeCount
        ? data
        : { ...data, likeCount };
  for (const field of ["pages", "posts", "items"] as const) {
    if (!Array.isArray(data[field])) continue;
    const rows = updatePost(data[field], postId, likeCount);
    return rows === data[field] ? data : { ...data, [field]: rows };
  }
  return data;
}

/** Копируем подтверждённый сервером счётчик в уже загруженные карточки без полного повторного запроса списка. */
export function updateCachedPostLikeCount(
  client: QueryClient,
  postId: number,
  likeCount: number,
) {
  client.setQueriesData(
    { predicate: (query) => matches(query.queryKey, postLists) },
    (data) => {
      const next = updatePost(data, postId, likeCount);
      return next === data ? undefined : next;
    },
  );
}

/** Удаляем снятый bookmark из известных страниц сохранённого, сохраняя keyset-курсоры. */
export function removeCachedSavedPost(client: QueryClient, postId: number) {
  client.setQueriesData(
    { predicate: (query) => matches(query.queryKey, savedLists) },
    (data) => {
      const next = updatePost(data, postId, null);
      return next === data ? undefined : next;
    },
  );
}

/** Подтверждённое отсутствие скрывает карточку во всех поддерживаемых кешах, а не оставляет удалённый контент на экране. */
export function removeUnavailableCachedPost(
  client: QueryClient,
  postId: number,
) {
  client.setQueriesData(
    { predicate: (query) => matches(query.queryKey, postLists) },
    (data) => {
      const next = updatePost(data, postId, null);
      return next === data ? undefined : next;
    },
  );
}
