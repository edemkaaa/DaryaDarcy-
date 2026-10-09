import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { readFile } from "node:fs/promises";
import { openTestDatabase, testDatabaseUrl } from "./helpers/backend-mysql";
import {
  inspectEmailIdentityData,
  readEmailIdentityIssues,
} from "../tooling/scripts/email-identity-preflight";

describe.skipIf(!testDatabaseUrl)("email preflight on disposable MySQL", () => {
  let conn: Connection;
  beforeAll(async () => {
    conn = await openTestDatabase();
    // Connection-local legacy data: no changes to the real fixture users.
    await conn.query(
      "CREATE TEMPORARY TABLE users (id INT PRIMARY KEY,email VARCHAR(320))",
    );
  });
  beforeEach(async () => {
    await conn.query("DELETE FROM users");
  });
  afterAll(async () => {
    await conn?.end();
  });
  async function inspect() {
    await conn.query("START TRANSACTION READ ONLY");
    try {
      return await inspectEmailIdentityData(conn);
    } finally {
      await conn.rollback();
    }
  }
  it("accepts multiple absent emails and reports no personal data", async () => {
    await conn.query(
      "INSERT INTO users VALUES (1,NULL),(2,NULL),(3,''),(4,''),(5,'member@example.test')",
    );
    expect(await inspect()).toEqual([]);
  });
  it("rejects normalized duplicates and noncanonical data without changing any row", async () => {
    await conn.query(
      "INSERT INTO users VALUES (1,'member@example.test'),(2,'  MEMBER@EXAMPLE.TEST  ')",
    );
    const [before] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM users ORDER BY id",
    );
    expect(await inspect()).toEqual([
      "email-identity-noncanonical",
      "email-identity-duplicates",
    ]);
    const [after] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM users ORDER BY id",
    );
    expect(after).toEqual(before);
  });
  it("inspects every page, including an incompatible address after row 500", async () => {
    const values = Array.from({ length: 501 }, (_, i) => [
      i + 1,
      i === 500 ? "\tmember@example.test" : null,
    ]);
    await conn.query("INSERT INTO users (id,email) VALUES ?", [values]);
    expect(await inspect()).toEqual(["email-identity-noncanonical"]);
  });
  it("also checks legacy rows with nonpositive IDs", async () => {
    await conn.query("INSERT INTO users VALUES (-1,' MEMBER@EXAMPLE.TEST ') ");
    expect(await inspect()).toEqual(["email-identity-noncanonical"]);
  });
  it("opens a real read-only inspection connection for the canonical fixture", async () => {
    expect(await readEmailIdentityIssues(testDatabaseUrl!)).toEqual([]);
  });
  it("rejects malformed legacy email without rewriting the account", async () => {
    await conn.query("INSERT INTO users VALUES (1,'not-an-email')");
    expect(await inspect()).toEqual(["email-identity-invalid"]);
    const [rows] = await conn.query<RowDataPacket[]>("SELECT * FROM users");
    expect(rows).toEqual([{ id: 1, email: "not-an-email" }]);
  });
});

describe.skipIf(!testDatabaseUrl)(
  "unique email migration on disposable legacy data",
  () => {
    let conn: Connection;
    let migration: string;
    beforeAll(async () => {
      conn = await openTestDatabase();
      // Named table belongs only to this run; exercise the exact migration on
      // legacy data without dropping the canonical fixture's constraint.
      await conn.query(
        "CREATE TABLE email_identity_migration_fixture (id INT PRIMARY KEY,email VARCHAR(320))",
      );
      migration = (
        await readFile(
          new URL(
            "../packages/database/drizzle/0027_user_email_identity.sql",
            import.meta.url,
          ),
          "utf8",
        )
      ).replace("`users`", "`email_identity_migration_fixture`");
    });
    afterAll(async () => {
      if (conn) {
        await conn.query("DROP TABLE email_identity_migration_fixture");
        await conn.end();
      }
    });
    it("fails atomically on duplicates instead of repairing or deleting old accounts", async () => {
      await conn.query(
        "INSERT INTO email_identity_migration_fixture VALUES (1,'member@example.test'),(2,' MEMBER@EXAMPLE.TEST ')",
      );
      const [before] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM email_identity_migration_fixture ORDER BY id",
      );
      await expect(conn.query(migration)).rejects.toMatchObject({
        code: "ER_DUP_ENTRY",
      });
      const [after] = await conn.query<RowDataPacket[]>(
        "SELECT * FROM email_identity_migration_fixture ORDER BY id",
      );
      expect(after).toEqual(before);
      const [indexes] = await conn.query<RowDataPacket[]>(
        "SHOW INDEX FROM email_identity_migration_fixture WHERE Key_name='users_email_identity_unique'",
      );
      expect(indexes).toEqual([]);
    });
  },
);
