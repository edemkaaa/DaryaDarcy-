// Создаёт или проверяет схему только на точно определённой пустой локальной БД. Рабочее подключение не подставляется вместо одноразового по умолчанию.
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  writeFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import {
  inspectFreshInstallManifest,
  inspectMigrationHistory,
} from "./migration-policy";

async function main() {
  // Проверяет пустой локальный tmpfs-контейнер и целевой URL, применяет доверенный fresh-профиль и сверяет историю; частично выполненный DDL не чинится повтором.

  const args = process.argv.slice(2);
  if (
    args.length !== 1 ||
    !["--plan", "--initialize-empty-local", "--check-local"].includes(
      args[0]!,
    ) ||
    process.env.NODE_ENV === "production"
  )
    throw new Error("Invalid mode");
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
  if (manifest.issues.length || !manifest.journal)
    throw new Error("Invalid fresh profile");
  // A source fingerprint is not target validation or permission to apply SQL.
  if (args[0] === "--plan") {
    console.log(
      JSON.stringify({
        profile: "fresh-install-plan",
        migrations: manifest.migrations,
        planHash: createHash("sha256")
          .update(JSON.stringify(manifest.migrations))
          .digest("hex"),
        databaseChecked: false,
        initialized: false,
        releaseApproval: false,
      }),
    );
    return;
  }
  const uri = process.env.FRESH_DATABASE_URL;
  const id = process.env.FRESH_DATABASE_CONTAINER_ID;
  if (!uri || !id || !/^[a-f0-9]{64}$/.test(id))
    throw new Error("Explicit fixture required");
  const url = new URL(uri);
  if (
    url.protocol !== "mysql:" ||
    url.hostname !== "127.0.0.1" ||
    url.pathname !== "/backend_test" ||
    !url.port ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid fixture target");
  // Inspect only ownership/storage/network metadata, never Docker environment secrets.
  const { stdout } = await promisify(execFile)(
    "docker",
    [
      "inspect",
      id,
      "--format",
      '{"id":{{json .Id}},"name":{{json .Name}},"owner":{{json (index .Config.Labels "codex.owner")}},"ports":{{json .NetworkSettings.Ports}},"tmpfs":{{json .HostConfig.Tmpfs}},"mounts":{{json .Mounts}}}',
    ],
    { timeout: 10000 },
  );
  const fixture = JSON.parse(stdout);
  const bindings = fixture.ports?.["3306/tcp"];
  if (
    fixture.id !== id ||
    !/^daryadarcy-fresh-[a-z0-9-]+$/.test(fixture.owner) ||
    fixture.name !== `/${fixture.owner}` ||
    !fixture.tmpfs?.["/var/lib/mysql"] ||
    fixture.mounts?.length !== 0 ||
    bindings?.length !== 1 ||
    bindings[0].HostIp !== "127.0.0.1" ||
    bindings[0].HostPort !== url.port
  )
    throw new Error("Unowned fixture");
  let conn: Connection | undefined;
  let scratch: string | undefined;
  let locked = false;
  try {
    // Multiple statements are limited to this trusted, hash-checked SQL installer.
    conn = await mysql.createConnection({
      uri,
      multipleStatements: true,
      timezone: "Z",
      connectTimeout: 10000,
    });
    const [lock] = await conn.query<RowDataPacket[]>(
      "SELECT GET_LOCK('daryadarcy_fresh_install', 10) AS acquired",
    );
    if (lock[0]?.acquired !== 1) throw new Error("Installer busy");
    locked = true;
    const initialized = args[0] === "--initialize-empty-local";
    if (initialized) {
      for (const catalog of ["TABLES", "ROUTINES", "EVENTS", "TRIGGERS"]) {
        const column =
          catalog === "TABLES"
            ? "TABLE_SCHEMA"
            : catalog === "ROUTINES"
              ? "ROUTINE_SCHEMA"
              : catalog === "EVENTS"
                ? "EVENT_SCHEMA"
                : "TRIGGER_SCHEMA";
        const [rows] = await conn.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS total FROM information_schema.${catalog} WHERE ${column} = DATABASE()`,
        );
        if (Number(rows[0]?.total) !== 0) throw new Error("Database not empty");
      }
      scratch = await mkdtemp(join(tmpdir(), "daryadarcy-fresh-profile-"));
      await mkdir(join(scratch, "meta"));
      await writeFile(
        join(scratch, "meta/_journal.json"),
        JSON.stringify(manifest.journal),
        { mode: 0o600, flag: "wx" },
      );
      for (const [name, sql] of files)
        await writeFile(join(scratch, name), sql, { mode: 0o600, flag: "wx" });
      // MySQL DDL cannot be rolled back as a whole. Any partial failure leaves a
      // nonempty fixture and is deliberately refused on retry, never repaired.
      await migrate(drizzle(conn), { migrationsFolder: scratch });
    }
    const [history] = await conn.query<RowDataPacket[]>(
      "SELECT hash, created_at FROM __drizzle_migrations ORDER BY created_at",
    );
    const inspected = inspectMigrationHistory(
      manifest.migrations,
      history.map((row) => ({ hash: row.hash, created_at: row.created_at })),
    );
    if (inspected.issues.length || inspected.pending.length)
      throw new Error("Incomplete history");
    console.log(
      JSON.stringify({
        profile: "fresh-install-local",
        migrations: manifest.migrations.length,
        initialized,
        pending: inspected.pending,
        releaseApproval: false,
      }),
    );
  } finally {
    try {
      if (locked && conn)
        await conn.query("SELECT RELEASE_LOCK('daryadarcy_fresh_install')");
    } finally {
      try {
        await conn?.end();
      } finally {
        if (scratch) await rm(scratch, { recursive: true });
      }
    }
  }
}
main().catch(() => {
  console.error(
    "Fresh local database operation refused or failed. No existing database is repaired; inspect the owned fixture before retrying. Details withheld to protect credentials.",
  );
  process.exitCode = 1;
});
