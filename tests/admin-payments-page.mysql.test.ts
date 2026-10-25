import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openListPageFixture } from "./helpers/list-page-fixture";

describe.skipIf(!testDatabaseUrl)(
  "payment history over real HTTP/JWT/disposable MySQL",
  () => {
    let fixture: Awaited<ReturnType<typeof openListPageFixture>>;
    const base = 941000;
    const read = (input: object = {}, actor: number | null = 2) =>
      fixture.read("admin.paymentsPage", input, actor);
    async function payment(index: number, at = "2026-01-01") {
      const [result] = await fixture.conn.query<
        import("mysql2").ResultSetHeader
      >(
        "INSERT INTO club_payments(userId,orderId,status,sum,createdAt) VALUES(?,?,'pending','790.00',?)",
        [base, `page-payments-${index}`, at],
      );
      return result.insertId;
    }
    beforeAll(async () => {
      fixture = await openListPageFixture("page-payments", base);
    });
    beforeEach(async () => {
      await fixture.reset();
    });
    afterAll(async () => {
      await fixture?.close();
    });
    it.each([0, 20, 51, 65])(
      "reads all %i equal-time payments once without the old 50-row ceiling",
      async (count) => {
        const ids = [];
        for (let i = 0; i < count; i++) ids.push(await payment(i));
        let cursor: string | null = null;
        const found: number[] = [];
        do {
          const response = await read({ limit: 20, cursor });
          expect(response.status).toBe(200);
          expect(response.data.items.length).toBeLessThanOrEqual(20);
          found.push(...response.data.items.map((row) => row.id));
          cursor = response.data.nextCursor;
          expect(found.length).toBeLessThanOrEqual(count);
        } while (cursor);
        expect(found).toEqual(ids.reverse());
      },
    );
    it("continues after deletion of the anchor and a newer payment arriving", async () => {
      const ids = [await payment(0), await payment(1), await payment(2)];
      const first = await read({ limit: 1 });
      expect(first.status).toBe(200);
      expect(first.data.items.map((row) => row.id)).toEqual([ids[2]]);
      await fixture.conn.query(
        "DELETE FROM club_payments WHERE id=? AND userId=?",
        [ids[2], base],
      );
      await payment(3, "2026-02-01");
      const next = await read({ limit: 2, cursor: first.data.nextCursor });
      expect(next.status).toBe(200);
      expect(next.data.items.map((row) => row.id)).toEqual([ids[1], ids[0]]);
      expect(next.data.nextCursor).toBe(null);
    });
    it("enforces the 50 limit and admin-scoped cursor without changing payments", async () => {
      const ids = [];
      for (let i = 0; i < 51; i++) ids.push(await payment(i));
      const first = await read({ limit: 50 });
      expect(first.status).toBe(200);
      expect(first.data.items).toHaveLength(50);
      const last = await read({ limit: 50, cursor: first.data.nextCursor });
      expect(last.status).toBe(200);
      expect(last.data.items.map((row) => row.id)).toEqual([ids[0]]);
      expect(last.data.nextCursor).toBe(null);
      for (const who of [null, 0, 3])
        expect((await read({}, who)).status).toBe(who === null ? 401 : 403);
      await fixture.conn.query("UPDATE users SET role='admin' WHERE id=?", [
        base + 3,
      ]);
      expect((await read({ cursor: first.data.nextCursor }, 3)).status).toBe(
        400,
      );
      expect((await read({ cursor: "malformed" })).status).toBe(400);
      expect((await read({ limit: 51 })).status).toBe(400);
      const [rows] = await fixture.conn.query<import("mysql2").RowDataPacket[]>(
        "SELECT COUNT(*) AS n,MIN(status) AS status,MIN(sum) AS amount FROM club_payments WHERE userId=?",
        [base],
      );
      expect(rows).toEqual([{ n: 51, status: "pending", amount: "790.00" }]);
    });
  },
);
