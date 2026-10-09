import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import mysql from "mysql2/promise";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";

describe.skipIf(!testDatabaseUrl)("identity upsert on disposable MySQL", () => {
  let conn: mysql.Connection;
  let database: typeof import("../apps/backend/src/db");
  beforeAll(async () => {
    conn = await openTestDatabase();
    // Connection-local shadow: unique-email experiments cannot change the
    // shared fixture's indexes, rows or other suites' account data.
    await conn.query("CREATE TEMPORARY TABLE users LIKE users");
    await conn.query(
      "ALTER TABLE users ADD UNIQUE INDEX upsert_fixture_email (email)",
    );
    await conn.query(
      "ALTER TABLE users ADD UNIQUE INDEX upsert_fixture_phone (phone)",
    );
    vi.resetModules();
    vi.stubEnv("DATABASE_URL", testDatabaseUrl!);
    // Retain actual MySQL, transactions and Drizzle. Route this writer to the
    // dedicated connection holding its temporary table, never a working DB.
    vi.spyOn(mysql, "createPool").mockReturnValue(
      conn as unknown as mysql.Pool,
    );
    database = await import("../apps/backend/src/db");
  });
  beforeEach(async () => {
    await conn.query("DELETE FROM users"); // only this connection's temporary table
    await conn.query(`INSERT INTO users
      (id,openId,email,phone,name,passwordHash,sessionVersion,role,lastSignedIn)
      VALUES (41,'owner','occupied@example.test','+79991112233','Owner','OWNER_HASH',7,'user','2026-01-01'),
      (42,'other','other@example.test','+79994445566','Other','OTHER_HASH',3,'moderator','2026-01-02')`);
  });
  afterAll(async () => {
    if (conn) {
      await conn.query("DROP TEMPORARY TABLE IF EXISTS users");
      await conn.end();
    }
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
  async function accounts() {
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT id,openId,email,phone,name,passwordHash,sessionVersion,role,lastSignedIn FROM users ORDER BY id",
    );
    return rows;
  }
  it.each([{ email: "occupied@example.test" }, { phone: "+79991112233" }])(
    "rejects a different openId colliding on $email $phone without changing the owner",
    async (collision) => {
      const before = await accounts();
      const logger = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        await expect(
          database.upsertUser({
            openId: "attacker",
            ...collision,
            name: "Attacker",
            role: "admin",
            passwordHash: "ATTACKER_HASH",
          }),
        ).rejects.toThrow("User identity conflict");
        expect(await accounts()).toEqual(before);
        expect(await database.getUserByOpenId("attacker")).toBeUndefined();
      } finally {
        logger.mockRestore();
      }
    },
  );
  it("rolls back every field when an existing identity attempts an occupied email", async () => {
    const before = await accounts();
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(
        database.upsertUser({
          openId: "other",
          email: "occupied@example.test",
          name: "Changed",
          passwordHash: "CHANGED_HASH",
          role: "admin",
        }),
      ).rejects.toThrow();
      expect(await accounts()).toEqual(before);
    } finally {
      logger.mockRestore();
    }
  });
  it("refreshes the existing identity without resetting its credentials or session version", async () => {
    const before = await accounts();
    const signedIn = new Date("2026-10-10T12:00:00Z");
    await database.upsertUser({ openId: "owner", lastSignedIn: signedIn });
    const after = await accounts();
    expect(after[0]).toEqual({ ...before[0], lastSignedIn: signedIn });
    expect(after[1]).toEqual(before[1]);
  });
  it("creates one identity under sequential retries of the same openId", async () => {
    // Single dedicated connection serializes its wire commands; multi-connection
    // unique-key races remain a separate acceptance gate, not proved here.
    await database.upsertUser({ openId: "fresh", email: "fresh@example.test" });
    await database.upsertUser({ openId: "fresh", name: "Fresh" });
    const fresh = await database.getUserByOpenId("fresh");
    expect(fresh).toMatchObject({
      email: "fresh@example.test",
      name: "Fresh",
      role: "user",
      passwordHash: null,
      sessionVersion: 0,
    });
    expect(await accounts()).toHaveLength(3);
  });
});
