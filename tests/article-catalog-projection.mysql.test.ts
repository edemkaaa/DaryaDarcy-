import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Connection, Pool } from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import { getDb } from "../apps/backend/src/db";
import { ContentReadService } from "../apps/backend/src/content/content-read.service";

describe.skipIf(!testDatabaseUrl)(
  "article catalog uses a card-only SQL projection",
  () => {
    let conn: Connection;
    beforeAll(async () => {
      conn = await openTestDatabase();
      vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
      await conn.query(`CREATE TABLE IF NOT EXISTS articles (
      id INT AUTO_INCREMENT PRIMARY KEY,title VARCHAR(255) NOT NULL,coverUrl TEXT,
      access ENUM('public','club') NOT NULL DEFAULT 'public',published BOOLEAN NOT NULL DEFAULT TRUE,
      sortOrder INT NOT NULL DEFAULT 0,sections JSON NOT NULL,
      createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
      await conn.query("DELETE FROM articles WHERE id IN (99281,99282)");
      await conn.query(
        "INSERT INTO articles(id,title,access,published,sections) VALUES (99281,'Projection card','club',TRUE,JSON_ARRAY(JSON_OBJECT('type','text','text',?))),(99282,'Hidden projection','public',FALSE,JSON_ARRAY())",
        ["PRIVATE_BODY ".repeat(10000)],
      );
    });
    afterAll(async () => {
      await conn?.query("DELETE FROM articles WHERE id IN (99281,99282)");
      await conn?.end();
      const database = await getDb();
      await (database as unknown as { $client: Pool })?.$client.end();
      vi.unstubAllEnvs();
    });
    it("returns the same public cards without fetching the private sections into Node", async () => {
      const database = (await getDb())!;
      const pool = (database as unknown as { $client: Pool }).$client;
      const reads = vi.spyOn(pool, "query");
      try {
        const result = await new ContentReadService().listArticles();
        expect(result.filter((x) => x.id === 99281 || x.id === 99282)).toEqual([
          {
            id: 99281,
            title: "Projection card",
            coverUrl: null,
            access: "club",
          },
        ]);
        const selects = reads.mock.calls
          .map((args) =>
            typeof args[0] === "string"
              ? args[0]
              : (args[0] as { sql: string }).sql,
          )
          .filter((sql) => /select/i.test(sql));
        expect(selects.length).toBeGreaterThan(0);
        for (const sql of selects) expect(sql).not.toMatch(/\bsections\b/i);
      } finally {
        reads.mockRestore();
      }
    });
  },
);
