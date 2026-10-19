import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import {
  candidateIdentityAllowed,
  candidateTargetAllowed,
  inspectFreshInstallManifest,
  inspectMigrationHistory,
} from "./migration-policy";

let phase = "arguments";
async function main() {
  const mode = process.argv[2];
  assert(
    process.argv.length === 3 &&
      ["--initialize-candidate", "--check-api"].includes(mode),
  );
  phase = "manifest";
  const folder = new URL("../../packages/database/drizzle/", import.meta.url);
  const files = new Map(
    await Promise.all(
      (await readdir(folder))
        .filter((name) => name.endsWith(".sql"))
        .map(
          async (name) =>
            [name, await readFile(new URL(name, folder), "utf8")] as const,
        ),
    ),
  );
  const manifest = inspectFreshInstallManifest(
    JSON.parse(await readFile(new URL("meta/_journal.json", folder), "utf8")),
    files,
  );
  assert(manifest.issues.length === 0 && manifest.journal);
  const planHash = createHash("sha256")
    .update(JSON.stringify(manifest.migrations))
    .digest("hex");
  phase = "candidate-target";
  assert(candidateTargetAllowed(process.env, planHash));
  // This operator never inherits application/provider settings or loads .env.
  assert(!process.env.DATABASE_URL);
  for (const [key, value] of Object.entries(process.env))
    assert(
      !value ||
        !/^(S3_|SMTP_|PRODAMUS_|YOOKASSA_|OAUTH_|BUILT_IN_FORGE_|OWNER_|PRIVATE_|CONTENT_RECOVERY_)/.test(
          key,
        ),
    );
  let conn: Connection | undefined;
  let scratch: string | undefined;
  let locked = false;
  try {
    phase = "connect";
    conn = await mysql.createConnection({
      uri: process.env.CANDIDATE_DATABASE_URL!,
      multipleStatements: true,
      timezone: "Z",
      connectTimeout: 10000,
    });
    phase = "identity";
    const [[identity]] = await conn.query<RowDataPacket[]>(
      "SELECT DATABASE() AS name, @@server_uuid AS serverUuid, @@version AS version, @@default_storage_engine AS engine",
    );
    assert(
      candidateIdentityAllowed(
        {
          name: identity.name,
          serverUuid: identity.serverUuid,
          version: identity.version,
          engine: identity.engine,
        },
        process.env.CANDIDATE_SERVER_UUID!,
      ),
    );
    if (mode === "--initialize-candidate") {
      phase = "empty-schema";
      const [[lock]] = await conn.query<RowDataPacket[]>(
        "SELECT GET_LOCK('daryadarcy_candidate_20261019_init',10) AS acquired",
      );
      assert.equal(lock.acquired, 1);
      locked = true;
      for (const [catalog, column] of [
        ["TABLES", "TABLE_SCHEMA"],
        ["ROUTINES", "ROUTINE_SCHEMA"],
        ["EVENTS", "EVENT_SCHEMA"],
        ["TRIGGERS", "TRIGGER_SCHEMA"],
      ]) {
        const [[row]]: [RowDataPacket[], unknown] = await conn.query<
          RowDataPacket[]
        >(
          `SELECT COUNT(*) AS total FROM information_schema.${catalog} WHERE ${column}=DATABASE()`,
        );
        assert.equal(Number(row.total), 0);
      }
      scratch = await mkdtemp(join(tmpdir(), "darcy-candidate-profile-"));
      await mkdir(join(scratch, "meta"));
      await writeFile(
        join(scratch, "meta/_journal.json"),
        JSON.stringify(manifest.journal),
        { mode: 0o600, flag: "wx" },
      );
      for (const [name, sql] of files)
        await writeFile(join(scratch, name), sql, { mode: 0o600, flag: "wx" });
      // Actual Drizzle execution records fresh history; partial DDL is never repaired.
      phase = "migrate";
      await migrate(drizzle(conn), { migrationsFolder: scratch });
    }
    phase = "history";
    const [history] = await conn.query<RowDataPacket[]>(
      "SELECT hash,created_at FROM __drizzle_migrations ORDER BY created_at",
    );
    const inspected = inspectMigrationHistory(
      manifest.migrations,
      history.map((row) => ({ hash: row.hash, created_at: row.created_at })),
    );
    assert.deepEqual(inspected.issues, []);
    assert.deepEqual(inspected.pending, []);
    const result = {
      profile: "server-candidate-only",
      sourceRevision: process.env.CANDIDATE_SOURCE_REVISION,
      planHash,
      migrations: history.length,
      initialized: mode === "--initialize-candidate",
      releaseApproval: false,
    };
    if (mode === "--check-api") await checkApi(conn);
    console.log(
      JSON.stringify({ ...result, apiChecked: mode === "--check-api" }),
    );
  } finally {
    try {
      if (locked && conn)
        await conn.query(
          "SELECT RELEASE_LOCK('daryadarcy_candidate_20261019_init')",
        );
    } finally {
      try {
        await conn?.end();
      } finally {
        if (scratch) await rm(scratch, { recursive: true });
      }
    }
  }
}

async function checkApi(conn: Connection) {
  // Composition-only entrypoint: no index/load-env and no WorkerJobs.start().
  process.env.DATABASE_URL = process.env.CANDIDATE_DATABASE_URL;
  process.env.PUBLIC_APP_URL = "http://127.0.0.1";
  process.env.JWT_SECRET =
    "candidate-probe-only-not-a-working-session-key-20261019";
  const { is, getTableName } = await import("drizzle-orm");
  const { MySqlTable } = await import("drizzle-orm/mysql-core");
  const schema = await import("../../packages/database/src/schema");
  const db = drizzle(conn);
  let ormTables = 0;
  for (const table of Object.values(schema)) {
    if (!is(table, MySqlTable)) continue;
    phase = `orm:${getTableName(table)}`;
    await db.select().from(table).limit(0);
    ormTables++;
  }
  phase = "api-composition";
  const { createBackendApplication } =
    await import("../../apps/backend/src/_core/application");
  const { getDb } = await import("../../apps/backend/src/db");
  const app = await createBackendApplication();
  let httpChecks = 0;
  try {
    await app.listen(0, "127.0.0.1");
    const port = (app.getHttpServer().address() as { port: number }).port;
    for (const [path, status] of [
      ["/api/auth/me", 200],
      ["/api/launch-config", 200],
      ["/api/trpc/feed.list", 200],
      ["/api/trpc/articles.list", 200],
      ["/api/admin/launch-settings", 401],
      ["/api/trpc/admin.stats", 401],
      ["/api/library/materials/recipes/files", 404],
      ["/api/media/content-files/3af23d8c-140f-454b-a123-123456789abc", 404],
    ] as const) {
      phase = `http:${path}`;
      const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      assert.equal(response.status, status, `Candidate HTTP ${path}`);
      if (path === "/api/auth/me")
        assert.equal((await response.json()).user, null);
      if (path === "/api/trpc/feed.list" || path === "/api/trpc/articles.list")
        assert.deepEqual((await response.json()).result.data.json, []);
      httpChecks++;
    }
    const [[users]] = await conn.query<RowDataPacket[]>(
      "SELECT COUNT(*) AS total FROM users",
    );
    assert.equal(Number(users.total), 0);
    console.log(
      JSON.stringify({
        ormTables,
        httpChecks,
        users: 0,
        workersStarted: false,
        providersConfigured: false,
      }),
    );
  } finally {
    await app.close();
    await (
      (await getDb()) as unknown as { $client: { end(): Promise<void> } } | null
    )?.$client.end();
  }
}
main().catch((error: unknown) => {
  console.error(
    "Candidate database operation refused or failed. No existing database is repaired; details withheld.",
  );
  const code =
    error && typeof error === "object" && "code" in error
      ? error.code
      : undefined;
  let compositionError: string | undefined;
  if (phase === "api-composition" && error instanceof Error) {
    compositionError = error.message;
    const uri = process.env.CANDIDATE_DATABASE_URL!;
    for (const value of [uri, new URL(uri).password])
      if (value)
        compositionError = compositionError.replaceAll(value, "[redacted]");
    compositionError = compositionError.slice(0, 1500);
  }
  console.error(
    JSON.stringify({
      phase,
      errorName:
        error instanceof Error && /^[A-Za-z]{1,64}$/.test(error.name)
          ? error.name
          : undefined,
      compositionError,
      code:
        typeof code === "string" && /^[A-Z0-9_]{1,64}$/.test(code)
          ? code
          : undefined,
    }),
  );
  process.exitCode = 1;
});
