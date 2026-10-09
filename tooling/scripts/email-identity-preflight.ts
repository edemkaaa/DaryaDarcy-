import mysql, { type Connection } from "mysql2/promise";
import {
  isValidEmail,
  normalizeEmail,
} from "../../apps/backend/src/_core/password";

export async function inspectEmailIdentityData(
  conn: Pick<Connection, "query">,
): Promise<string[]> {
  // Include every signed INT primary key, not just auto-generated positive IDs.
  let cursor = -2147483649;
  let noncanonical = false;
  let invalid = false;
  // Bounded memory, keyset pagination and per-query timeout. Fail closed if the
  // inspection budget is exhausted; never approve a partially inspected table.
  for (let page = 0; ; page++) {
    if (page >= 10000)
      throw new Error("Email identity inspection limit exceeded");
    const [rows] = await conn.query<mysql.RowDataPacket[]>(
      {
        sql: "SELECT id,email FROM users WHERE id>? ORDER BY id LIMIT 500",
        timeout: 10000,
      },
      [cursor],
    );
    if (!rows.length) break;
    for (const row of rows) {
      if (
        !Number.isSafeInteger(row.id) ||
        row.id <= cursor ||
        (row.email !== null && typeof row.email !== "string")
      )
        throw new Error("Invalid email identity row");
      cursor = row.id;
      if (row.email !== null) {
        const normalized = normalizeEmail(row.email);
        if (row.email !== normalized) noncanonical = true;
        if (normalized && !isValidEmail(normalized)) invalid = true;
      }
    }
  }
  // Exactly the new index expression, with the column's existing collation.
  // SQL supplies only a boolean marker, never duplicate addresses/IDs.
  const [duplicates] = await conn.query<mysql.RowDataPacket[]>({
    sql: "SELECT 1 AS conflict FROM users WHERE NULLIF(LOWER(TRIM(email)), '') IS NOT NULL GROUP BY NULLIF(LOWER(TRIM(email)), '') HAVING COUNT(*)>1 LIMIT 1",
    timeout: 10000,
  });
  return [
    ...(noncanonical ? ["email-identity-noncanonical"] : []),
    ...(invalid ? ["email-identity-invalid"] : []),
    ...(duplicates.length ? ["email-identity-duplicates"] : []),
  ];
}

/** Never load application .env files or repair identities during inspection. */
export async function readEmailIdentityIssues(uri: string) {
  const url = new URL(uri);
  if (url.protocol !== "mysql:" || !url.pathname || url.pathname === "/")
    throw new Error("Invalid preflight connection");
  const conn = await mysql.createConnection({ uri, connectTimeout: 5000 });
  try {
    await conn.query("START TRANSACTION READ ONLY");
    return await inspectEmailIdentityData(conn);
  } finally {
    try {
      await conn.rollback();
    } finally {
      await conn.end();
    }
  }
}
