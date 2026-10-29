import { describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import * as policy from "../tooling/scripts/migration-policy";

async function source() {
  const folder = new URL("../packages/database/drizzle/", import.meta.url);
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
  return { journal, files };
}
describe("separate fresh-install migration manifest", () => {
  async function fresh(journal: unknown, files: Map<string, string>) {
    return policy.inspectFreshInstallManifest(journal, files);
  }
  it("keeps the canonical release/fresh identities and can still recognize the historical layout", async () => {
    const { journal, files } = await source();
    const before = JSON.stringify(journal);
    const result = await fresh(journal, files);
    expect(result.issues).toEqual([]);
    expect(result.migrations).toHaveLength(48);
    expect(result.migrations.at(-1)?.tag).toBe("0047_user_contact_phone");
    expect(result.migrations.slice(17, 20).map((row) => row.tag)).toEqual([
      "0017_consent_text",
      "0018_push_consent_text",
      "0019_comment_likes",
    ]);
    expect(JSON.stringify(journal)).toBe(before);
    expect(policy.inspectMigrationManifest(journal, files).issues).toEqual([]);
    const legacy = { ...journal, entries: journal.entries.filter((row: {tag:string}) => !/^001[789]_/.test(row.tag)).map((row: object, idx: number) => ({ ...row, idx })) };
    expect(policy.inspectMigrationManifest(legacy, files).issues).toEqual([
      "untracked-file:0017_consent_text.sql",
      "untracked-file:0018_push_consent_text.sql",
      "untracked-file:0019_comment_likes.sql",
    ]);
    expect(policy.inspectFreshInstallManifest(legacy, files).migrations).toEqual(result.migrations);
    const baseline = policy.inspectMigrationManifest(journal, files).migrations;
    for (const row of baseline)
      expect(result.migrations.find((f) => f.tag === row.tag)).toEqual(row);
  });
  it("refuses an unknown orphan instead of silently applying it", async () => {
    const { journal, files } = await source();
    files.set("0036_unreviewed.sql", "DROP TABLE users;");
    expect((await fresh(journal, files)).issues).toContain(
      "untracked-file:0036_unreviewed.sql",
    );
  });
  it("refuses a missing fresh migration", async () => {
    const { journal, files } = await source();
    files.delete("0018_push_consent_text.sql");
    expect((await fresh(journal, files)).issues.length).toBeGreaterThan(0);
  });
});
