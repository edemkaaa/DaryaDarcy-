/** Явная служебная компактация журналов восстановления оставляет маркеры использованных намерений. */
import { and, asc, eq, lte, sql } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  articleCreationRequests,
  contentRecoveryMarkers,
  postCreationRequests,
} from "../../../../packages/database/src/schema";
import {
  requireContentRecoveryMarkers,
  type ContentRecoveryKind,
} from "./recovery-markers";
import { contentRecoveryCutoff } from "./recovery-window";
import type { ContentTransaction } from "./post-deletion";

export function recoveryMaintenanceEnabled(limit: number): boolean {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new Error("Invalid recovery batch");
  return (
    process.env.CONTENT_RECOVERY_RETENTION_ENABLED === "true" &&
    process.env.CONTENT_RECOVERY_MAINTENANCE_ENABLED === "true"
  );
}

/** Original ledger lock first. A conflicting marker never authorizes removing details. */
export async function recordSpentRecovery(
  tx: ContentTransaction,
  kind: ContentRecoveryKind,
  row: { requestKey: string; actorUserId: number; createdAt: Date },
) {
  if (!(await requireContentRecoveryMarkers(tx)))
    throw new Error("Recovery marker schema unavailable");
  if (
    !/^[a-f0-9]{64}$/.test(row.requestKey) ||
    !Number.isSafeInteger(row.actorUserId) ||
    row.actorUserId <= 0 ||
    !Number.isFinite(row.createdAt?.getTime())
  )
    throw new Error("Invalid recovery evidence");
  await tx
    .insert(contentRecoveryMarkers)
    .values({
      kind,
      requestKey: row.requestKey,
      actorUserId: row.actorUserId,
      createdAt: row.createdAt,
    })
    .onDuplicateKeyUpdate({
      set: { requestKey: sql`${contentRecoveryMarkers.requestKey}` },
    });
  const [marker] = await tx
    .select()
    .from(contentRecoveryMarkers)
    .where(
      and(
        eq(contentRecoveryMarkers.kind, kind),
        eq(contentRecoveryMarkers.requestKey, row.requestKey),
      ),
    )
    .for("update");
  if (
    !marker ||
    marker.actorUserId !== row.actorUserId ||
    marker.createdAt.getTime() !== row.createdAt.getTime()
  )
    throw new Error("Conflicting recovery evidence");
}

/** Explicit bounded maintenance only; not registered in the API or any scheduler. */
export async function compactContentRecovery(
  database: MySql2Database,
  limit = 25,
) {
  const counts = { post: 0, article: 0 };
  if (!recoveryMaintenanceEnabled(limit)) return counts;
  const cutoff = contentRecoveryCutoff();
  for (const kind of ["post", "article"] as const) {
    const ledger =
      kind === "post" ? postCreationRequests : articleCreationRequests;
    counts[kind] = await database.transaction(async (tx) => {
      await tx.select().from(ledger).limit(0);
      const [indexes] = await tx.execute(
        sql`SELECT s.COLUMN_NAME AS name,s.SUB_PART AS prefix,t.ENGINE AS engine FROM information_schema.STATISTICS s JOIN information_schema.TABLES t ON t.TABLE_SCHEMA=s.TABLE_SCHEMA AND t.TABLE_NAME=s.TABLE_NAME WHERE s.TABLE_SCHEMA=DATABASE() AND s.TABLE_NAME=${ledger === postCreationRequests ? "post_creation_requests" : "article_creation_requests"} AND s.INDEX_NAME='PRIMARY' AND s.NON_UNIQUE=0`,
      );
      if (
        !Array.isArray(indexes) ||
        indexes.length !== 1 ||
        indexes[0].name !== "requestKey" ||
        indexes[0].prefix !== null ||
        indexes[0].engine !== "InnoDB"
      )
        throw new Error("Recovery ledger schema unavailable");
      const rows = await tx
        .select({
          requestKey: ledger.requestKey,
          actorUserId: ledger.actorUserId,
          createdAt: ledger.createdAt,
        })
        .from(ledger)
        .where(lte(ledger.createdAt, cutoff))
        .orderBy(asc(ledger.createdAt), asc(ledger.requestKey))
        .limit(limit)
        .for("update");
      for (const row of rows) {
        await recordSpentRecovery(tx, kind, row);
        await tx.delete(ledger).where(eq(ledger.requestKey, row.requestKey));
      }
      return rows.length;
    });
  }
  return counts;
}
