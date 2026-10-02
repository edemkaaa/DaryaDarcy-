import { readFile, readdir } from "node:fs/promises";
import { URL } from "node:url";
import {
  inspectMigrationHistory,
  inspectMigrationManifest,
} from "./migration-policy";
import { readMigrationHistory } from "./migration-history";

async function main() {
  const folder = new URL("../../packages/database/drizzle/", import.meta.url);
  const journal = JSON.parse(
    await readFile(new URL("meta/_journal.json", folder), "utf8"),
  );
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
  const manifest = inspectMigrationManifest(journal, files);
  // Do not implicitly load .env or use the application DATABASE_URL.
  const uri = process.env.MIGRATION_PREFLIGHT_DATABASE_URL;
  const history = uri
    ? inspectMigrationHistory(
        manifest.migrations,
        await readMigrationHistory(uri),
      )
    : undefined;
  const issues = [...manifest.issues, ...(history?.issues ?? [])];
  console.log(
    JSON.stringify(
      {
        mode: "read-only",
        databaseChecked: !!uri,
        issues,
        migrations: manifest.migrations,
        pending: history?.pending ?? null,
        releaseApproval: false,
      },
      null,
      2,
    ),
  );
  process.exitCode = issues.length ? 1 : 0;
}
main().catch(() => {
  console.error(
    "Migration preflight failed; no migrations applied. Check connection and migration files. Details withheld to protect credentials.",
  );
  process.exitCode = 1;
});
