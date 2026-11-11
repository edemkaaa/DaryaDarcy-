/** Adapt existing synthetic catalogs to the new wire contract, not production requests. */
/** Карта совместимости относится только к синтетическим ответам старых UI-сценариев; реальные запросы приложения она не переписывает. */
export const legacyCursorFixture = {
  "feed.savedPostsPage": "feed.savedPosts",
  "admin.membersPage": "admin.members",
  "admin.paymentsPage": "admin.payments",
  "club.commentsPage": "club.comments",
} as Record<string, string | undefined>;
/** Разбиваем готовый fixture-каталог на страницы с тестовым курсором; фильтры сохранённого, участников и веток применяем до среза. */
export function cursorFixture(
  reply: unknown,
  name: string,
  input: Record<string, unknown>,
) {
  const body = reply as { result?: { data?: { json?: unknown } } } | undefined;
  if (reply !== undefined && !Array.isArray(body?.result?.data?.json))
    return reply;
  const all = (body?.result?.data?.json ?? []) as Record<string, unknown>[];
  let rows = all;
  if (name === "feed.savedPostsPage")
    rows = rows.filter(
      (row) => row.target === input.target || row.target === "both",
    );
  if (name === "admin.membersPage" && input.userId)
    rows = rows.filter((row) => row.id === input.userId);
  if (name === "club.commentsPage")
    rows = rows
      .filter((row) => (row.parentId ?? null) === (input.parentId ?? null))
      .map((row) => ({
        ...row,
        replyCount: all.filter((child) => child.parentId === row.id).length,
      }));
  const offset = Number(String(input.cursor ?? "fixture:0").split(":")[1]),
    limit = Number(input.limit ?? 20);
  return {
    result: {
      data: {
        json: {
          items: rows.slice(offset, offset + limit),
          nextCursor:
            offset + limit < rows.length ? `fixture:${offset + limit}` : null,
          ...(name === "club.commentsPage" ? { totalCount: all.length } : {}),
        },
      },
    },
  };
}
