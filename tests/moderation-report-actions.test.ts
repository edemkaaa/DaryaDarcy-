/** Подсказка блокировки автора жалобы вычисляется для текущего actor; внутренние role-поля не уходят в DTO. */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as db from "../apps/backend/src/db";
import { listCommentReports } from "../apps/backend/src/content/comments";
import type { User } from "../packages/database/src/schema";

/** Снимаем SQL-spy после каждого варианта матрицы прав. */
afterEach(() => vi.restoreAllMocks());
/** Создаём минимальный административный actor с явно изменяемыми blocked/deletion признаками. */
const actor = (role: User["role"], extra: Partial<User> = {}) => ({
  id: 10,
  role,
  blockedAt: null,
  accountDeletionRequestedAt: null,
  ...extra,
});
/** Синтетическая joined-строка содержит внутреннюю роль автора для настоящей политики проекции. */
function databaseRow(role: User["role"] | null, extra = {}) {
  return {
    id: 1,
    commentId: 2,
    reason: "synthetic",
    createdAt: new Date(0),
    commentText: "synthetic comment",
    commentPhotos: null,
    postId: 3,
    authorUserId: 20,
    authorName: "Author",
    reporterUserId: 30,
    reporterName: null,
    authorRole: role,
    authorBlockedAt: null,
    ...extra,
  };
}
/** Заменяем только SQL-chain результат; listCommentReports и вычисление canBlockAuthor остаются настоящими. */
function stubRead(row: ReturnType<typeof databaseRow>) {
  // Only the external SQL result is replaced; projection and policy remain real.
  const query = {
    from: () => query,
    innerJoin: () => query,
    leftJoin: () => query,
    orderBy: () => query,
    limit: async () => [row],
  };
  vi.spyOn(db, "getDb").mockResolvedValue({ select: () => query } as never);
}
/** Матрица проверяет подсказку интерфейсу, не подменяя авторизацию самой операции блокировки. */
describe("report author actions are actor-scoped UI hints", () => {
  /** Разрешение зависит от обеих ролей; служебные поля автора исключаются из результата. */
  it.each([
    ["admin", "user", true],
    ["admin", "moderator", true],
    ["admin", "admin", true],
    ["moderator", "user", true],
    ["moderator", "moderator", false],
    ["moderator", "admin", false],
    ["user", "user", false],
    ["admin", null, false],
  ] as const)(
    "%s reading an author with role %s",
    async (role, authorRole, allowed) => {
      stubRead(databaseRow(authorRole));
      const [report] = await listCommentReports(100, actor(role));
      expect(report.canBlockAuthor).toBe(allowed);
      expect(report).not.toHaveProperty("authorRole");
      expect(report).not.toHaveProperty("authorBlockedAt");
    },
  );
  /** Самоблокировка, недействующий actor и уже заблокированный автор не предлагают действие. */
  it.each([
    { who: actor("admin"), extra: { authorUserId: 10 } },
    { who: actor("moderator", { blockedAt: new Date(0) }), extra: {} },
    {
      who: actor("admin", { accountDeletionRequestedAt: new Date(0) }),
      extra: {},
    },
    { who: actor("admin"), extra: { authorBlockedAt: new Date(0) } },
  ])(
    "does not offer a forbidden or redundant block %#",
    async ({ who, extra }) => {
      stubRead(databaseRow("user", extra));
      expect((await listCommentReports(100, who))[0].canBlockAuthor).toBe(
        false,
      );
    },
  );
  /** Вызов без контекста пользователя не получает административную подсказку по умолчанию. */
  it("defaults to no action when a non-HTTP consumer has no actor", async () => {
    stubRead(databaseRow("user"));
    expect((await listCommentReports(100))[0].canBlockAuthor).toBe(false);
  });
});
