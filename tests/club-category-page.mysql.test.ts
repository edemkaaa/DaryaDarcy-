import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openListPageFixture } from "./helpers/list-page-fixture";

/** Проверяет серверную фильтрацию клубных разделов и тегов до LIMIT через настоящий HTTP и сессии. */
describe.skipIf(!testDatabaseUrl)(
  "club filters before pagination over HTTP/JWT/MySQL",
  () => {
    let fixture: Awaited<ReturnType<typeof openListPageFixture>>;
    const base = 942000;
    /** Запрашивает club.listByCategory от выбранного участника либо гостя. */
    const read = (input: object = {}, actor: number | null = 2) =>
      fixture.read("club.listByCategory", input, actor);
    /** Поднимает изолированную page-фикстуру с собственным диапазоном ID. */
    beforeAll(async () => {
      fixture = await openListPageFixture("club-category-page", base);
    });
    /** Возвращает исходные аккаунты и очищает только записи page-фикстуры. */
    beforeEach(async () => {
      await fixture.reset();
    });
    /** Закрывает API и удаляет данные, принадлежащие фикстуре. */
    afterAll(async () => {
      await fixture?.close();
    });
    /** Создаёт тестовый пост с заданными тегами и одинаковой датой для детерминированной пагинации. */
    async function post(
      index: number,
      tags: string[],
      target = "club",
      published = true,
    ) {
      const id = await fixture.post(index, target, published);
      await fixture.conn.query(
        "UPDATE posts SET tags=?,createdAt='2026-01-01' WHERE id=?",
        [JSON.stringify(tags), id],
      );
      return id;
    }
    /** Гостю возвращается 401, а не успешный пустой результат неизвестной или закрытой процедуры. */
    it("rejects guests rather than treating an unknown method as an empty list", async () => {
      expect((await read({}, null)).status).toBe(401);
    });
    /** Проверяет приоритет явных рубрик и нормализацию русских и английских aliases, пробелов и регистра. */
    it.each(["podborki", "community", "exclusive", "life"] as const)(
      "respects explicit section priority and fallback aliases for %s",
      async (category) => {
        const tags = [
          [" Подборка "],
          ["КОМЬЮНИТИ"],
          ["подкаст"],
          ["Личное"],
          ["подкаст", "life"],
          ["exclusive", "community"],
          ["life", "podborki"],
          ["personal", "podcast"],
          ["\uFEFF\u00A0ПИСЬМО\u3000"],
          ["unknown"],
        ];
        for (let i = 0; i < tags.length; i++) await post(i, tags[i]);
        const response = await read({ category, limit: 50 });
        expect(response.status).toBe(200);
        const data = response.data as unknown as {
          posts: { id: number }[];
          nextCursor: number | null;
        };
        const expected = {
          podborki: [0, 6],
          community: [1, 5],
          exclusive: [2, 7, 8],
          life: [3, 4],
        }[category];
        expect(data.posts.map((row) => row.id)).toEqual(
          expected.map((i) => base + 100 + i),
        );
        expect(data.nextCursor).toBe(null);
      },
    );
    /** Редкие совпадения раздела и тега отбираются до пагинации; feed-only и черновики исключаются. */
    it("filters rare matches and a combined board tag before LIMIT", async () => {
      for (let i = 0; i < 25; i++) await post(i, ["community", "сад"]);
      const a = await post(25, ["exclusive", " ЗИМА "], "both");
      const b = await post(26, ["письмо", "winter"]);
      await post(27, ["exclusive", "winter"], "feed");
      await post(28, ["exclusive", "winter"], "club", false);
      const first = await read({
        category: "exclusive",
        tag: "winter",
        limit: 1,
      });
      expect(first.status).toBe(200);
      const page = first.data as unknown as {
        posts: { id: number }[];
        nextCursor: number | null;
      };
      expect(page.posts.map((row) => row.id)).toEqual([a]);
      expect(page.nextCursor).toBe(1);
      const next = (
        await read({
          category: "exclusive",
          tag: "Зима",
          limit: 1,
          cursor: page.nextCursor,
        })
      ).data as unknown as typeof page;
      expect(next.posts.map((row) => row.id)).toEqual([b]);
      expect(next.nextCursor).toBe(null);
      const empty = (await read({ category: "life", limit: 1 }))
        .data as unknown as typeof page;
      expect(empty).toEqual({ posts: [], nextCursor: null });
    });
    /** Каждый запрос учитывает текущее продление или истечение доступа и отклоняет лишние и некорректные поля. */
    it("applies membership on every request and rejects unknown input", async () => {
      await post(0, ["life"]);
      expect((await read({}, 0)).status).toBe(403);
      await fixture.grant();
      expect((await read({}, 0)).status).toBe(200);
      await fixture.conn.query(
        "UPDATE club_payments SET expiresAt='2020-01-01' WHERE userId=?",
        [base],
      );
      expect((await read({}, 0)).status).toBe(403);
      for (const input of [
        { category: "unknown" },
        { category: ["life"] },
        { tag: " " },
        { limit: 51 },
        { category: "life", extra: true },
      ])
        expect((await read(input)).status).toBe(400);
    });
  },
);
