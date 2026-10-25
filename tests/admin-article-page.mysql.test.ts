import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { testDatabaseUrl } from "./helpers/backend-mysql";
import { openListPageFixture } from "./helpers/list-page-fixture";
import { getDb } from "../apps/backend/src/db";
import type { Pool } from "mysql2/promise";

describe.skipIf(!testDatabaseUrl)(
  "admin article cards/detail over HTTP/JWT/MySQL",
  () => {
    let fixture: Awaited<ReturnType<typeof openListPageFixture>>;
    const base = 944000;
    const read = (input: object = {}, actor: number | null = 2) =>
      fixture.read("admin.articlesPage", input, actor);
    const clear = async () => {
      await fixture.conn.query(
        "DELETE FROM articles WHERE id BETWEEN ? AND ? AND title LIKE 'ARTICLE_PAGE_%'",
        [base + 300, base + 399],
      );
    };
    const article = async (i: number, sortOrder = 0) => {
      await fixture.conn.query(
        "INSERT INTO articles(id,title,access,published,sortOrder,sections,createdAt) VALUES(?,?,'club',FALSE,?,?,'2026-01-01')",
        [
          base + 300 + i,
          `ARTICLE_PAGE_${i}`,
          sortOrder,
          JSON.stringify([{ type: "text", text: "SECRET_BODY_".repeat(1000) }]),
        ],
      );
      return base + 300 + i;
    };
    beforeAll(async () => {
      fixture = await openListPageFixture("article-page", base);
      await fixture.conn.query(`CREATE TABLE IF NOT EXISTS articles (
      id INT AUTO_INCREMENT PRIMARY KEY,title VARCHAR(255) NOT NULL,coverUrl TEXT,
      access ENUM('public','club') NOT NULL DEFAULT 'public',published BOOLEAN NOT NULL DEFAULT TRUE,
      sortOrder INT NOT NULL DEFAULT 0,sections JSON NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB`);
    });
    beforeEach(async () => {
      await clear();
      await fixture.reset();
    });
    afterAll(async () => {
      if (fixture) {
        await clear();
        await fixture.close();
      }
    });
    it("pages 51 equal-date draft cards without reading sections into Node", async () => {
      const ids = [];
      for (let i = 0; i < 51; i++) ids.push(await article(i));
      const pool = ((await getDb()) as unknown as { $client: Pool }).$client;
      const queries = vi.spyOn(pool, "query");
      const found: number[] = [];
      let cursor: string | null = null;
      try {
        do {
          const response = await read({ limit: 20, cursor });
          expect(response.status).toBe(200);
          expect(response.data.items.length).toBeLessThanOrEqual(20);
          expect(JSON.stringify(response.data)).not.toContain("SECRET_BODY_");
          expect(
            response.data.items.every((row) => !Object.hasOwn(row, "sections")),
          ).toBe(true);
          found.push(...response.data.items.map((row) => row.id));
          cursor = response.data.nextCursor;
          expect(found.length).toBeLessThanOrEqual(51);
        } while (cursor);
        expect(found).toEqual(ids.reverse());
        const sql = queries.mock.calls
          .map((args) =>
            typeof args[0] === "string"
              ? args[0]
              : (args[0] as { sql: string }).sql,
          )
          .filter((q) => /from `articles`/i.test(q));
        expect(sql.length).toBe(3);
        for (const query of sql) expect(query).not.toMatch(/\bsections\b/i);
      } finally {
        queries.mockRestore();
      }
    });
    it("keeps sort-order traversal after anchor deletion and a new earlier card", async () => {
      const a = await article(0, 0),
        b = await article(1, 0),
        c = await article(2, 1);
      const first = await read({ limit: 1 });
      expect(first.status).toBe(200);
      expect(first.data.items.map((row) => row.id)).toEqual([b]);
      await fixture.conn.query("DELETE FROM articles WHERE id=?", [b]);
      await article(3, -1);
      const next = await read({ limit: 2, cursor: first.data.nextCursor });
      expect(next.status).toBe(200);
      expect(next.data.items.map((row) => row.id)).toEqual([a, c]);
      expect(next.data.nextCursor).toBe(null);
    });
    it("reads only a selected full draft for admin and rejects other roles/cursors", async () => {
      const id = await article(0);
      const detail = await fixture.read("admin.articleDetail", { id }, 2);
      expect(detail.status).toBe(200);
      expect(detail.data).toMatchObject({
        id,
        sections: [{ type: "text", text: "SECRET_BODY_".repeat(1000) }],
      });
      expect(
        (await fixture.read("admin.articleDetail", { id: base + 399 }, 2)).data,
      ).toBe(null);
      for (const who of [null, 0, 3]) {
        expect((await read({}, who)).status).toBe(who === null ? 401 : 403);
        expect(
          (await fixture.read("admin.articleDetail", { id }, who)).status,
        ).toBe(who === null ? 401 : 403);
      }
      expect((await read({ limit: 51 })).status).toBe(400);
      expect((await read({ cursor: "invalid" })).status).toBe(400);
    });
  },
);
