import { and, asc, eq, gt } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  users,
  posts,
  articles,
  postCreationRequests,
  articleCreationRequests,
  privateAttachmentUploads,
  contentRecoveryMarkers,
} from "../../../../packages/database/src/schema";
import type { ContentWriteActor } from "./content-write-actor";
import { requireRecoveryRetirementSchema } from "./recovery-retirement";
import { assertContentRecoveryWindow } from "./recovery-window";
import type { ContentTransaction } from "./post-deletion";

export const recoveryExportInput = z
  .object({
    kind: z.enum(["post", "article", "private_attachment"]),
    afterKey: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    limit: z.number().int().min(1).max(100).default(25),
  })
  .strict();
export const recoveryExportOutput = z.object({
  items: z.array(
    z.object({
      requestId: z.string(),
      createdAt: z.date(),
      status: z.enum(["created", "deleted", "pending", "ready", "expired"]),
    }),
  ),
  nextCursor: z.string().nullable(),
});
type Item = z.output<typeof recoveryExportOutput>["items"][number];
type Input = z.output<typeof recoveryExportInput>;
const unavailable = () =>
  new TRPCError({
    code: "SERVICE_UNAVAILABLE",
    message: "Экспорт временно недоступен",
  });
export function requireRecoveryExportEnabled() {
  if (process.env.CONTENT_RECOVERY_EXPORT_ENABLED !== "true")
    throw new TRPCError({ code: "NOT_FOUND" });
}
function expired(createdAt: Date) {
  try {
    assertContentRecoveryWindow(createdAt);
    return false;
  } catch (error) {
    if (error instanceof TRPCError && error.code === "CONFLICT") return true;
    throw error;
  }
}
async function details(
  tx: ContentTransaction,
  actor: ContentWriteActor,
  input: Input,
): Promise<Item[]> {
  const after = input.afterKey ?? "";
  if (input.kind === "private_attachment") {
    const rows = await tx
      .select({
        requestId: privateAttachmentUploads.requestKey,
        createdAt: privateAttachmentUploads.createdAt,
        state: privateAttachmentUploads.state,
        etag: privateAttachmentUploads.etag,
        compacted: privateAttachmentUploads.recoveryCompactedAt,
      })
      .from(privateAttachmentUploads)
      .where(
        and(
          eq(privateAttachmentUploads.actorUserId, actor.id),
          gt(privateAttachmentUploads.requestKey, after),
        ),
      )
      .orderBy(asc(privateAttachmentUploads.requestKey))
      .limit(input.limit + 1);
    return rows.map((row) => {
      if (row.compacted || expired(row.createdAt))
        return {
          requestId: row.requestId,
          createdAt: row.createdAt,
          status: "expired",
        };
      if (row.state === "ready" && !row.etag) throw unavailable();
      return {
        requestId: row.requestId,
        createdAt: row.createdAt,
        status: row.state,
      };
    });
  }
  const ledger =
    input.kind === "post" ? postCreationRequests : articleCreationRequests;
  const material = input.kind === "post" ? posts : articles;
  const resultColumn =
    input.kind === "post"
      ? postCreationRequests.postId
      : articleCreationRequests.articleId;
  const rows = await tx
    .select({
      requestId: ledger.requestKey,
      createdAt: ledger.createdAt,
      resultId: resultColumn,
      currentId: material.id,
    })
    .from(ledger)
    .leftJoin(material, eq(material.id, resultColumn))
    .where(and(eq(ledger.actorUserId, actor.id), gt(ledger.requestKey, after)))
    .orderBy(asc(ledger.requestKey))
    .limit(input.limit + 1);
  return rows.map((row) => {
    if (expired(row.createdAt))
      return {
        requestId: row.requestId,
        createdAt: row.createdAt,
        status: "expired",
      };
    if (
      !Number.isSafeInteger(row.resultId) ||
      !row.resultId ||
      row.resultId < 1
    )
      throw unavailable();
    return {
      requestId: row.requestId,
      createdAt: row.createdAt,
      status: row.currentId === null ? "deleted" : "created",
    };
  });
}
/** Own metadata only. One nonlocking snapshot; never grants a file/content capability. */
export async function exportContentRecovery(
  database: MySql2Database,
  actor: ContentWriteActor,
  input: Input,
): Promise<z.output<typeof recoveryExportOutput>> {
  requireRecoveryExportEnabled();
  try {
    return await database.transaction(
      async (tx) => {
        const [current] = await tx
          .select({ epoch: users.sessionVersion, blockedAt: users.blockedAt })
          .from(users)
          .where(eq(users.id, actor.id));
        if (!current || current.epoch !== actor.sessionVersion)
          throw new TRPCError({ code: "UNAUTHORIZED" });
        if (current.blockedAt) throw new TRPCError({ code: "FORBIDDEN" });
        await requireRecoveryRetirementSchema(tx);
        const records = await details(tx, actor, input);
        const markers = await tx
          .select({
            requestId: contentRecoveryMarkers.requestKey,
            createdAt: contentRecoveryMarkers.createdAt,
          })
          .from(contentRecoveryMarkers)
          .where(
            and(
              eq(contentRecoveryMarkers.actorUserId, actor.id),
              eq(contentRecoveryMarkers.kind, input.kind),
              gt(contentRecoveryMarkers.requestKey, input.afterKey ?? ""),
            ),
          )
          .orderBy(asc(contentRecoveryMarkers.requestKey))
          .limit(input.limit + 1);
        const merged = new Map(records.map((row) => [row.requestId, row]));
        for (const marker of markers)
          merged.set(marker.requestId, { ...marker, status: "expired" });
        const ordered = [...merged.values()].sort((a, b) =>
          a.requestId < b.requestId ? -1 : a.requestId > b.requestId ? 1 : 0,
        );
        const items = ordered.slice(0, input.limit);
        return {
          items,
          nextCursor:
            ordered.length > input.limit
              ? items[items.length - 1].requestId
              : null,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    throw unavailable();
  }
}
