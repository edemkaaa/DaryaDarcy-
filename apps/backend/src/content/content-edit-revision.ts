import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type {
  Article,
  Post,
  PostMedia,
} from "../../../../packages/database/src/schema";

export const editRevisionInput = z
  .string()
  .regex(/^[a-f0-9]{64}$/)
  .optional();
export type ContentEditPrecondition = { expectedRevision?: string };

function fingerprint(value: unknown): string {
  return createHash("sha256")
    .update(
      JSON.stringify(value, (_key, entry) => {
        if (entry && typeof entry === "object" && !Array.isArray(entry))
          return Object.fromEntries(
            Object.keys(entry)
              .sort()
              .map((key) => [key, entry[key]]),
          );
        return entry;
      }),
    )
    .digest("hex");
}

/** Include persisted content and attachments, never reaction counters or derived DTO fields. */
export function postEditRevision(post: Post, media: PostMedia[]): string {
  const fields = [
    "id",
    "text",
    "photos",
    "tags",
    "source",
    "instagramId",
    "sortOrder",
    "published",
    "status",
    "target",
    "scheduledAt",
    "publishedAt",
    "richText",
    "createdAt",
    "updatedAt",
  ] as const;
  return fingerprint([
    "post-edit:v1",
    fields.map((key) => post[key]),
    [...media].sort((a, b) => a.id - b.id),
  ]);
}

export function articleEditRevision(article: Article): string {
  return fingerprint(["article-edit:v1", article]);
}

/** Undefined options identify internal current-state commands, not a client edit. */
export function expectedEditRevision(
  condition?: ContentEditPrecondition,
): string | undefined {
  if (condition === undefined) return undefined;
  const mode = process.env.CONTENT_EDIT_REVISIONS_REQUIRED;
  if (mode !== undefined && mode !== "true" && mode !== "false")
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Сохранение временно недоступно",
    });
  if (condition.expectedRevision === undefined) {
    if (mode === "true")
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Для сохранения загрузите актуальную версию материала",
      });
    return undefined;
  }
  if (!editRevisionInput.safeParse(condition.expectedRevision).success)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Некорректная версия материала",
    });
  return condition.expectedRevision;
}

export function assertEditRevision(expected: string, actual: string): void {
  if (expected !== actual)
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "Материал уже изменён. Проверьте актуальную версию перед сохранением",
    });
}
