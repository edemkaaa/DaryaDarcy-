/** Сравниваем ревизию редактора с актуальным состоянием, чтобы не затереть параллельную правку. */
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

/** Канонизирует ключи объектов перед SHA-256, сохраняя порядок массивов и значения редактируемого состояния. */
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
/** Хеширует persisted post-поля и media в порядке ID; derived DTO и счётчики реакций не создают ложные конфликты редактора. */
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

/** Ревизия статьи зависит от редактируемого содержимого и нужна для обнаружения параллельной правки. */
export function articleEditRevision(article: Article): string {
  return fingerprint(["article-edit:v1", article]);
}

/** Undefined options identify internal current-state commands, not a client edit. */
/** Отличает внутренний current-state вызов без condition от клиентского edit; strict true требует версию, неверный flag даёт503, неверный hash даёт400. */
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

/** Несовпадение ожидаемой версии означает конфликт; чужое изменение не затираем. */
export function assertEditRevision(expected: string, actual: string): void {
  if (expected !== actual)
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "Материал уже изменён. Проверьте актуальную версию перед сохранением",
    });
}
