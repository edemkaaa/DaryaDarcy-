import { readFile, readdir } from "node:fs/promises";
import { URL } from "node:url";
import {
  inspectMigrationHistory,
  inspectMigrationManifest,
} from "./migration-policy";
import { readMigrationHistory } from "./migration-history";
import { readEmailIdentityIssues } from "./email-identity-preflight";

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || args.some((arg) => arg !== "--require-database")) {
    console.error(
      "Unsupported preflight arguments; no database checked or changed.",
    );
    process.exitCode = 1;
    return;
  }
  const requireDatabase = args.includes("--require-database");
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
  // Normal diagnostics never use application credentials. The apply gate must
  // inspect exactly the DATABASE_URL that the following Drizzle command uses.
  // Neither mode loads .env, creates history or repairs the journal.
  const inspectionUri = process.env.MIGRATION_PREFLIGHT_DATABASE_URL;
  const uri = requireDatabase ? process.env.DATABASE_URL : inspectionUri;
  const issues = [...manifest.issues];
  if (requireDatabase && !uri?.trim())
    issues.push("database-connection-required");
  if (requireDatabase && inspectionUri && inspectionUri !== uri)
    issues.push("database-connection-mismatch");

  let databaseChecked = false;
  let pending: string[] | null = null;
  // Fail before opening any connection if file/configuration checks fail.
  if (!issues.length && uri) {
    const history = inspectMigrationHistory(
      manifest.migrations,
      await readMigrationHistory(uri),
    );
    databaseChecked = true;
    issues.push(...history.issues);
    pending = history.pending;
    if (!issues.length && pending.includes("0027_user_email_identity"))
      issues.push(...(await readEmailIdentityIssues(uri)));
  }
  console.log(
    JSON.stringify(
      {
        mode: "read-only",
        databaseChecked,
        issues,
        migrations: manifest.migrations,
        pending,
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
