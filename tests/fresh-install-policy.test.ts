/** Канонический/fresh migration manifest проверяется по локальным SQL, без применения к БД. */
import { describe, expect, it } from "vitest";
import { readFile, readdir } from "node:fs/promises";
import * as policy from "../tooling/scripts/migration-policy";

/** Читаем настоящий journal и полный набор SQL файлов в map, не изменяя их. */
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
/** Проверяем текущие 52 шага и распознавание известной исторической дырки отдельно от неизвестных orphan-файлов. */
describe("separate fresh-install migration manifest", () => {
  /** Вызываем проверяемую политику fresh-install с переданными копиями входа. */
  async function fresh(journal: unknown, files: Map<string, string>) {
    return policy.inspectFreshInstallManifest(journal, files);
  }
  /** Fresh сохраняет hash/when/tag канонических шагов и не мутирует journal; прежний неполный layout распознаётся явно. */
  it("keeps the canonical release/fresh identities and can still recognize the historical layout", async () => {
    const { journal, files } = await source();
    const before = JSON.stringify(journal);
    const result = await fresh(journal, files);
    expect(result.issues).toEqual([]);
    expect(result.migrations).toHaveLength(52);
    expect(result.migrations.at(-1)?.tag).toBe("0051_post_public_id");
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
  /** Непросмотренный SQL не включается в план только потому, что лежит рядом. */
  it("refuses an unknown orphan instead of silently applying it", async () => {
    const { journal, files } = await source();
    files.set("0036_unreviewed.sql", "DROP TABLE users;");
    expect((await fresh(journal, files)).issues).toContain(
      "untracked-file:0036_unreviewed.sql",
    );
  });
  /** Отсутствующий файл обязательного шага блокирует fresh-план. */
  it("refuses a missing fresh migration", async () => {
    const { journal, files } = await source();
    files.delete("0018_push_consent_text.sql");
    expect((await fresh(journal, files)).issues.length).toBeGreaterThan(0);
  });
});
