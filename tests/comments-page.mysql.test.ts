import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openListPageFixture } from "./helpers/list-page-fixture";

describe.skipIf(!testDatabaseUrl)(
  "comment groups over real HTTP/JWT/disposable MySQL",
  () => {
    let fixture: Awaited<ReturnType<typeof openListPageFixture>>;
    const base = 886000,
      postId = base + 100;
    const read = (input: object = {}, actor: number | null = 0) =>
      fixture.read("club.commentsPage", { postId, ...input }, actor);
    const comment = (
      index: number,
      parentId: number | null = null,
      otherPost = postId,
    ) =>
      fixture.conn.query(
        "INSERT INTO post_comments(id,postId,userId,text,parentId,photos,createdAt) VALUES(?,?,?,'comment',?,JSON_ARRAY(),'2026-01-01')",
        [base + 500 + index, otherPost, base, parentId],
      );
    beforeAll(async () => {
      fixture = await openListPageFixture("pagination-comments", base);
    });
    beforeEach(async () => {
      await fixture.reset();
      await fixture.post(0);
    });
    afterAll(async () => {
      await fixture?.close();
    });
    it.each([0, 20, 21, 50, 51])(
      "pages %i root comments with chronological equal-date tie breaking",
      async (count) => {
        for (let i = 0; i < count; i++) await comment(i);
        let cursor: string | null = null;
        const actual: number[] = [];
        for (let n = 0; n < 4; n++) {
          const result = await read({ cursor });
          expect(result.status).toBe(200);
          expect(result.data.items.length).toBeLessThanOrEqual(20);
          expect(result.data.totalCount).toBe(count);
          actual.push(...result.data.items.map((row) => row.id));
          if (result.data.nextCursor === null) break;
          expect(result.data.nextCursor).not.toBe(cursor);
          cursor = result.data.nextCursor;
        }
        expect(actual).toEqual(
          Array.from({ length: count }, (_, i) => base + 500 + i),
        );
      },
    );
    it("bounds a parent with 51 replies, includes accurate counts and retains grandchildren", async () => {
      await comment(0);
      for (let i = 1; i <= 51; i++) await comment(i, base + 500);
      await comment(52, base + 501);
      const roots = await read();
      expect(roots.status).toBe(200);
      expect(roots.data.items).toHaveLength(1);
      expect(roots.data.items[0]).toMatchObject({
        id: base + 500,
        replyCount: 51,
        parentId: null,
      });
      expect(roots.data.totalCount).toBe(53);
      const first = await read({ parentId: base + 500 });
      expect(first.data.items).toHaveLength(20);
      expect(first.data.nextCursor).toBeTypeOf("string");
      expect(first.data.items[0]).toMatchObject({
        id: base + 501,
        replyCount: 1,
      });
      const second = await read({
        parentId: base + 500,
        cursor: first.data.nextCursor,
      });
      const third = await read({
        parentId: base + 500,
        cursor: second.data.nextCursor,
      });
      expect(third.data.items).toHaveLength(11);
      expect(third.data.nextCursor).toBeNull();
      expect(
        [...first.data.items, ...second.data.items, ...third.data.items].map(
          (row) => row.id,
        ),
      ).toEqual(Array.from({ length: 51 }, (_, i) => base + 501 + i));
      expect(
        (await read({ parentId: base + 501 })).data.items.map((row) => row.id),
      ).toEqual([base + 552]);
    });
    it("keeps author/photo/like fields without loading another parent's replies", async () => {
      await comment(0);
      await comment(1);
      await fixture.conn.query(
        "UPDATE post_comments SET photos=JSON_ARRAY('/api/content-files/synthetic') WHERE id=?",
        [base + 500],
      );
      await fixture.conn.query(
        "INSERT INTO comment_likes(userId,commentId) VALUES(?,?)",
        [base, base + 500],
      );
      const result = await read({ limit: 1 });
      expect(result.status).toBe(200);
      expect(result.data.items[0]).toMatchObject({
        id: base + 500,
        authorName: "Fixture 0",
        authorAvatarUrl: null,
        photos: ["/api/content-files/synthetic"],
        likeCount: 1,
        likedByMe: true,
        replyCount: 0,
      });
    });
    it("retains public-post comments for unpaid users but rechecks club subscription on every page", async () => {
      await comment(0);
      await comment(1);
      expect((await read()).status).toBe(200);
      await fixture.conn.query("UPDATE posts SET target='club' WHERE id=?", [
        postId,
      ]);
      expect((await read()).status).toBe(403);
      await fixture.grant();
      const first = await read({ limit: 1 });
      expect(first.status).toBe(200);
      await fixture.conn.query(
        "UPDATE club_payments SET expiresAt='2020-01-01' WHERE userId=?",
        [base],
      );
      expect((await read({ cursor: first.data.nextCursor })).status).toBe(403);
      expect((await read({}, 2)).status).toBe(200);
    });
    it("does not read missing, unpublished or other-post parents", async () => {
      await fixture.post(1);
      await comment(0, null, postId + 1);
      expect((await read({ parentId: base + 500 })).status).toBe(404);
      expect((await read({ parentId: base + 999 })).status).toBe(404);
      await fixture.conn.query("UPDATE posts SET published=FALSE WHERE id=?", [
        postId,
      ]);
      expect((await read()).status).toBe(404);
      expect((await read({ postId: postId + 99 })).status).toBe(404);
    });
    it("rejects a cursor reused for another parent, post or owner", async () => {
      await comment(0);
      await comment(1);
      await fixture.post(1);
      const first = await read({ limit: 1 });
      expect(first.status).toBe(200);
      for (const [input, actor] of [
        [{ parentId: base + 500 }, 0],
        [{ postId: postId + 1 }, 0],
        [{}, 1],
      ] as const)
        expect(
          (await read({ ...input, cursor: first.data.nextCursor }, actor))
            .status,
        ).toBe(400);
    });
    it("continues after a deleted cursor comment without restarting the group", async () => {
      for (let i = 0; i < 3; i++) await comment(i);
      const first = await read({ limit: 1 });
      expect(first.status).toBe(200);
      await fixture.conn.query("DELETE FROM post_comments WHERE id=?", [
        base + 500,
      ]);
      const next = await read({ cursor: first.data.nextCursor });
      expect(next.data.items.map((row) => row.id)).toEqual([
        base + 501,
        base + 502,
      ]);
      expect(next.data.nextCursor).toBeNull();
    });
    it.each([
      { limit: 0 },
      { limit: 51 },
      { limit: 1.5 },
      { postId: -1 },
      { parentId: 1.5 },
      { cursor: "invalid" },
      { cursor: "x".repeat(1025) },
      { direction: "backward" },
    ])("rejects invalid input %j", async (input) => {
      expect((await read(input)).status).toBe(400);
    });
    it("requires a session even on public posts", async () => {
      expect((await read({}, null)).status).toBe(401);
    });
  },
);
