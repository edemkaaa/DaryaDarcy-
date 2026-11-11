/** Страница статей для администратора: ограничиваем выборку и передаём курсор следующей страницы. */
import { and, asc, desc, eq, gt, lt, or } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { articles } from "../../../../packages/database/src/schema";
import { listPageFields, listPageScope } from "./list-page";
import { requireContentDatabase } from "./read-database";

export const adminArticlesPageInput = z
  .object(listPageFields)
  .strict()
  .default({ limit: 20 });
const boundary = z
  .object({
    v: z.literal(1),
    scope: z.string().length(64),
    order: z.number().int(),
    at: z.iso.datetime(),
    id: z.number().int().positive().safe(),
  })
  .strict();
function readCursor(value: string | null | undefined, scope: string) {
  if (value == null) return null;
  try {
    if (value.length > 1024 || !/^[\w-]+$/.test(value)) throw new Error();
    const cursor = boundary.parse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
    if (cursor.scope !== scope) throw new Error();
    return { ...cursor, at: new Date(cursor.at) };
  } catch {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Некорректный курсор списка",
    });
  }
}
/** Выдаём ограниченную страницу редакторского списка с курсором следующей порции. */
export async function adminArticlesPage(
  database: MySql2Database | null,
  actorId: number,
  input: z.infer<typeof adminArticlesPageInput>,
) {
  requireContentDatabase(database);
  const scope = listPageScope("adminArticlesPage", actorId),
    cursor = readCursor(input.cursor, scope);
  const rows = await database
    .select({
      id: articles.id,
      title: articles.title,
      coverUrl: articles.coverUrl,
      access: articles.access,
      published: articles.published,
      sortOrder: articles.sortOrder,
      createdAt: articles.createdAt,
      updatedAt: articles.updatedAt,
    })
    .from(articles)
    .where(
      cursor
        ? or(
            gt(articles.sortOrder, cursor.order),
            and(
              eq(articles.sortOrder, cursor.order),
              lt(articles.createdAt, cursor.at),
            ),
            and(
              eq(articles.sortOrder, cursor.order),
              eq(articles.createdAt, cursor.at),
              lt(articles.id, cursor.id),
            ),
          )
        : undefined,
    )
    .orderBy(
      asc(articles.sortOrder),
      desc(articles.createdAt),
      desc(articles.id),
    )
    .limit(input.limit + 1);
  const items = rows.slice(0, input.limit),
    last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > input.limit && last
        ? Buffer.from(
            JSON.stringify({
              v: 1,
              scope,
              order: last.sortOrder,
              at: last.createdAt.toISOString(),
              id: last.id,
            }),
          ).toString("base64url")
        : null,
  };
}
