import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mysql, { type RowDataPacket } from "mysql2/promise";
import { prepareLegacyClubStagingContent } from "../data/legacy-club-import";
import {
  planLegacyClubMerge,
  applyLegacyClubMerge,
  rollbackLegacyClubMerge,
  type LegacyClubPlan,
} from "../data/legacy-club-rehearsal";

export function assertLegacyClubStagingIdentity(identity: {
  schema: string;
  uuid: string;
  version: string;
  tables: number;
  history: number;
}) {
  assert(
    identity.schema === "daryadarcy_candidate_20261019" &&
      identity.uuid === "2a41f961-c168-11f1-8660-0a4124b25f9f" &&
      /^8\.4\./.test(identity.version) &&
      identity.tables === 40 &&
      identity.history === 42,
    "Unverified staging identity",
  );
}

async function main() {
  const [phase] = process.argv.slice(2);
  assert(
    process.argv.length === 3 &&
      ["plan", "apply", "verify", "rollback"].includes(phase),
    "Invalid phase",
  );
  assert(
    process.env.LEGACY_CLUB_APPROVAL === "20261022-draft928-no-notifications",
    "Explicit approved operation required",
  );
  const directory = "/app/legacy-club-live";
  assert(
    (statSync(directory).mode & 0o077) === 0,
    "Private operator directory required",
  );
  const source = prepareLegacyClubStagingContent(
    JSON.parse(readFileSync(`${directory}/source.json`, "utf8")),
  );
  assert(
    source.posts.length === 190 &&
      source.articles.length === 2 &&
      source.media.length === 20,
  );
  assert(
    Date.now() < Date.parse("2026-10-26T07:00:00Z"),
    "Future scheduled post is now overdue; new approval required",
  );
  const uri = process.env.LEGACY_CLUB_DATABASE_URL;
  assert(uri, "Explicit operator connection required");
  const url = new URL(uri);
  assert(
    url.protocol === "mysql:" &&
      url.hostname === "mysql" &&
      url.port === "3306" &&
      url.pathname === "/daryadarcy_candidate_20261019" &&
      !url.search &&
      !url.hash,
    "Unverified staging connection",
  );
  const connection = await mysql.createConnection({
    uri,
    dateStrings: true,
    jsonStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    timezone: "Z",
  });
  try {
    await connection.query("SET SESSION time_zone='+00:00'");
    await connection.query("SET SESSION information_schema_stats_expiry=0");
    const [identities] = await connection.query<RowDataPacket[]>(
      "SELECT DATABASE() AS `schema`,@@server_uuid AS uuid,@@version AS version,(SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()) AS tables,(SELECT COUNT(*) FROM __drizzle_migrations) AS history,@@session.sql_mode AS modes",
    );
    const identity = identities[0];
    assertLegacyClubStagingIdentity({
      schema: identity.schema,
      uuid: identity.uuid,
      version: identity.version,
      tables: Number(identity.tables),
      history: Number(identity.history),
    });
    assert(/(?:^|,)STRICT_(TRANS|ALL)_TABLES(?:,|$)/.test(identity.modes));
    const profile = JSON.parse(
      readFileSync(`${directory}/expected-profile.json`, "utf8"),
    );
    if (phase === "plan") {
      const plan = await planLegacyClubMerge(connection, source);
      assert.equal(
        plan.schemaHash,
        profile.schemaHash,
        "Schema changed since verified backup",
      );
      assert.deepEqual(
        plan.baseline,
        profile.baseline,
        "Data changed since verified backup",
      );
      console.log(JSON.stringify(plan));
    } else {
      const plan: LegacyClubPlan = JSON.parse(
        readFileSync(`${directory}/plan.json`, "utf8"),
      );
      assert.equal(plan.schemaHash, profile.schemaHash);
      assert.deepEqual(plan.baseline, profile.baseline);
      const result =
        phase === "rollback"
          ? await rollbackLegacyClubMerge(connection, source, plan)
          : await applyLegacyClubMerge(connection, source, plan);
      if (phase === "verify")
        assert("replayed" in result && result.replayed, "Import not present");
      console.log(
        JSON.stringify({
          phase,
          ...result,
          overdueDraftTargetId: plan.ids.posts[928],
          notificationsRequested: false,
        }),
      );
    }
  } finally {
    await connection.end();
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch(() => {
    console.error(
      "Guarded Club operator refused or failed; inspect private receipts. Credentials/content withheld.",
    );
    process.exitCode = 1;
  });
