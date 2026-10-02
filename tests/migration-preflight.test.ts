import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { readFile, readdir } from "node:fs/promises";
import { URL, fileURLToPath } from "node:url";
import {
  inspectMigrationHistory,
  inspectMigrationManifest,
} from "../tooling/scripts/migration-policy";

const journal = {
  dialect: "mysql",
  entries: [
    { idx: 0, when: 100, tag: "0000_first", breakpoints: true },
    { idx: 1, when: 200, tag: "0001_second", breakpoints: true },
  ],
};
const files = new Map([
  ["0000_first.sql", "CREATE TABLE example (id INT);\n"],
  ["0001_second.sql", "ALTER TABLE example ADD name TEXT;\n"],
]);

describe("non-mutating migration preflight", () => {
  it("records exact Drizzle-compatible hashes without exposing SQL", () => {
    const report = inspectMigrationManifest(journal, files);
    expect(report.issues).toEqual([]);
    expect(report.migrations[0]).toEqual({
      tag: "0000_first",
      when: 100,
      hash: createHash("sha256")
        .update(files.get("0000_first.sql")!)
        .digest("hex"),
    });
    expect(JSON.stringify(report)).not.toContain("CREATE TABLE");
  });
  it("blocks orphaned SQL rather than silently adding it to the journal", () => {
    const extended = new Map(files).set(
      "0017_untracked.sql",
      "ALTER TABLE example ADD secret TEXT;",
    );
    expect(inspectMigrationManifest(journal, extended).issues).toContain(
      "untracked-file:0017_untracked.sql",
    );
    expect(journal.entries).toHaveLength(2);
  });
  it("blocks missing and empty migration files", () => {
    expect(inspectMigrationManifest(journal, new Map()).issues).toContain(
      "missing-file:0000_first.sql",
    );
    expect(
      inspectMigrationManifest(
        journal,
        new Map(files).set("0000_first.sql", " \n"),
      ).issues,
    ).toContain("empty-file:0000_first.sql");
  });
  it.each([
    { entries: [{ ...journal.entries[0], tag: "../outside" }] },
    { ...journal, entries: [{ ...journal.entries[0], idx: 2 }] },
    {
      ...journal,
      entries: [journal.entries[0], { ...journal.entries[1], when: 100 }],
    },
    {
      ...journal,
      entries: [
        journal.entries[0],
        { ...journal.entries[1], tag: "0000_first" },
      ],
    },
    { dialect: "postgresql", entries: journal.entries },
  ])("rejects malformed or ambiguous journal %#", (value) => {
    expect(inspectMigrationManifest(value, files).issues).toContain(
      "invalid-journal",
    );
  });
  it("accepts only a matching applied prefix and reports pending tags", () => {
    const migrations = inspectMigrationManifest(journal, files).migrations;
    expect(
      inspectMigrationHistory(migrations, [
        { created_at: "100", hash: migrations[0].hash },
      ]),
    ).toEqual({ issues: [], pending: ["0001_second"] });
    expect(
      inspectMigrationHistory(
        migrations,
        migrations.map((m) => ({ created_at: m.when, hash: m.hash })),
      ),
    ).toEqual({ issues: [], pending: [] });
  });
  it("blocks absent history rather than assuming a live database is new", () => {
    const migrations = inspectMigrationManifest(journal, files).migrations;
    expect(inspectMigrationHistory(migrations, undefined).issues).toContain(
      "database-history-missing",
    );
    expect(inspectMigrationHistory(migrations, []).issues).toContain(
      "database-history-empty",
    );
  });
  it("blocks unknown, edited, duplicated and skipped historical migrations", () => {
    const migrations = inspectMigrationManifest(journal, files).migrations;
    expect(
      inspectMigrationHistory(migrations, [
        { created_at: 300, hash: "0".repeat(64) },
      ]).issues,
    ).toContain("unknown-database-migration:300");
    expect(
      inspectMigrationHistory(migrations, [
        { created_at: 100, hash: "0".repeat(64) },
      ]).issues,
    ).toContain("hash-mismatch:0000_first");
    const row = { created_at: 100, hash: migrations[0].hash };
    expect(inspectMigrationHistory(migrations, [row, row]).issues).toContain(
      "duplicate-database-migration:100",
    );
    expect(
      inspectMigrationHistory(migrations, [
        { created_at: 200, hash: migrations[1].hash },
      ]).issues,
    ).toContain("applied-history-gap:0000_first");
  });
  it("recognizes the actual repository gap and hashes the same bytes as Drizzle", async () => {
    const folder = new URL("../packages/database/drizzle/", import.meta.url);
    const actual = JSON.parse(
      await readFile(new URL("meta/_journal.json", folder), "utf8"),
    );
    const source = new Map(
      await Promise.all(
        (await readdir(folder))
          .filter((name) => name.endsWith(".sql"))
          .map(
            async (name) =>
              [name, await readFile(new URL(name, folder), "utf8")] as const,
          ),
      ),
    );
    const report = inspectMigrationManifest(actual, source);
    expect(report.issues).toEqual([
      "untracked-file:0017_consent_text.sql",
      "untracked-file:0018_push_consent_text.sql",
      "untracked-file:0019_comment_likes.sql",
    ]);
    const reference = readMigrationFiles({
      migrationsFolder: fileURLToPath(folder),
    });
    expect(
      report.migrations.map((m) => ({ when: m.when, hash: m.hash })),
    ).toEqual(reference.map((m) => ({ when: m.folderMillis, hash: m.hash })));
  });
});
