import mysql from "mysql2/promise";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, readFile } from "node:fs/promises";
import path from "node:path";
import {
  hashStageTables,
  inspectRehearsalReceipt,
  inspectRestoreProof,
  inspectStageBaseline,
  STAGE_UPGRADE_SQL_HASH,
} from "./staging-baseline-policy";

const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
const lockName = "daryadarcy_staging_baseline_0026";

/** Credentials and restored row digests never leave the protected release directory. */
async function protectedFile(
  directory: string,
  name: string,
  maxBytes: number,
) {
  const dir = await lstat(directory);
  if (
    !dir.isDirectory() ||
    dir.isSymbolicLink() ||
    (dir.mode & 0o077) !== 0 ||
    dir.uid !== process.getuid?.()
  )
    throw new Error("backup directory");
  const handle = await open(
    path.join(directory, name),
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const info = await handle.stat();
    if (
      !info.isFile() ||
      (info.mode & 0o077) !== 0 ||
      info.uid !== process.getuid?.() ||
      info.size < 1 ||
      info.size > maxBytes
    )
      throw new Error("backup file");
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function snapshot(conn: mysql.Connection, includeData: boolean) {
  await conn.query("START TRANSACTION READ ONLY");
  try {
    const [[identity]] = await conn.query<mysql.RowDataPacket[]>(
      "SELECT DATABASE() AS name, @@server_uuid AS serverUuid, @@version AS version",
    );
    if (
      identity.name !== "daryadarcy_staging" ||
      !/^8\.4\./.test(identity.version)
    )
      throw new Error("unexpected server");
    const [tables] = await conn.query<mysql.RowDataPacket[]>({
      sql: "SELECT TABLE_NAME AS name, TABLE_TYPE AS type FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME LIMIT 34",
      timeout: 10000,
    });
    if (tables.length > 33) throw new Error("schema limit");
    const definitions: Array<{ name: string; ddl: string }> = [];
    const data: Array<{ name: string; count: number; hash: string }> = [];
    for (const table of tables) {
      // Identifiers come only from fixed metadata queries, never an argument.
      if (!/^[a-z_]+$/.test(table.name) || table.type !== "BASE TABLE")
        throw new Error("unexpected table");
      const [[row]] = await conn.query<mysql.RowDataPacket[]>({
        sql: `SHOW CREATE TABLE \`${table.name}\``,
        timeout: 10000,
      });
      definitions.push({ name: table.name, ddl: row["Create Table"] });
      if (includeData && table.name !== "billing_checkout_intents") {
        const [rows] = await conn.query<mysql.RowDataPacket[]>({
          sql: `SELECT * FROM \`${table.name}\` LIMIT 10001`,
          timeout: 10000,
        });
        if (rows.length > 10000) throw new Error("rehearsal data limit");
        data.push({
          name: table.name,
          count: rows.length,
          hash: sha256(
            rows
              .map((item) => sha256(JSON.stringify(item)))
              .sort()
              .join("\n"),
          ),
        });
      }
    }
    const [objects] = await conn.query<mysql.RowDataPacket[]>({
      sql: "SELECT 'view' AS kind FROM information_schema.VIEWS WHERE TABLE_SCHEMA=DATABASE() UNION ALL SELECT 'trigger' FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE() UNION ALL SELECT 'routine' FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=DATABASE() UNION ALL SELECT 'event' FROM information_schema.EVENTS WHERE EVENT_SCHEMA=DATABASE()",
      timeout: 10000,
    });
    const checkout = definitions.filter(
      (table) => table.name === "billing_checkout_intents",
    );
    return {
      database: identity.name as string,
      serverUuid: identity.serverUuid as string,
      baseHash: hashStageTables(
        definitions.filter(
          (table) => table.name !== "billing_checkout_intents",
        ),
      ),
      checkoutHash: checkout.length ? hashStageTables(checkout) : null,
      executableObjects: objects.length,
      dataHash: includeData ? sha256(JSON.stringify(data)) : null,
    };
  } finally {
    await conn.rollback();
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (
    args.length > 1 ||
    args.some((arg) => !["--apply", "--rehearse"].includes(arg))
  ) {
    console.error("Unsupported baseline arguments; no database changed.");
    process.exitCode = 1;
    return;
  }
  let uri: URL;
  try {
    uri = new URL(process.env.DATABASE_URL || "");
    if (
      uri.protocol !== "mysql:" ||
      uri.hostname !== "mysql" ||
      uri.pathname !== "/daryadarcy_staging" ||
      (uri.search && uri.search !== "?charset=utf8mb4") ||
      uri.hash ||
      (uri.port && uri.port !== "3306")
    )
      throw new Error("target");
  } catch {
    console.error("Invalid staging database target; no database changed.");
    process.exitCode = 1;
    return;
  }
  const mode =
    args[0] === "--apply"
      ? "apply"
      : args[0] === "--rehearse"
        ? "rehearse"
        : "read-only";
  // Only a named, separately isolated restore container is eligible for rehearsal.
  if (mode === "rehearse") {
    const host = process.env.STAGING_BASELINE_RESTORE_HOST || "";
    if (!/^daryadarcy-yookassa-restore-[A-Za-z0-9]+$/.test(host))
      throw new Error("restore host");
    uri.hostname = host;
  }
  uri.search = "";
  const sql = await readFile(
    new URL(
      "../../packages/database/drizzle/0026_billing_checkout_intents.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const sqlHash = sha256(sql);
  if (sqlHash !== STAGE_UPGRADE_SQL_HASH) throw new Error("SQL mismatch");
  let proof: unknown;
  let rehearsal: unknown;
  let backupHash: string | undefined;
  if (mode !== "read-only") {
    const directory = process.env.STAGING_BASELINE_BACKUP_DIR;
    if (!directory || !path.isAbsolute(directory))
      throw new Error("backup required");
    proof = JSON.parse(
      (await protectedFile(directory, "restore-proof.json", 32768)).toString(
        "utf8",
      ),
    );
    backupHash = sha256(
      await protectedFile(directory, "database.sql.gz", 32 * 1024 * 1024),
    );
    if (mode === "apply")
      rehearsal = JSON.parse(
        (
          await protectedFile(directory, "rehearsal-receipt.json", 32768)
        ).toString("utf8"),
      );
  }
  const conn = await mysql.createConnection({
    uri: uri.toString(),
    charset: "utf8mb4",
    timezone: "Z",
    connectTimeout: 5000,
  });
  let locked = false;
  try {
    if (mode !== "read-only") {
      const [[lock]] = await conn.query<mysql.RowDataPacket[]>(
        "SELECT GET_LOCK(?,0) AS acquired",
        [lockName],
      );
      if (lock.acquired !== 1) throw new Error("upgrade lock unavailable");
      locked = true;
      await conn.query("SET SESSION lock_wait_timeout=10");
    }
    const before = await snapshot(conn, mode === "rehearse");
    let inspection = inspectStageBaseline({ ...before, sqlHash });
    if (inspection.state === "blocked") {
      console.log(
        JSON.stringify({ mode, ...inspection, releaseApproval: false }),
      );
      process.exitCode = 1;
      return;
    }
    if (mode === "read-only") {
      console.log(
        JSON.stringify({
          mode,
          ...inspection,
          baseHash: before.baseHash,
          checkoutHash: before.checkoutHash,
          sqlHash,
          releaseApproval: false,
        }),
      );
      return;
    }
    const issues = inspectRestoreProof(
      proof,
      before.serverUuid,
      backupHash!,
      mode,
      new Date(),
    );
    if (mode === "apply")
      issues.push(...inspectRehearsalReceipt(rehearsal, proof, new Date()));
    if (issues.length) {
      console.log(
        JSON.stringify({
          mode,
          state: "blocked",
          issues,
          releaseApproval: false,
        }),
      );
      process.exitCode = 1;
      return;
    }
    // safeParse above validated this field; compare all original rows only on the copy.
    if (
      mode === "rehearse" &&
      before.dataHash !== (proof as { sourceDataHash: string }).sourceDataHash
    )
      throw new Error("restored data changed");
    const wroteSchema = inspection.state === "pending";
    if (wroteSchema) await conn.query({ sql, timeout: 15000 });
    // CREATE TABLE autocommits in MySQL: do not claim a transactional rollback.
    const after = await snapshot(conn, mode === "rehearse");
    inspection = inspectStageBaseline({ ...after, sqlHash });
    if (
      inspection.state !== "applied" ||
      (mode === "rehearse" && after.dataHash !== before.dataHash)
    )
      throw new Error("upgrade postcondition");
    console.log(
      JSON.stringify({
        version: 1,
        mode,
        ...inspection,
        wroteSchema,
        serverUuid: after.serverUuid,
        baseHash: after.baseHash,
        checkoutHash: after.checkoutHash,
        sqlHash,
        backupHash,
        ...(mode === "rehearse" ? { dataUnchanged: true } : {}),
        verifiedAt: new Date().toISOString(),
        releaseApproval: false,
      }),
    );
  } finally {
    try {
      if (locked) await conn.query("SELECT RELEASE_LOCK(?)", [lockName]);
    } finally {
      await conn.end();
    }
  }
}
void main().catch(() => {
  console.error(
    "Baseline operation failed; schema may have committed. Keep payments disabled and rerun read-only inspection. Details withheld.",
  );
  process.exitCode = 1;
});
