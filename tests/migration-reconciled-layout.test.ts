import { readFile, readdir } from "node:fs/promises";
import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  inspectFreshInstallManifest,
  inspectMigrationHistory,
  inspectMigrationManifest,
} from "../tooling/scripts/migration-policy";

it("uses the already accepted fresh identities as the canonical release journal without changing SQL", async () => {
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
  const canonical = inspectMigrationManifest(journal, files);
  expect(canonical.issues).toEqual([]);
  const fresh = inspectFreshInstallManifest(journal, files);
  expect(fresh.issues).toEqual([]);
  expect(canonical.migrations).toEqual(fresh.migrations);
  expect(
    createHash("sha256")
      .update(JSON.stringify(canonical.migrations.slice(0, 42)))
      .digest("hex"),
  ).toBe("51616035e287f221c633d8c7975fef46229d6fbc4ef1e80e586f85e96469684a");
  expect(
    inspectMigrationHistory(
      canonical.migrations,
      fresh.migrations.map((m) => ({ created_at: m.when, hash: m.hash })),
    ),
  ).toEqual({ issues: [], pending: [] });
  expect(
    inspectMigrationHistory(
      canonical.migrations,
      fresh.migrations
        .slice(0, 42)
        .map((m) => ({ created_at: m.when, hash: m.hash })),
    ),
  ).toEqual({
    issues: [],
    pending: ["0042_read_lookup_indexes", "0043_public_photo_uploads", "0044_post_listing_indexes", "0045_profile_revision", "0046_checkout_contact_phone"],
  });
  const oldHole = canonical.migrations.filter((m) => !/^001[789]_/.test(m.tag));
  expect(
    inspectMigrationHistory(
      canonical.migrations,
      oldHole.map((m) => ({ created_at: m.when, hash: m.hash })),
    ).issues,
  ).toContain("applied-history-gap:0017_consent_text");
});
