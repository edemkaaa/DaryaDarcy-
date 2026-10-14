import { createHash } from "node:crypto";
import { z } from "zod";

const journalSchema = z.object({
  dialect: z.literal("mysql"),
  entries: z
    .array(
      z.object({
        idx: z.number().int().nonnegative(),
        when: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
        tag: z.string().regex(/^\d{4}_[a-z0-9_]+$/),
        breakpoints: z.boolean(),
      }),
    )
    .min(1),
});
export type MigrationIdentity = { tag: string; when: number; hash: string };
/** Separate NEW-database profile, never a reconciliation of an existing history. */
export function inspectFreshInstallManifest(
  journal: unknown,
  files: ReadonlyMap<string, string>,
) {
  const original = inspectMigrationManifest(journal, files);
  const additions = [
    "0017_consent_text",
    "0018_push_consent_text",
    "0019_comment_likes",
  ];
  const expected = additions.map((tag) => `untracked-file:${tag}.sql`);
  const parsed = journalSchema.safeParse(journal);
  if (
    !parsed.success ||
    original.issues.length !== expected.length ||
    original.issues.some((issue, index) => issue !== expected[index])
  ) {
    return {
      issues: original.issues.length
        ? original.issues
        : ["fresh-install-layout-mismatch"],
      migrations: [] as MigrationIdentity[],
      journal: null,
    };
  }
  const previous = parsed.data.entries.find(
    (row) => row.tag === "0016_platform_features",
  );
  if (!previous)
    return {
      issues: ["fresh-install-layout-mismatch"],
      migrations: [] as MigrationIdentity[],
      journal: null,
    };
  const entries = [
    ...parsed.data.entries,
    ...additions.map((tag, index) => ({
      idx: 0,
      when: previous.when + 1000 * (index + 1),
      tag,
      breakpoints: true,
    })),
  ]
    .sort((a, b) => a.when - b.when)
    .map((row, idx) => ({ ...row, idx }));
  const freshJournal = { dialect: "mysql", entries };
  return {
    ...inspectMigrationManifest(freshJournal, files),
    journal: freshJournal,
  };
}
export function inspectMigrationManifest(
  journal: unknown,
  files: ReadonlyMap<string, string>,
) {
  const parsed = journalSchema.safeParse(journal);
  if (!parsed.success)
    return {
      issues: ["invalid-journal"],
      migrations: [] as MigrationIdentity[],
    };
  const entries = parsed.data.entries;
  const names = new Set(entries.map((entry) => entry.tag));
  if (
    names.size !== entries.length ||
    entries.some(
      (entry, i) =>
        entry.idx !== i || (i > 0 && entry.when <= entries[i - 1].when),
    )
  ) {
    return {
      issues: ["invalid-journal"],
      migrations: [] as MigrationIdentity[],
    };
  }
  const issues: string[] = [];
  const migrations: MigrationIdentity[] = [];
  for (const entry of entries) {
    const name = `${entry.tag}.sql`;
    const sql = files.get(name);
    if (sql === undefined) issues.push(`missing-file:${name}`);
    else if (!sql.trim()) issues.push(`empty-file:${name}`);
    else
      migrations.push({
        tag: entry.tag,
        when: entry.when,
        hash: createHash("sha256").update(sql).digest("hex"),
      });
  }
  for (const name of [...files.keys()].sort()) {
    if (name.endsWith(".sql") && !names.has(name.slice(0, -4)))
      issues.push(`untracked-file:${name}`);
  }
  return { issues, migrations };
}

export function inspectMigrationHistory(
  migrations: readonly MigrationIdentity[],
  rows: readonly { created_at: unknown; hash: unknown }[] | undefined,
) {
  if (rows === undefined)
    return { issues: ["database-history-missing"], pending: [] as string[] };
  if (!rows.length)
    return { issues: ["database-history-empty"], pending: [] as string[] };
  const issues: string[] = [];
  const applied = new Set<number>();
  const byTime = new Map(
    migrations.map((migration) => [migration.when, migration]),
  );
  for (const row of rows) {
    const time = Number(row.created_at);
    if (
      !Number.isSafeInteger(time) ||
      time <= 0 ||
      typeof row.hash !== "string" ||
      !/^[a-f0-9]{64}$/.test(row.hash)
    ) {
      issues.push("invalid-database-history");
      continue;
    }
    if (applied.has(time)) issues.push(`duplicate-database-migration:${time}`);
    applied.add(time);
    const migration = byTime.get(time);
    if (!migration) issues.push(`unknown-database-migration:${time}`);
    else if (row.hash !== migration.hash)
      issues.push(`hash-mismatch:${migration.tag}`);
  }
  const lastApplied = Math.max(...applied);
  for (const migration of migrations) {
    if (migration.when <= lastApplied && !applied.has(migration.when))
      issues.push(`applied-history-gap:${migration.tag}`);
  }
  return {
    issues,
    pending: issues.length
      ? []
      : migrations.filter((m) => !applied.has(m.when)).map((m) => m.tag),
  };
}
