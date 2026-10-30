import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openListPageFixture } from "./helpers/list-page-fixture";

describe.skipIf(!testDatabaseUrl)(
  "member pages over real HTTP/JWT/disposable MySQL",
  () => {
    let fixture: Awaited<ReturnType<typeof openListPageFixture>>;
    const base = 883000;
    const read = (input: object = {}, actor: number | null = 2) =>
      fixture.read("admin.membersPage", input, actor);
    const extraIds = Array.from({ length: 51 }, (_, i) => base + 10 + i);
    const seed = async (count: number) => {
      for (const id of extraIds.slice(0, count))
        await fixture.conn.query(
          "INSERT INTO users(id,openId,createdAt,role,passwordHash) VALUES(?,?,'2035-02-01','user','synthetic-not-a-hash')",
          [id, `pagination-members-extra-${id}`],
        );
    };
    beforeAll(async () => {
      fixture = await openListPageFixture("pagination-members", base);
    });
    beforeEach(async () => {
      await fixture.conn.query("DELETE FROM users WHERE id IN (?)", [extraIds]);
      await fixture.reset();
    });
    afterAll(async () => {
      await fixture?.conn.query("DELETE FROM users WHERE id IN (?)", [
        extraIds,
      ]);
      await fixture?.close();
    });
    it.each([0, 20, 21, 50, 51])(
      "pages %i new members without tie-date skips or duplicated accounts",
      async (count) => {
        await seed(count);
        let cursor: string | null = null;
        const actual: number[] = [];
        for (let n = 0; n < 5; n++) {
          const result = await read({ cursor });
          expect(result.status).toBe(200);
          expect(result.data.items.length).toBeLessThanOrEqual(20);
          actual.push(...result.data.items.map((x) => x.id));
          if (result.data.nextCursor === null) break;
          expect(result.data.nextCursor).not.toBe(cursor);
          cursor = result.data.nextCursor;
        }
        expect(actual.filter((id) => extraIds.includes(id))).toEqual(
          extraIds.slice(0, count).reverse(),
        );
        expect(new Set(actual).size).toBe(actual.length);
      },
    );
    it("projects the old safe fields and computes only future paid expiry", async () => {
      await fixture.grant(0);
      await fixture.conn.query(
        "INSERT INTO club_payments(userId,orderId,status,expiresAt) VALUES(?,'pagination-members-expired','paid','2020-01-01'),(?,'pagination-members-failed','failed','2031-01-01'),(?,'pagination-members-paid','paid','2029-01-01')",
        [base, base, base],
      );
      const result = await read({ userId: base });
      expect(result.status).toBe(200);
      expect(result.data.nextCursor).toBeNull();
      expect(result.data.items).toHaveLength(1);
      expect(Object.keys(result.data.items[0]).sort()).toEqual(
        [
          "id",
          "email",
          "contactPhone",
          "name",
          "role",
          "createdAt",
          "blockedAt",
          "blockedReason",
          "clubExpiresAt",
        ].sort(),
      );
      expect(result.data.items[0].clubExpiresAt).toBe(
        "2030-01-01T00:00:00.000Z",
      );
      expect(
        (await read({ userId: base + 1 })).data.items[0].clubExpiresAt,
      ).toBeNull();
      expect((await read({ userId: base + 99 })).data).toEqual({
        items: [],
        nextCursor: null,
      });
    });
    it("honors a 50-member page while retaining its next boundary", async () => {
      await seed(51);
      const first = await read({ limit: 50 });
      expect(first.status).toBe(200);
      expect(first.data.items.map((row) => row.id)).toEqual(
        extraIds.slice(1).reverse(),
      );
      expect(first.data.nextCursor).toBeTypeOf("string");
      expect(
        (await read({ limit: 1, cursor: first.data.nextCursor })).data.items[0]
          .id,
      ).toBe(extraIds[0]);
    });
    it("continues after the cursor account is deleted and new accounts arrive", async () => {
      await seed(3);
      const first = await read({ limit: 1 });
      expect(first.status).toBe(200);
      expect(first.data.items[0].id).toBe(base + 12);
      await fixture.conn.query("DELETE FROM users WHERE id=?", [base + 12]);
      await fixture.conn.query(
        "INSERT INTO users(id,openId,createdAt) VALUES(?,?,'2035-03-01')",
        [base + 13, "pagination-members-arrival"],
      );
      expect(
        (
          await read({ limit: 2, cursor: first.data.nextCursor })
        ).data.items.map((x) => x.id),
      ).toEqual([base + 11, base + 10]);
    });
    it("does not let a new userId filter or different account reuse a page token", async () => {
      const first = await read({ limit: 1 });
      expect(first.status).toBe(200);
      expect(
        (await read({ userId: base, cursor: first.data.nextCursor })).status,
      ).toBe(400);
      await fixture.conn.query("UPDATE users SET role='admin' WHERE id=?", [
        base,
      ]);
      expect((await read({ cursor: first.data.nextCursor }, 0)).status).toBe(
        400,
      );
    });
    it.each([null, 0, 3])("rejects guest/non-admin actor %s", async (actor) => {
      expect((await read({}, actor)).status).toBe(actor === null ? 401 : 403);
    });
    it("checks role revocation between pages", async () => {
      const first = await read({ limit: 1 });
      expect(first.status).toBe(200);
      await fixture.conn.query("UPDATE users SET role='user' WHERE id=?", [
        base + 2,
      ]);
      expect((await read({ cursor: first.data.nextCursor })).status).toBe(403);
    });
    it.each([
      { limit: 0 },
      { limit: 51 },
      { limit: 1.5 },
      { userId: 1.5 },
      { userId: -1 },
      { cursor: "invalid" },
      { cursor: "x".repeat(1025) },
      { direction: "backward" },
      { search: "new feature" },
    ])("rejects invalid input %j", async (input) => {
      expect((await read(input)).status).toBe(400);
    });
  },
);
