/** Непрозрачные курсоры ограниченных списков привязаны к контексту. Сам курсор не выдаёт право доступа. */
import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const listPageFields = {
  limit: z.number().int().min(1).max(50).default(20),
  cursor: z.string().min(1).max(1024).nullish(),
  direction: z.literal("forward").optional(),
};
const boundary = z
  .object({
    v: z.literal(1),
    scope: z.string().length(64),
    at: z.iso.datetime(),
    id: z.number().int().positive().safe(),
  })
  .strict();

// Scope prevents accidental cross-list/account reuse; it is not authorization.
/** Привязываем курсор к выбранному списку и контексту пользователя, без выдачи дополнительных прав. */
export function listPageScope(...context: (string | number | null)[]) {
  return createHash("sha256").update(JSON.stringify(context)).digest("hex");
}
/** Принимаем только ожидаемую структуру и scope; повреждённый курсор возвращает ошибку входа. */
export function readListCursor(
  cursor: string | null | undefined,
  scope: string,
) {
  if (cursor == null) return null;
  try {
    if (cursor.length > 1024 || !/^[\w-]+$/.test(cursor)) throw new Error();
    const decoded = boundary.parse(
      JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")),
    );
    if (decoded.scope !== scope) throw new Error();
    return { at: new Date(decoded.at), id: decoded.id };
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Некорректный курсор списка",
    });
  }
}
/** Кодируем границу следующей страницы без изменения порядка сортировки. */
export function writeListCursor(scope: string, at: Date, id: number) {
  return Buffer.from(
    JSON.stringify({ v: 1, scope, at: at.toISOString(), id }),
  ).toString("base64url");
}
