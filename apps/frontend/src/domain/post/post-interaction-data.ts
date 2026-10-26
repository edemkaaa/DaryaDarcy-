import { invalidResponse } from "@/shared/api/errors";

export type PostInteractions = { likedIds: number[]; savedIds: number[] };

/** Keep completed groups stable as another page is appended. */
export function interactionBatches(postIds: readonly number[]): number[][] {
  const ids = [...new Set(postIds)].filter(
    (id) => Number.isSafeInteger(id) && id > 0,
  );
  const batches: number[][] = [];
  for (let start = 0; start < ids.length; start += 50)
    batches.push(ids.slice(start, start + 50).sort((a, b) => a - b));
  return batches;
}

export function requirePostInteractions(
  value: unknown,
  postIds: readonly number[],
): PostInteractions {
  const data = value as PostInteractions | null;
  const requested = new Set(postIds);
  if (
    !data ||
    ![data.likedIds, data.savedIds].every(
      (ids) => Array.isArray(ids) && ids.every((id) => requested.has(id)),
    )
  )
    throw invalidResponse();
  return data;
}
