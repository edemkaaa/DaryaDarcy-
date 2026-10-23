import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import {
  openListPageFixture,
  type ListPage,
} from "./helpers/list-page-fixture";

describe.skipIf(!testDatabaseUrl)(
  "saved page over real HTTP/JWT/disposable MySQL",
  () => {
    let fixture: Awaited<ReturnType<typeof openListPageFixture>>;
    const base = 880000;
    const read = (input: object, actor: number | null = 0) =>
      fixture.read("feed.savedPostsPage", { target: "feed", ...input }, actor);
    const save = (postId: number, actor = 0, date = "2026-01-01") =>
      fixture.conn.query(
        "INSERT INTO saved_posts(userId,postId,createdAt) VALUES(?,?,?)",
        [base + actor, postId, date],
      );
    const seed = async (count: number) => {
      for (let index = 0; index < count; index++)
        await save(await fixture.post(index));
    };
    beforeAll(async () => {
      fixture = await openListPageFixture("pagination-saved", base);
    });
    beforeEach(async () => {
      await fixture.reset();
    });
    afterAll(async () => {
      await fixture?.close();
    });
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
    it("requires authentication", async () => {
      expect((await read({}, null)).status).toBe(401);
    });
  },
);
