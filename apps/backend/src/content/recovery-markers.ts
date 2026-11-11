/** Маркеры использованных намерений не позволяют повторно создать результат после компактации журнала. */
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { contentRecoveryMarkers } from "../../../../packages/database/src/schema";
import type { ContentTransaction } from "./post-deletion";

export type ContentRecoveryKind =
  typeof contentRecoveryMarkers.$inferSelect.kind;
type Reader = Pick<ContentTransaction, "select" | "execute">;
/** Отказываем во временном восстановлении, когда нельзя надёжно прочитать доказательства использованных ключей. */
const unavailable = () =>
  new TRPCError({
    code: "SERVICE_UNAVAILABLE",
    message: "Восстановление временно недоступно",
  });

/** The metadata lock lasts until the caller's transaction commits. No runtime DDL. */
/** Проверяем таблицу и полный составной PRIMARY InnoDB без runtime-DDL; отсутствие старой таблицы допустимо лишь при выключенной политике срока. */
export async function requireContentRecoveryMarkers(
  reader: Reader,
): Promise<boolean> {
  try {
    await reader.select().from(contentRecoveryMarkers).limit(0);
    const [rows] = await reader.execute(sql`
      SELECT s.COLUMN_NAME AS name,s.SEQ_IN_INDEX AS position,s.SUB_PART AS prefix,t.ENGINE AS engine
      FROM information_schema.STATISTICS s JOIN information_schema.TABLES t
        ON t.TABLE_SCHEMA=s.TABLE_SCHEMA AND t.TABLE_NAME=s.TABLE_NAME
      WHERE s.TABLE_SCHEMA=DATABASE() AND s.TABLE_NAME='content_recovery_markers'
        AND s.INDEX_NAME='PRIMARY' AND s.NON_UNIQUE=0 ORDER BY s.SEQ_IN_INDEX`);
    if (
      !Array.isArray(rows) ||
      rows.length !== 2 ||
      rows[0].name !== "kind" ||
      rows[0].position !== 1 ||
      rows[1].name !== "requestKey" ||
      rows[1].position !== 2 ||
      rows.some((row) => row.prefix !== null || row.engine !== "InnoDB")
    )
      throw unavailable();
    return true;
  } catch (error) {
    const mysqlError = error as {
      code?: string;
      cause?: { code?: string };
    } | null;
    // Pre-0033 legacy schema is allowed only while the new policy is disabled.
    if (
      process.env.CONTENT_RECOVERY_RETENTION_ENABLED !== "true" &&
      (mysqlError?.cause?.code ?? mysqlError?.code) === "ER_NO_SUCH_TABLE"
    )
      return false;
    throw unavailable();
  }
}

/** Caller locks the original ledger key FIRST; compaction must use the same order. */
/** После исходного ключа читаем маркеры в стабильном порядке: чужое доказательство означает сбой, любой свой маркер запрещает повтор даже после выключения политики срока. */
export async function assertContentRecoveryNotSpent(
  reader: Reader,
  kind: ContentRecoveryKind,
  requestKeys: readonly string[],
  actorUserId: number,
  mode: "current" | "snapshot" = "current",
): Promise<void> {
  if (!requestKeys.length) return;
  if (!(await requireContentRecoveryMarkers(reader))) return;
  const query = reader
    .select()
    .from(contentRecoveryMarkers)
    .where(
      and(
        eq(contentRecoveryMarkers.kind, kind),
        inArray(contentRecoveryMarkers.requestKey, [...requestKeys]),
      ),
    )
    .orderBy(asc(contentRecoveryMarkers.requestKey));
  const markers = await (mode === "current" ? query.for("update") : query);
  if (!markers.length) return;
  if (markers.some((marker) => marker.actorUserId !== actorUserId))
    throw unavailable();
  // This fence remains mandatory even if expiry is disabled after compaction.
  throw new TRPCError({
    code: "CONFLICT",
    message: "Срок восстановления истёк",
  });
}
