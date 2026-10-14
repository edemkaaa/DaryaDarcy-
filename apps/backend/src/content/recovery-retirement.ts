import { createHash } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import {
  articleCreationRequests,
  contentRecoveryMarkers,
  postCreationRequests,
  privateAttachmentUploads,
} from "../../../../packages/database/src/schema";
import type { ContentTransaction } from "./post-deletion";

/** No runtime DDL or partial cleanup on missing/nontransactional rollout schema. */
export async function requireRecoveryRetirementSchema(tx: ContentTransaction) {
  for (const table of [
    postCreationRequests,
    articleCreationRequests,
    contentRecoveryMarkers,
    privateAttachmentUploads,
  ]) {
    await tx.select().from(table).limit(0);
  }
  const [rows] =
    await tx.execute(sql`SELECT t.TABLE_NAME AS name,t.ENGINE AS engine,c.IS_NULLABLE AS nullable
    FROM information_schema.TABLES t JOIN information_schema.COLUMNS c
    ON t.TABLE_SCHEMA=c.TABLE_SCHEMA AND t.TABLE_NAME=c.TABLE_NAME
    WHERE t.TABLE_SCHEMA=DATABASE() AND c.COLUMN_NAME='actorUserId'
    AND t.TABLE_NAME IN ('post_creation_requests','article_creation_requests','content_recovery_markers','private_attachment_uploads')`);
  if (
    !Array.isArray(rows) ||
    rows.length !== 4 ||
    rows.some((row) => row.engine !== "InnoDB") ||
    !rows.some(
      (row) =>
        row.name === "private_attachment_uploads" && row.nullable === "YES",
    )
  ) {
    throw new Error("Recovery retirement schema unavailable");
  }
}

/** Caller already holds the retiring user PK lock, shared with every recovery writer. */
export async function retireContentRecovery(
  tx: ContentTransaction,
  actorUserId: number,
) {
  if (process.env.CONTENT_RECOVERY_RETIREMENT_ENABLED !== "true") return;
  await requireRecoveryRetirementSchema(tx);
  // Source locks precede marker locks, matching compaction. Deletes also wait for compaction.
  await tx
    .delete(postCreationRequests)
    .where(eq(postCreationRequests.actorUserId, actorUserId));
  await tx
    .delete(articleCreationRequests)
    .where(eq(articleCreationRequests.actorUserId, actorUserId));
  while (true) {
    const receipts = await tx
      .select({
        requestKey: privateAttachmentUploads.requestKey,
        assetId: privateAttachmentUploads.assetId,
      })
      .from(privateAttachmentUploads)
      .where(eq(privateAttachmentUploads.actorUserId, actorUserId))
      .orderBy(asc(privateAttachmentUploads.requestKey))
      .limit(100)
      .for("update");
    if (!receipts.length) break;
    for (const receipt of receipts) {
      // Keep technical ownership/read evidence; discard the actor-derived recovery fingerprint.
      const requestKey = createHash("sha256")
        .update(JSON.stringify(["retired-private:v1", receipt.assetId]))
        .digest("hex");
      await tx
        .update(privateAttachmentUploads)
        .set({
          requestKey,
          actorUserId: null,
          filename: "",
          recoveryCompactedAt: new Date(),
        })
        .where(eq(privateAttachmentUploads.requestKey, receipt.requestKey));
    }
  }
  await tx
    .delete(contentRecoveryMarkers)
    .where(eq(contentRecoveryMarkers.actorUserId, actorUserId));
}
