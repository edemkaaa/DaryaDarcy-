/** Adapt old synthetic account marks to a bounded response; no production fallback. */
/** Сужаем старые синтетические liked/saved-массивы до запрошенных postIds; некорректный ответ сохраняем для проверки ошибок клиента. */
export function interactionFixture(
  reply: unknown,
  input: Record<string, unknown>,
) {
  const body = reply as
    | {
        result?: {
          data?: { json?: { likedIds?: unknown; savedIds?: unknown } };
        };
      }
    | undefined;
  const data = body?.result?.data?.json;
  if (
    reply !== undefined &&
    (!Array.isArray(data?.likedIds) || !Array.isArray(data?.savedIds))
  )
    return reply;
  const ids = new Set((input.postIds ?? []) as number[]);
  return {
    result: {
      data: {
        json: {
          likedIds: ((data?.likedIds ?? []) as number[]).filter((id) =>
            ids.has(id),
          ),
          savedIds: ((data?.savedIds ?? []) as number[]).filter((id) =>
            ids.has(id),
          ),
        },
      },
    },
  };
}
