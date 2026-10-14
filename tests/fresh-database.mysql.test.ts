import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
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
    it("initializes all 37 migrations from an actually empty owned database", async () => {
      expect((await conn.query<RowDataPacket[]>("SHOW TABLES"))[0]).toEqual([]);
      const result = await run();
      expect(result.output).not.toContain("fresh-fixture-only");
      expect(result.code, result.output).toBe(0);
      expect(JSON.parse(result.output)).toMatchObject({
        profile: "fresh-install-local",
        migrations: 37,
        initialized: true,
        releaseApproval: false,
      });
      expect(
        (
          await conn.query<RowDataPacket[]>(
            "SELECT hash,created_at FROM __drizzle_migrations",
          )
        )[0],
      ).toHaveLength(37);
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
        migrations: 37,
        initialized: false,
        pending: [],
        releaseApproval: false,
      });
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
