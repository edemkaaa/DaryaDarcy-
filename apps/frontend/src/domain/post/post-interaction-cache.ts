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

function matches(key: QueryKey, paths: Set<string>) {
  return Array.isArray(key[0]) && paths.has(key[0].join("."));
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// Only traverse the supported list envelopes, never media, comments or cursors.
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

/** Copy the server's count into existing cards without reloading their lists. */
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

/** Keyset cursors remain valid when an unsaved card is removed from any page. */
export function removeCachedSavedPost(client: QueryClient, postId: number) {
  client.setQueriesData(
    { predicate: (query) => matches(query.queryKey, savedLists) },
    (data) => {
      const next = updatePost(data, postId, null);
      return next === data ? undefined : next;
    },
  );
}

/** A successful absence response must not keep a deleted/hidden card visible. */
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
