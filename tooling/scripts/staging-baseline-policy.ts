// Проверяет доказательства резервирования, репетиции и исходной схемы перед историческим baseline-переходом. Контрольные суммы не заменяются предположением по имени БД.
import { createHash } from "node:crypto";
import { z } from "zod";

export type StageBaselineSnapshot = {
  database: string;
  baseHash: string;
  sqlHash: string;
  checkoutHash: string | null;
  executableObjects: number;
};

export const STAGE_BASELINE_HASH =
  "ab07104f1ea2fa3377588df1cca7db22a3fdb7f1466e66f547143f3b5e9fc3ac";
export const STAGE_UPGRADE_SQL_HASH =
  "96196ec383cd2ce7a33882fc338d77512f5c32d6081646dd2fb1f9a191ba232b";
export const STAGE_CHECKOUT_HASH =
  "da894d0b5fd978061571f63803f676cc3ba6424480db588dda501e96633de914";

export function hashStageTables(
  tables: Array<{ name: string; ddl: string }>,
): string {
  const normalized = tables
    .map(({ name, ddl }) => ({
      name,
      ddl: ddl.replace(/ AUTO_INCREMENT=\d+(?= DEFAULT CHARSET=)/g, ""),
    }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

const digest = z.string().regex(/^[a-f0-9]{64}$/);
const restoreProof = z.object({
  version: z.literal(1),
  database: z.literal("daryadarcy_staging"),
  sourceServerUuid: z.uuid(),
  restoredServerUuid: z.uuid(),
  sourceSchemaHash: digest,
  restoredSchemaHash: digest,
  sourceDataHash: digest,
  restoredDataHash: digest,
  backupHash: digest,
  verifiedAt: z.iso.datetime(),
  tables: z.literal(28),
  rows: z.number().int().nonnegative(),
  autoIncrementPreserved: z.literal(true),
});

export function inspectRestoreProof(
  input: unknown,
  serverUuid: string,
  backupHash: string,
  mode: "apply" | "rehearse",
  now: Date,
): string[] {
  const parsed = restoreProof.safeParse(input);
  if (!parsed.success) return ["invalid-backup-proof"];
  const proof = parsed.data;
  const issues: string[] = [];
  if (
    serverUuid !==
    (mode === "apply" ? proof.sourceServerUuid : proof.restoredServerUuid)
  )
    issues.push("backup-target-mismatch");
  if (proof.sourceServerUuid === proof.restoredServerUuid)
    issues.push("backup-not-independent");
  if (
    proof.sourceSchemaHash !== STAGE_BASELINE_HASH ||
    proof.restoredSchemaHash !== STAGE_BASELINE_HASH
  )
    issues.push("backup-schema-mismatch");
  if (proof.sourceDataHash !== proof.restoredDataHash)
    issues.push("backup-data-mismatch");
  if (proof.backupHash !== backupHash) issues.push("backup-file-mismatch");
  const age = now.getTime() - Date.parse(proof.verifiedAt);
  if (!Number.isFinite(age) || age < 0 || age > 6 * 60 * 60 * 1000)
    issues.push("backup-proof-expired");
  return issues;
}

const rehearsalReceipt = z.object({
  version: z.literal(1),
  mode: z.literal("rehearse"),
  state: z.literal("applied"),
  serverUuid: z.uuid(),
  baseHash: digest,
  checkoutHash: digest,
  sqlHash: digest,
  backupHash: digest,
  dataUnchanged: z.literal(true),
  verifiedAt: z.iso.datetime(),
});

export function inspectRehearsalReceipt(
  input: unknown,
  proofInput: unknown,
  now: Date,
): string[] {
  const parsed = rehearsalReceipt.safeParse(input);
  const parsedProof = restoreProof.safeParse(proofInput);
  if (!parsed.success || !parsedProof.success)
    return ["invalid-upgrade-rehearsal"];
  const receipt = parsed.data;
  const proof = parsedProof.data;
  if (
    inspectRestoreProof(
      proof,
      proof.sourceServerUuid,
      proof.backupHash,
      "apply",
      now,
    ).length
  )
    return ["invalid-upgrade-rehearsal"];
  const age = now.getTime() - Date.parse(receipt.verifiedAt);
  if (
    receipt.serverUuid !== proof.restoredServerUuid ||
    receipt.baseHash !== STAGE_BASELINE_HASH ||
    receipt.checkoutHash !== STAGE_CHECKOUT_HASH ||
    receipt.sqlHash !== STAGE_UPGRADE_SQL_HASH ||
    receipt.backupHash !== proof.backupHash ||
    !Number.isFinite(age) ||
    age < 0 ||
    age > 6 * 60 * 60 * 1000
  )
    return ["invalid-upgrade-rehearsal"];
  return [];
}

export function inspectStageBaseline(snapshot: StageBaselineSnapshot): {
  state: "pending" | "applied" | "blocked";
  issues: string[];
} {
  const issues: string[] = [];
  if (snapshot.database !== "daryadarcy_staging")
    issues.push("unexpected-database");
  if (snapshot.baseHash !== STAGE_BASELINE_HASH)
    issues.push("baseline-schema-mismatch");
  if (snapshot.sqlHash !== STAGE_UPGRADE_SQL_HASH)
    issues.push("upgrade-sql-mismatch");
  if (snapshot.executableObjects !== 0)
    issues.push("unexpected-executable-objects");
  if (
    snapshot.checkoutHash !== null &&
    snapshot.checkoutHash !== STAGE_CHECKOUT_HASH
  )
    issues.push("checkout-schema-mismatch");
  return {
    state: issues.length
      ? "blocked"
      : snapshot.checkoutHash
        ? "applied"
        : "pending",
    issues,
  };
}
