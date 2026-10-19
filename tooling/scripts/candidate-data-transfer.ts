// Data-only operator helpers; never imported by the application executable.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type {
  Connection,
  RowDataPacket,
  ResultSetHeader,
} from "mysql2/promise";

export type TransferColumn = {
  table: string;
  name: string;
  type: string;
  nullable: string;
  default: string | null;
  extra: string;
  generation: string;
  collation: string | null;
  ordinal: number;
};
export type TransferTable = { name: string; columns: string[] };
export function transferIdentifier(value: string): string {
  assert.match(value, /^[A-Za-z_][A-Za-z0-9_]*$/);
  return `\`${value}\``;
}
export function transferColumnPlan(
  source: TransferColumn[],
  target: TransferColumn[],
): TransferTable[] {
  assert(source.length > 0);
  for (const columns of [source, target]) {
    assert.equal(
      new Set(columns.map((c) => `${c.table}.${c.name}`)).size,
      columns.length,
    );
    for (const column of columns) {
      transferIdentifier(column.table);
      transferIdentifier(column.name);
      assert(Number.isSafeInteger(column.ordinal) && column.ordinal > 0);
    }
  }
  const tables = [...new Set(source.map((c) => c.table))].sort();
  assert(!tables.includes("__drizzle_migrations"));
  return tables.map((name) => {
    const oldColumns = source
      .filter((c) => c.table === name)
      .sort((a, b) => a.ordinal - b.ordinal);
    const newColumns = target.filter((c) => c.table === name);
    for (const old of oldColumns) {
      const next = newColumns.find((c) => c.name === old.name);
      assert(
        next && next.type === old.type && next.collation === old.collation,
      );
      assert(!old.generation && !next.generation && next.extra === old.extra);
      assert(
        old.nullable === next.nullable ||
          (old.nullable === "NO" && next.nullable === "YES"),
      );
    }
    for (const added of newColumns.filter(
      (c) => !oldColumns.some((old) => old.name === c.name),
    ))
      assert(
        added.nullable === "YES" ||
          added.default !== null ||
          added.generation ||
          added.extra.includes("auto_increment"),
      );
    return { name, columns: oldColumns.map((c) => c.name) };
  });
}

async function dataRows(connection: Connection, query: string) {
  return (await connection.query<RowDataPacket[]>(query))[0];
}
function rowDigest(rows: RowDataPacket[], columns: string[]) {
  const encoded = rows
    .map((row) =>
      JSON.stringify(
        columns.map((name) => {
          const value: unknown = row[name];
          assert(
            value === null ||
              typeof value === "string" ||
              (typeof value === "number" && Number.isFinite(value)) ||
              Buffer.isBuffer(value),
          );
          return Buffer.isBuffer(value)
            ? ["binary", value.toString("base64")]
            : value;
        }),
      ),
    )
    .sort();
  return {
    sha256: createHash("sha256").update(JSON.stringify(encoded)).digest("hex"),
    bytes: Buffer.byteLength(JSON.stringify(encoded)),
  };
}
async function transferColumns(
  connection: Connection,
): Promise<TransferColumn[]> {
  return (await dataRows(
    connection,
    "SELECT TABLE_NAME AS `table`,COLUMN_NAME AS name,COLUMN_TYPE AS type,IS_NULLABLE AS nullable,COLUMN_DEFAULT AS `default`,EXTRA AS extra,GENERATION_EXPRESSION AS generation,COLLATION_NAME AS collation,ORDINAL_POSITION AS ordinal FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME<>'__drizzle_migrations' ORDER BY TABLE_NAME,ORDINAL_POSITION",
  )) as TransferColumn[];
}

/** Caller owns/guards the containers and scoped SQL account. No files or providers. */
export async function copyCandidateData(
  source: Connection,
  target: Connection,
) {
  let phase = "identity",
    sourceTransaction = false,
    targetTransaction = false,
    locked = false;
  try {
    const [old] = await dataRows(
      source,
      "SELECT DATABASE() AS name,@@server_uuid AS uuid,@@version AS version",
    );
    const [next] = await dataRows(
      target,
      "SELECT DATABASE() AS name,@@server_uuid AS uuid,@@version AS version",
    );
    const serverPair =
      old.name === "daryadarcy_staging" &&
      next.name === "daryadarcy_candidate_20261019" &&
      old.uuid === "2a41f961-c168-11f1-8660-0a4124b25f9f" &&
      next.uuid === old.uuid;
    const localPair =
      old.name === "backend_test" &&
      next.name === "backend_test" &&
      old.uuid !== next.uuid;
    assert(serverPair || localPair);
    assert(/^8\.4\./.test(old.version) && /^8\.4\./.test(next.version));
    phase = "read-only-snapshot";
    await source.query("SET SESSION time_zone='+00:00'");
    await target.query("SET SESSION time_zone='+00:00'");
    await source.query("SET SESSION information_schema_stats_expiry=0");
    await target.query("SET SESSION information_schema_stats_expiry=0");
    await source.query(
      "SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ",
    );
    await source.query("SET SESSION TRANSACTION READ ONLY");
    await source.query("START TRANSACTION WITH CONSISTENT SNAPSHOT, READ ONLY");
    sourceTransaction = true;
    const [mode] = await dataRows(target, "SELECT @@session.sql_mode AS modes");
    assert(/(?:^|,)STRICT_(?:TRANS|ALL)_TABLES(?:,|$)/.test(mode.modes));
    const [lock] = await dataRows(
      target,
      "SELECT GET_LOCK('daryadarcy_candidate_data_copy',10) AS acquired",
    );
    assert.equal(Number(lock.acquired), 1);
    locked = true;
    phase = "schema-and-empty-target";
    const catalog =
      "SELECT TABLE_NAME AS name,ENGINE AS engine,AUTO_INCREMENT AS nextId,TABLE_TYPE AS kind FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() ORDER BY TABLE_NAME";
    const oldTables = await dataRows(source, catalog),
      newTables = await dataRows(target, catalog);
    for (const table of [...oldTables, ...newTables]) {
      transferIdentifier(table.name);
      assert.equal(table.engine, "InnoDB");
      assert.equal(table.kind, "BASE TABLE");
    }
    assert(!oldTables.some((t) => t.name === "__drizzle_migrations"));
    if (serverPair) {
      assert.equal(oldTables.length, 29);
      assert.equal(newTables.length, 40);
    }
    for (const table of newTables.filter(
      (t) => t.name !== "__drizzle_migrations",
    ))
      assert.equal(
        Number(
          (
            await dataRows(
              target,
              `SELECT COUNT(*) AS n FROM ${transferIdentifier(table.name)}`,
            )
          )[0].n,
        ),
        0,
      );
    const historyQuery =
      "SELECT id,hash,created_at FROM __drizzle_migrations ORDER BY created_at,id";
    const history = await dataRows(target, historyQuery);
    assert.equal(history.length, 42);
    const plan = transferColumnPlan(
      await transferColumns(source),
      await transferColumns(target),
    );
    assert.equal(plan.length, oldTables.length);
    const snapshot = new Map<string, RowDataPacket[]>();
    const hashes: Record<string, { rows: number; sha256: string }> = {};
    let rows = 0,
      bytes = 0;
    for (const table of plan) {
      phase = `snapshot:${table.name}`;
      const data = await dataRows(
        source,
        `SELECT ${table.columns.map(transferIdentifier).join(",")} FROM ${transferIdentifier(table.name)} LIMIT 10001`,
      );
      rows += data.length;
      const digest = rowDigest(data, table.columns);
      bytes += digest.bytes;
      assert(rows <= 10000 && bytes <= 32 * 1024 * 1024);
      snapshot.set(table.name, data);
      hashes[table.name] = { rows: data.length, sha256: digest.sha256 };
    }
    // Metadata-only candidate DDL precedes the DML transaction: it never commits
    // a partial row copy. A failed copy may leave advanced, never lowered, counters.
    phase = "candidate-counters";
    for (const table of oldTables.filter((t) => t.nextId !== null)) {
      const floor = String(table.nextId),
        current = String(newTables.find((t) => t.name === table.name)?.nextId);
      assert(/^\d+$/.test(floor) && /^\d+$/.test(current));
      if (BigInt(floor) > BigInt(current))
        await target.query(
          `ALTER TABLE ${transferIdentifier(table.name)} AUTO_INCREMENT=${floor}`,
        );
    }
    await target.beginTransaction();
    targetTransaction = true;
    for (const table of plan) {
      phase = `insert:${table.name}`;
      for (const row of snapshot.get(table.name)!) {
        const [inserted] = await target.execute<ResultSetHeader>(
          `INSERT INTO ${transferIdentifier(table.name)} (${table.columns.map(transferIdentifier).join(",")}) VALUES (${table.columns.map(() => "?").join(",")})`,
          table.columns.map((name) => row[name]),
        );
        assert.equal(inserted.affectedRows, 1);
        assert.equal(inserted.warningStatus, 0);
      }
      const copied = await dataRows(
        target,
        `SELECT ${table.columns.map(transferIdentifier).join(",")} FROM ${transferIdentifier(table.name)} LIMIT 10001`,
      );
      assert.equal(copied.length, hashes[table.name].rows);
      assert.equal(
        rowDigest(copied, table.columns).sha256,
        hashes[table.name].sha256,
      );
    }
    phase = "history-and-commit";
    assert.deepEqual(await dataRows(target, historyQuery), history);
    await target.commit();
    targetTransaction = false;
    return {
      tables: plan.length,
      rows,
      bytes,
      hashes,
      historyUnchanged: true,
      sourceReadOnly: true,
    };
  } catch {
    throw new Error(`Candidate data transfer refused or failed (${phase})`);
  } finally {
    // No diagnostics from mysql2: they may embed SQL and source row values.
    const cleanup = await Promise.allSettled([
      ...(targetTransaction ? [target.rollback()] : []),
      ...(sourceTransaction ? [source.rollback()] : []),
      ...(locked
        ? [
            target.query(
              "SELECT RELEASE_LOCK('daryadarcy_candidate_data_copy')",
            ),
          ]
        : []),
    ]);
    if (cleanup.some((result) => result.status === "rejected")) {
      throw new Error(
        "Candidate transfer cleanup failed; inspect target before retrying",
      );
    }
  }
}
