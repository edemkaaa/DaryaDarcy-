import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openListPageFixture } from "./helpers/list-page-fixture";
import { users } from "../packages/database/src/schema";
import { savedPostsPage } from "../apps/backend/src/content/saved-posts-page";
import { membersPage } from "../apps/backend/src/admin/members-page";
import { commentsPage } from "../apps/backend/src/content/comments-page";

/** Проверяет фактически отправленный SQL пагинации: кандидаты ограничены до гидратации и агрегаций. */
describe.skipIf(!testDatabaseUrl)(
  "pagination SQL sent to disposable MySQL",
  () => {
    let fixture: Awaited<ReturnType<typeof openListPageFixture>>;
    /** Создаёт собственную page-фикстуру и три сохранённых поста. */
    beforeAll(async () => {
      fixture = await openListPageFixture("pagination-query", 889000);
      await fixture.reset();
      for (let i = 0; i < 3; i++) {
        const id = await fixture.post(i);
        await fixture.conn.query(
          "INSERT INTO saved_posts(userId,postId) VALUES(889000,?)",
          [id],
        );
      }
    });
    /** Закрывает и очищает изолированную фикстуру. */
    afterAll(async () => fixture?.close());
    /** Подключает Drizzle-logger, читает текущего участника и начинает наблюдение с пустого журнала SQL. */
    async function observed() {
      const queries: { sql: string; params: unknown[] }[] = [];
      const database = drizzle({
        client: fixture.conn,
        logger: { /** Запоминает отправленный SQL и параметры для проверки LIMIT и области ID. */ logQuery: (sql, params) => queries.push({ sql, params }) },
      });
      const [actor] = await database
        .select()
        .from(users)
        .where(eq(users.id, 889000));
      queries.length = 0;
      return { database, actor, queries };
    }
    /** Сначала выбирается limit+1 сохранений, затем посты и вложения только возвращаемого ID. */
    it("limits save candidates before hydrating posts and media for page IDs", async () => {
      const { database, actor, queries } = await observed();
      await savedPostsPage(database, actor, { target: "feed", limit: 1 });
      const candidates = queries.find((x) =>
        /from `saved_posts` inner join/.test(x.sql),
      )!;
      expect(candidates.sql).toMatch(/limit \?/);
      expect(candidates.params.at(-1)).toBe(2);
      const hydration = queries.filter((x) =>
        /from `posts`|from `post_media`/.test(x.sql),
      );
      expect(hydration).toHaveLength(2);
      for (const query of hydration) {
        expect(query.sql).toMatch(/ in \(\?\)/);
        expect(query.params.filter((x) => typeof x === "number")).toEqual([
          889102,
        ]);
      }
    });
    /** Агрегация сроков подписки ограничена участниками страницы, а не всей платежной таблицей. */
    it("aggregates payments only for returned member IDs, not the whole ledger", async () => {
      const { database, queries } = await observed();
      const result = await membersPage(database, 889002, {
        limit: 1,
        userId: 889000,
      });
      expect(result.items.map((x) => x.id)).toEqual([889000]);
      const accounts = queries.find((x) => /from `users`/.test(x.sql))!;
      expect(accounts.sql).toMatch(/limit \?/);
      expect(accounts.params.at(-1)).toBe(2);
      const ledger = queries.find((x) => /from `club_payments`/.test(x.sql))!;
      expect(ledger.sql).toMatch(/max\(/);
      expect(ledger.sql).toMatch(/group by/);
      expect(ledger.sql).toMatch(/ in \(\?\)/);
      expect(ledger.params[0]).toBe(889000);
    });
    /** Список корней имеет отдельный parentId IS NULL и limit+1 независимо от count-запросов. */
    it("bounds a root group query separately from aggregate counts", async () => {
      const { database, actor, queries } = await observed();
      await commentsPage(database, actor, { postId: 889100, limit: 20 });
      const group = queries.find((x) =>
        /from `post_comments` left join/.test(x.sql),
      )!;
      expect(group.sql).toMatch(/`parentId` is null/);
      expect(group.sql).toMatch(/limit \?/);
      expect(group.params.at(-1)).toBe(21);
    });
  },
);
