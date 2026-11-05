import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { assertTestDatabase } from "../tooling/scripts/test-database-policy";
import { drizzle } from "drizzle-orm/mysql2";
import { is } from "drizzle-orm";
import { MySqlTable } from "drizzle-orm/mysql-core";
import * as schema from "../packages/database/src/schema";

const uri = process.env.FRESH_DATABASE_URL,
  container = process.env.FRESH_DATABASE_CONTAINER_ID;
const root = fileURLToPath(new URL("../", import.meta.url));
describe.skipIf(!uri || !container)(
  "isolated full fresh install without fixture DDL",
  () => {
    let conn: Connection;
    beforeAll(async () => {
      assertTestDatabase(uri!);
      conn = await mysql.createConnection({ uri: uri!, timezone: "Z" });
    });
    afterAll(async () => {
      await conn?.end();
    });
    async function run(
      mode = "--initialize-empty-local",
      extra: NodeJS.ProcessEnv = {},
    ) {
      return new Promise<{ code: number | null; output: string }>(
        (resolve, reject) => {
          const child = spawn(
            process.execPath,
            ["--import", "tsx", "tooling/scripts/fresh-database.ts", mode],
            {
              cwd: root,
              env: {
                PATH: process.env.PATH,
                FRESH_DATABASE_URL: uri,
                FRESH_DATABASE_CONTAINER_ID: container,
                ...extra,
              },
              timeout: 30000,
            },
          );
          let output = "";
          child.stdout.on("data", (chunk) => (output += chunk));
          child.stderr.on("data", (chunk) => (output += chunk));
          child.on("error", reject);
          child.on("close", (code) => resolve({ code, output }));
        },
      );
    }
    it("refuses a nonempty database without adding migration history", async () => {
      await conn.query("CREATE TABLE fresh_owned_sentinel(id INT PRIMARY KEY)");
      await conn.query("INSERT INTO fresh_owned_sentinel VALUES(7)");
      try {
        const result = await run();
        expect(result.code).toBe(1);
        expect(
          (await conn.query<RowDataPacket[]>("SHOW TABLES"))[0],
        ).toHaveLength(1);
        expect(
          (
            await conn.query<RowDataPacket[]>(
              "SELECT id FROM fresh_owned_sentinel",
            )
          )[0],
        ).toEqual([{ id: 7 }]);
      } finally {
        await conn.query("DROP TABLE fresh_owned_sentinel");
      }
    });
    it("initializes all 52 migrations from an actually empty owned database", async () => {
      expect((await conn.query<RowDataPacket[]>("SHOW TABLES"))[0]).toEqual([]);
      const result = await run();
      expect(result.output).not.toContain("fresh-fixture-only");
      expect(result.code, result.output).toBe(0);
      expect(JSON.parse(result.output)).toMatchObject({
        profile: "fresh-install-local",
        migrations: 52,
        initialized: true,
        releaseApproval: false,
      });
      expect(
        (
          await conn.query<RowDataPacket[]>(
            "SELECT hash,created_at FROM __drizzle_migrations",
          )
        )[0],
      ).toHaveLength(52);
    });
    it("refuses a repeat without changing the initialized schema/history", async () => {
      const [before] = await conn.query<RowDataPacket[]>(
        "SELECT id,hash,created_at FROM __drizzle_migrations ORDER BY id",
      );
      const result = await run();
      expect(result.code).toBe(1);
      expect(
        (
          await conn.query<RowDataPacket[]>(
            "SELECT id,hash,created_at FROM __drizzle_migrations ORDER BY id",
          )
        )[0],
      ).toEqual(before);
    });
    it("verifies installed fresh-profile history read-only", async () => {
      const result = await run("--check-local");
      expect(result.code, result.output).toBe(0);
      expect(JSON.parse(result.output)).toMatchObject({
        profile: "fresh-install-local",
        migrations: 52,
        initialized: false,
        pending: [],
        releaseApproval: false,
      });
    });
    it("backfills distinct UUIDs and preserves publication dates on an existing posts table", async () => {
      const sql = await readFile(new URL("../packages/database/drizzle/0051_post_public_id.sql", import.meta.url), "utf8");
      await conn.query("CREATE TABLE posts_uuid_upgrade_fixture LIKE posts");
      try {
        await conn.query("ALTER TABLE posts_uuid_upgrade_fixture DROP COLUMN publicId");
        await conn.query(`INSERT INTO posts_uuid_upgrade_fixture
          (id,text,photos,tags,createdAt,updatedAt,publishedAt) VALUES
          (1,'first',JSON_ARRAY(),JSON_ARRAY(),'2026-01-01','2026-02-01','2026-03-01'),
          (2,'second',JSON_ARRAY(),JSON_ARRAY(),'2026-01-02','2026-02-02','2026-03-02')`);
        const read = async () => (await conn.query<RowDataPacket[]>(
          "SELECT id,text,createdAt,updatedAt,publishedAt FROM posts_uuid_upgrade_fixture ORDER BY id",
        ))[0];
        const before = await read();
        for (const statement of sql.replaceAll("`posts`", "`posts_uuid_upgrade_fixture`").split("--> statement-breakpoint"))
          await conn.query(statement);
        expect(await read()).toEqual(before);
        await conn.query("INSERT INTO posts_uuid_upgrade_fixture (id,text,photos,tags) VALUES(3,'legacy writer',JSON_ARRAY(),JSON_ARRAY())");
        const [rows] = await conn.query<RowDataPacket[]>(
          "SELECT publicId FROM posts_uuid_upgrade_fixture ORDER BY id",
        );
        const ids = rows.map((row) => row.publicId);
        expect(ids).toHaveLength(3);
        expect(new Set(ids).size).toBe(3);
        for (const id of ids)
          expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        await expect(conn.query("UPDATE posts_uuid_upgrade_fixture SET publicId=? WHERE id=3", [ids[0]]))
          .rejects.toMatchObject({ code: "ER_DUP_ENTRY" });
      } finally {
        await conn.query("DROP TABLE posts_uuid_upgrade_fixture");
      }
    });
    it("reads every current ORM table/column without fixture DDL", async () => {
      const db = drizzle(conn);
      const tables = Object.values(schema).filter((value) =>
        is(value, MySqlTable),
      );
      expect(tables.length).toBeGreaterThan(20);
      for (const table of tables)
        await expect(db.select().from(table).limit(0)).resolves.toEqual([]);
    });
    it("starts the native backend against migrated schema and serves HTTP without seeds", async () => {
      vi.stubEnv("DATABASE_URL", uri!);
      vi.stubEnv("JWT_SECRET", "fresh-local-only-session-secret-32");
      vi.stubEnv("PUBLIC_APP_URL", "http://127.0.0.1");
      const { createBackendApplication } =
        await import("../apps/backend/src/_core/application");
      const { getDb } = await import("../apps/backend/src/db");
      const app = await createBackendApplication();
      try {
        await app.listen(0, "127.0.0.1");
        const address = app.getHttpServer().address() as { port: number };
        const base = `http://127.0.0.1:${address.port}`;
        for (const path of ["feed.list", "articles.list"]) {
          const response = await fetch(`${base}/api/trpc/${path}`);
          expect(response.status).toBe(200);
          expect((await response.json()).result.data.json).toEqual([]);
        }
        expect((await fetch(`${base}/api/admin/launch-settings`)).status).toBe(
          401,
        );
        expect(
          (
            await conn.query<RowDataPacket[]>(
              "SELECT COUNT(*) AS total FROM users",
            )
          )[0][0]?.total,
        ).toBe(0);
      } finally {
        await app.close();
        await (
          (await getDb()) as unknown as { $client: { end(): Promise<void> } }
        )?.$client.end();
        vi.unstubAllEnvs();
      }
    });
    it.each([
      { FRESH_DATABASE_CONTAINER_ID: "0".repeat(64) },
      {
        FRESH_DATABASE_URL:
          "mysql://probe:private-sentinel@192.0.2.1/backend_test",
      },
      { NODE_ENV: "production" },
    ])(
      "rejects unowned/nonlocal/production targets before any mutation %#",
      async (extra) => {
        const result = await run("--initialize-empty-local", extra);
        expect(result.code).toBe(1);
        expect(result.output).not.toMatch(
          /private-sentinel|fresh-fixture-only|192\.0\.2\.1/,
        );
      },
    );
  },
);
