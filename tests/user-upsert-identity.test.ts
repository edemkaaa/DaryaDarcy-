import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const transport = vi.hoisted(() => ({
  query: vi.fn(),
  owner: null as number | null,
  failure: null as Error | null,
  statements: [] as { sql: string; params: unknown[] }[],
}));
vi.mock("mysql2/promise", () => ({
  default: { createPool: () => ({ on() {}, query: transport.query }) },
}));

// Only the external SQL transport is doubled. These assertions protect our
// emitted identity-write contract; actual constraint/locking acceptance is
// covered separately by user-upsert-identity.mysql.test.ts.
let database: typeof import("../apps/backend/src/db");
beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", "mysql://fixture@127.0.0.1:33317/backend_test");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  transport.owner = 41;
  transport.failure = null;
  transport.statements = [];
  transport.query
    .mockReset()
    .mockImplementation(
      async ({ sql }: { sql: string }, params: unknown[] = []) => {
        transport.statements.push({ sql, params });
        if (sql.startsWith("select"))
          return [transport.owner === null ? [] : [[transport.owner]], []];
        if (sql.startsWith("update") && transport.failure)
          throw transport.failure;
        return [{ affectedRows: 1, insertId: 41 }, []];
      },
    );
  database = await import("../apps/backend/src/db");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("identity-scoped user upsert SQL boundary", () => {
  it("rejects another identity's unique-key collision without sending a credential update", async () => {
    transport.owner = null;
    await expect(
      database.upsertUser({
        openId: "new-identity",
        email: "occupied@example.test",
        passwordHash: "ATTACKER_HASH",
        role: "admin",
      }),
    ).rejects.toThrow("User identity conflict");
    const insert = transport.statements.find(({ sql }) =>
      sql.startsWith("insert"),
    )!;
    expect(insert.sql.split("on duplicate key update ")[1]).toBe(
      "`openId` = `users`.`openId`",
    );
    expect(
      transport.statements.filter(({ sql }) => sql.startsWith("update")),
    ).toEqual([]);
    expect(transport.statements.at(-1)?.sql).toBe("rollback");
  });

  it("updates only the locked account for the requested openId, retaining explicit nulls", async () => {
    const signedIn = new Date("2026-10-10T12:00:00Z");
    await database.upsertUser({
      openId: "existing-identity",
      name: null,
      email: "member@example.test",
      passwordHash: "MEMBER_HASH",
      role: "user",
      lastSignedIn: signedIn,
    });
    const lookup = transport.statements.find(({ sql }) =>
      sql.startsWith("select"),
    )!;
    expect(lookup).toBeDefined();
    expect(lookup.sql).toBe(
      "select `id` from `users` where `users`.`openId` = ? limit ? for update",
    );
    expect(lookup.params).toEqual(["existing-identity", 1]);
    const write = transport.statements.find(({ sql }) =>
      sql.startsWith("update"),
    )!;
    expect(write).toBeDefined();
    expect(write.sql).toBe(
      "update `users` set `name` = ?, `email` = ?, `passwordHash` = ?, `profileRevision` = `users`.`profileRevision`+1, `role` = ?, `lastSignedIn` = ? where `users`.`id` = ?",
    );
    expect(write.params).toEqual([
      null,
      "member@example.test",
      "MEMBER_HASH",
      "user",
      "2026-10-10 12:00:00.000",
      41,
    ]);
    expect(transport.statements.at(-1)?.sql).toBe("commit");
  });

  it("rolls back a credential update rejected by another unique constraint", async () => {
    transport.failure = new Error("PRIVATE_SQL_FAILURE");
    await expect(
      database.upsertUser({
        openId: "existing-identity",
        email: "occupied@example.test",
        passwordHash: "PRIVATE_HASH",
      }),
    ).rejects.toThrow();
    expect(transport.statements.at(-1)?.sql).toBe("rollback");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(
      /PRIVATE_SQL_FAILURE|occupied@example|PRIVATE_HASH/,
    );
  });

  it("creates an identity with defaults and refreshes login without resetting absent fields", async () => {
    await database.upsertUser({ openId: "new-identity" });
    const insert = transport.statements.find(({ sql }) =>
      sql.startsWith("insert"),
    )!;
    expect(insert.params[0]).toBe("new-identity");
    const write = transport.statements.find(({ sql }) =>
      sql.startsWith("update"),
    )!;
    expect(write).toBeDefined();
    expect(write.sql).toBe(
      "update `users` set `lastSignedIn` = ? where `users`.`id` = ?",
    );
    expect(write.params.at(-1)).toBe(41);
  });

  it("keeps the absent-database contract without emitting a write", async () => {
    vi.stubEnv("DATABASE_URL", "");
    await expect(
      database.upsertUser({ openId: "identity" }),
    ).resolves.toBeUndefined();
    expect(transport.statements).toEqual([]);
  });
});
