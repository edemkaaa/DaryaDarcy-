/** Подготовка набора ID ограничивает объём запроса отметок и отбрасывает неподходящие значения до транспорта. */
import { invalidResponse } from "@/shared/api/errors";

export type PostInteractions = { likedIds: number[]; savedIds: number[] };

/** Убираем дубли и недопустимые ID, затем формируем упорядоченные сетевые пачки не больше 50 элементов. */
export function interactionBatches(postIds: readonly number[]): number[][] {
  const ids = [...new Set(postIds)].filter(
    (id) => Number.isSafeInteger(id) && id > 0,
  );
  const batches: number[][] = [];
  for (let start = 0; start < ids.length; start += 50)
    batches.push(ids.slice(start, start + 50).sort((a, b) => a - b));
  return batches;
}

/** Принимаем likedIds/savedIds только из запрошенного множества; некорректный ответ не должен изменить чужие карточки. */
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
