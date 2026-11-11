import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import {
  openListPageFixture,
  type ListPage,
} from "./helpers/list-page-fixture";

/** Проверяет keyset-страницы сохранённого, доступ к постам, исторические дубли и привязку cursor к пользователю. */
describe.skipIf(!testDatabaseUrl)(
  "saved page over real HTTP/JWT/disposable MySQL",
  () => {
    let fixture: Awaited<ReturnType<typeof openListPageFixture>>;
    const base = 880000;
    /** Читает savedPostsPage выбранного аккаунта с feed-target по умолчанию. */
    const read = (input: object, actor: number | null = 0) =>
      fixture.read("feed.savedPostsPage", { target: "feed", ...input }, actor);
    /** Создаёт синтетическое сохранение с выбранной датой и владельцем. */
    const save = (postId: number, actor = 0, date = "2026-01-01") =>
      fixture.conn.query(
        "INSERT INTO saved_posts(userId,postId,createdAt) VALUES(?,?,?)",
        [base + actor, postId, date],
      );
    /** Последовательно создаёт нужное число постов и сохранений с одинаковой датой. */
    const seed = async (count: number) => {
      for (let index = 0; index < count; index++)
        await save(await fixture.post(index));
    };
    /** Запускает отдельную HTTP/JWT page-фикстуру. */
    beforeAll(async () => {
      fixture = await openListPageFixture("pagination-saved", base);
    });
    /** Очищает собственные данные и возвращает исходные права пользователей. */
    beforeEach(async () => {
      await fixture.reset();
    });
    /** Закрывает и удаляет изолированную page-фикстуру. */
    afterAll(async () => {
      await fixture?.close();
    });
    /** Полный обход равнодатных сохранений ограничен двадцатью элементами и не повторяет cursor или посты. */
    it.each([0, 20, 21, 50, 51])(
      "pages all %i equal-date saves once with a bounded response",
      async (count) => {
        await seed(count);
        let cursor: string | null = null;
        const found: number[] = [],
          cursors: string[] = [];
        do {
          const response = await read({ cursor });
          expect(response.status).toBe(200);
          const page = response.data;
          expect(page.items.length).toBeLessThanOrEqual(20);
          found.push(...page.items.map((x) => x.id));
          cursor = page.nextCursor;
          if (cursor) {
            expect(cursors).not.toContain(cursor);
            cursors.push(cursor);
          }
          expect(cursors.length).toBeLessThan(4);
        } while (cursor);
        expect(found).toEqual(
          Array.from({ length: count }, (_, i) => base + 100 + count - 1 - i),
        );
      },
    );
    /** Недоступные, скрытые и отсутствующие посты отбрасываются до LIMIT; сохранения другого владельца не раскрываются. */
    it("filters private/draft/missing rows before LIMIT and never leaks another owner's saves", async () => {
      const open = await fixture.post(0, "both");
      await save(open);
      for (let i = 1; i < 25; i++) await save(await fixture.post(i, "club"));
      await save(await fixture.post(26, "feed", false));
      await save(base + 299);
      await save(await fixture.post(27), 1);
      const result = await read({ limit: 1 });
      expect(result.status).toBe(200);
      expect(result.data.items.map((x) => x.id)).toEqual([open]);
      expect(result.data.nextCursor).toBeNull();
      expect(
        (await read({ target: "club" })).data.items.map((x) => x.id),
      ).toEqual([open]);
      expect((await read({}, 1)).data.items.map((x) => x.id)).toEqual([
        base + 127,
      ]);
    });
    /** Лимит 50 не теряет последнюю запись за первой страницей. */
    it("honors the explicit 50-item maximum without truncating the last item", async () => {
      await seed(51);
      const first = await read({ limit: 50 });
      expect(first.status).toBe(200);
      expect(first.data.items).toHaveLength(50);
      const last = await read({ limit: 50, cursor: first.data.nextCursor });
      expect(last.data.items.map((row) => row.id)).toEqual([base + 100]);
      expect(last.data.nextCursor).toBeNull();
    });
    /** Дубли сохранений схлопываются по последней реальной строке с сохранением media и reaction-проекции. */
    it("deduplicates historical saves using the newest actual row, preserving media/reactions", async () => {
      const a = await fixture.post(0),
        b = await fixture.post(1);
      await save(a, 0, "2026-01-02");
      await save(b, 0, "2026-01-03");
      await save(a, 0, "2026-01-04");
      await fixture.conn.query(
        "INSERT INTO post_media(id,postId,type,url) VALUES(880900,?,'audio','https://example.test/a.m4a')",
        [a],
      );
      await fixture.conn.query("INSERT INTO likes(userId,postId) VALUES(?,?)", [
        base,
        a,
      ]);
      const first = await read({ limit: 1 });
      expect(first.status).toBe(200);
      expect(first.data.items[0]).toMatchObject({
        id: a,
        likeCount: 1,
        media: [{ id: 880900 }],
      });
      expect(
        (
          await read({ limit: 1, cursor: first.data.nextCursor })
        ).data.items.map((x) => x.id),
      ).toEqual([b]);
    });
    /** Истёкшая между страницами подписка возвращает пустую закрытую выборку без выдачи прежнего доступа. */
    it("checks current subscription on each page", async () => {
      await fixture.grant();
      await save(await fixture.post(0, "club"));
      await save(await fixture.post(1, "club"));
      const first = await read({ target: "club", limit: 1 });
      expect(first.status).toBe(200);
      expect(first.data.nextCursor).toBeTypeOf("string");
      await fixture.conn.query(
        "UPDATE club_payments SET expiresAt='2020-01-01' WHERE userId=?",
        [base],
      );
      const next = await read({
        target: "club",
        limit: 1,
        cursor: first.data.nextCursor,
      });
      expect(next.status).toBe(200);
      expect(next.data).toEqual({ items: [], nextCursor: null });
    });
    /** Удаление anchor и новое более свежее сохранение не сбивают продолжение keyset-обхода. */
    it("keeps keyset traversal valid after deleting the anchor and inserting a newer save", async () => {
      await seed(3);
      const first = await read({ limit: 1 });
      expect(first.status).toBe(200);
      await fixture.conn.query("DELETE FROM saved_posts WHERE postId=?", [
        base + 102,
      ]);
      await save(await fixture.post(3), 0, "2026-02-01");
      const next = await read({ limit: 2, cursor: first.data.nextCursor });
      expect(next.data.items.map((x) => x.id)).toEqual([
        base + 101,
        base + 100,
      ]);
      expect(next.data.nextCursor).toBeNull();
    });
    /** Cursor другого пользователя, target или неверного формата отклоняется, а не сбрасывает страницу. */
    it("rejects cross-owner/filter and malformed cursors instead of resetting to the first page", async () => {
      await seed(2);
      const first = await read({ limit: 1 });
      expect(first.status).toBe(200);
      for (const [input, actor] of [
        [{ cursor: first.data.nextCursor }, 1],
        [{ cursor: first.data.nextCursor, target: "club" }, 0],
        [{ cursor: "not-a-cursor" }, 0],
      ] as const)
        expect((await read(input, actor)).status).toBe(400);
    });
    /** Лимиты, oversized cursor и лишние поля отклоняются с 400. */
    it.each([
      { limit: 0 },
      { limit: 51 },
      { limit: 1.5 },
      { cursor: "x".repeat(1025) },
      { direction: "backward" },
      { userId: base + 1 },
    ])("rejects invalid input %j", async (input) => {
      expect((await read(input)).status).toBe(400);
    });
    /** Сохранённое недоступно без сессии. */
    it("requires authentication", async () => {
      expect((await read({}, null)).status).toBe(401);
    });
  },
);
