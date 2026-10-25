import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openListPageFixture } from "./helpers/list-page-fixture";

describe.skipIf(!testDatabaseUrl)(
  "bounded post interactions over HTTP/JWT/MySQL",
  () => {
    let fixture: Awaited<ReturnType<typeof openListPageFixture>>;
    const base = 943000;
    const read = (postIds: number[], actor: number | null = 0) =>
      fixture.read("feed.interactionsForPosts", { postIds }, actor);
    beforeAll(async () => {
      fixture = await openListPageFixture("interaction-batch", base);
    });
    beforeEach(async () => {
      await fixture.reset();
    });
    afterAll(async () => {
      await fixture?.close();
    });
    async function mark(id: number, actor = 0) {
      for (const table of ["likes", "saved_posts"])
        await fixture.conn.query(
          `INSERT INTO ${table}(userId,postId) VALUES(?,?)`,
          [base + actor, id],
        );
    }
    it("returns only requested, currently readable marks belonging to the actor", async () => {
      const open = await fixture.post(0),
        closed = await fixture.post(1, "club"),
        draft = await fixture.post(2, "feed", false),
        other = await fixture.post(3);
      for (const id of [open, open, closed, draft, other]) await mark(id);
      await mark(other, 1);
      const result = await read([open, closed, draft, base + 299, open]);
      expect(result.status).toBe(200);
      expect(result.data).toEqual({ likedIds: [open], savedIds: [open] });
      expect((await read([open, other], 1)).data).toEqual({
        likedIds: [other],
        savedIds: [other],
      });
    });
    it("rechecks membership on each batch after a grant is revoked", async () => {
      const id = await fixture.post(0, "club");
      await mark(id);
      await fixture.grant();
      expect((await read([id])).data).toEqual({
        likedIds: [id],
        savedIds: [id],
      });
      await fixture.conn.query(
        "UPDATE club_payments SET expiresAt='2020-01-01' WHERE userId=?",
        [base],
      );
      expect((await read([id])).data).toEqual({ likedIds: [], savedIds: [] });
    });
    it("bounds raw input and refuses guests", async () => {
      expect((await read([], null)).status).toBe(401);
      expect((await read([])).data).toEqual({ likedIds: [], savedIds: [] });
      for (const ids of [
        [0],
        [-1],
        [1.5],
        Array.from({ length: 51 }, (_, i) => i + 1),
      ])
        expect((await read(ids)).status).toBe(400);
    });
  },
);
