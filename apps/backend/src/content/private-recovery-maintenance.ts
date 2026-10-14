import { and, asc, eq, gt } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  privateAttachmentUploads,
  postMedia,
  posts,
} from "../../../../packages/database/src/schema";
import {
  recoveryMaintenanceEnabled,
  recordSpentRecovery,
} from "./recovery-compaction";
import { contentRecoveryCutoff } from "./recovery-window";
import { requirePrivateAttachmentSchema } from "./private-attachment-uploads";
import type { ContentTransaction } from "./post-deletion";
import { deletePrivateOrphanObject } from "../media/private-orphan-object";
import { ENV } from "../_core/env";

type Receipt = typeof privateAttachmentUploads.$inferSelect;
async function isLiveBound(tx: ContentTransaction, row: Receipt) {
  if (row.postId === null && row.mediaId === null) return false;
  if (row.postId === null || row.mediaId === null)
    throw new Error("Incomplete private binding");
  // Nonlocking current read under READ COMMITTED: never take post/media locks after asset.
  const [media] = await tx
    .select({ id: postMedia.id, url: postMedia.url, type: postMedia.type })
    .from(postMedia)
    .innerJoin(posts, eq(posts.id, postMedia.postId))
    .where(
      and(eq(postMedia.id, row.mediaId), eq(postMedia.postId, row.postId)),
    );
  if (!media) return false;
  if (
    media.type !== row.type ||
    media.url !== `/api/media/post-attachments/${row.mediaId}`
  )
    throw new Error("Private binding evidence mismatch");
  return true;
}
function requireLocalFixture() {
  const uri = new URL(ENV.databaseUrl);
  if (
    ENV.isProduction ||
    uri.protocol !== "mysql:" ||
    uri.pathname !== "/backend_test" ||
    !["localhost", "127.0.0.1"].includes(uri.hostname)
  )
    throw new Error("Only disposable local recovery maintenance is enabled");
}

/** Cursor-bounded explicit local call; no scheduler, API route, working DB or bucket sweep. */
export async function maintainPrivateRecovery(
  database: MySql2Database,
  options: { limit?: number; afterKey?: string } = {},
) {
  const limit = options.limit ?? 25,
    afterKey = options.afterKey ?? "";
  const result = {
    compacted: 0,
    observed: 0,
    deleted: 0,
    failed: 0,
    nextCursor: null as string | null,
  };
  if (afterKey && !/^[a-f0-9]{64}$/.test(afterKey))
    throw new Error("Invalid recovery cursor");
  if (!recoveryMaintenanceEnabled(limit)) return result;
  requireLocalFixture();
  const cutoff = contentRecoveryCutoff();
  // keyset iteration ensures old live receipts cannot starve later orphan candidates.
  const candidates = await database
    .select({ requestKey: privateAttachmentUploads.requestKey })
    .from(privateAttachmentUploads)
    .where(gt(privateAttachmentUploads.requestKey, afterKey))
    .orderBy(asc(privateAttachmentUploads.requestKey))
    .limit(limit);
  for (const candidate of candidates) {
    result.nextCursor = candidate.requestKey;
    try {
      const committed = await database.transaction(
        async (tx) => {
          const progress = { eligible: false, compacted: 0, observed: 0 };
          await requirePrivateAttachmentSchema(tx);
          const [row] = await tx
            .select()
            .from(privateAttachmentUploads)
            .where(
              eq(privateAttachmentUploads.requestKey, candidate.requestKey),
            )
            .for("update");
          if (!row || row.createdAt > cutoff) return progress;
          const live = await isLiveBound(tx, row);
          if (!row.recoveryCompactedAt) {
            await recordSpentRecovery(tx, "private_attachment", row);
            await tx
              .update(privateAttachmentUploads)
              .set({ filename: "", recoveryCompactedAt: new Date() })
              .where(eq(privateAttachmentUploads.requestKey, row.requestKey));
            progress.compacted++;
          } else {
            await recordSpentRecovery(tx, "private_attachment", row);
          }
          if (live) return progress;
          if (!row.orphanedAt) {
            // Never-bound expiry is original intent age; unknown detachment starts NOW.
            const orphanedAt =
              row.postId === null && row.mediaId === null
                ? row.createdAt
                : new Date();
            await tx
              .update(privateAttachmentUploads)
              .set({ orphanedAt })
              .where(eq(privateAttachmentUploads.requestKey, row.requestKey));
            progress.observed++;
            progress.eligible = orphanedAt <= cutoff;
            return progress;
          }
          progress.eligible = row.orphanedAt <= cutoff;
          return progress;
        },
        { isolationLevel: "read committed" },
      );
      result.compacted += committed.compacted;
      result.observed += committed.observed;
      if (
        !committed.eligible ||
        process.env.PRIVATE_ORPHAN_CLEANUP_ENABLED !== "true"
      )
        continue;
      // Marker above has committed before storage; any failure keeps durable evidence.
      const deleted = await database.transaction(
        async (tx) => {
          await requirePrivateAttachmentSchema(tx);
          const [row] = await tx
            .select()
            .from(privateAttachmentUploads)
            .where(
              eq(privateAttachmentUploads.requestKey, candidate.requestKey),
            )
            .for("update");
          if (
            !row ||
            !row.orphanedAt ||
            row.orphanedAt > cutoff ||
            (await isLiveBound(tx, row))
          )
            return false;
          await recordSpentRecovery(tx, "private_attachment", row);
          await deletePrivateOrphanObject(row);
          await tx
            .delete(privateAttachmentUploads)
            .where(eq(privateAttachmentUploads.requestKey, row.requestKey));
          return true;
        },
        { isolationLevel: "read committed" },
      );
      if (deleted) result.deleted++;
    } catch {
      result.failed++;
    }
  }
  if (candidates.length < limit) result.nextCursor = null;
  return result;
}
