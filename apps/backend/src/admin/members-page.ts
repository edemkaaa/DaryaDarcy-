/** Ограниченный список участников для админки с курсором и безопасной проекцией полей. */
import { and, desc, eq, gt, inArray, lt, max, or } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { z } from "zod";
import { clubPayments, users } from "../../../../packages/database/src/schema";
import {
  listPageFields,
  listPageScope,
  readListCursor,
  writeListCursor,
} from "../content/list-page";
import { requireContentDatabase } from "../content/read-database";

export const membersPageInput = z
  .object({
    ...listPageFields,
    userId: z.number().int().positive().safe().optional(),
  })
  .strict()
  .default({ limit: 20 });

/** Ограничиваем страницу участников и сохраняем контекст курсора. */
/** Читает безопасные поля участников и максимум действующего paid-срока одним snapshot; keyset-курсор привязан к actor и фильтру userId. */
export async function membersPage(
  database: MySql2Database | null,
  actorId: number,
  input: z.infer<typeof membersPageInput>,
) {
  requireContentDatabase(database);
  const scope = listPageScope("membersPage", actorId, input.userId ?? null);
  const cursor = readListCursor(input.cursor, scope);
  return database.transaction(async (tx) => {
    const rows = await tx
      .select({
        id: users.id,
        email: users.email,
        contactPhone: users.contactPhone,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
        blockedAt: users.blockedAt,
        blockedReason: users.blockedReason,
      })
      .from(users)
      .where(
        and(
          input.userId ? eq(users.id, input.userId) : undefined,
          cursor
            ? or(
                lt(users.createdAt, cursor.at),
                and(eq(users.createdAt, cursor.at), lt(users.id, cursor.id)),
              )
            : undefined,
        ),
      )
      .orderBy(desc(users.createdAt), desc(users.id))
      .limit(input.limit + 1);
    const page = rows.slice(0, input.limit),
      last = page.at(-1);
    const expiries = page.length
      ? await tx
          .select({
            userId: clubPayments.userId,
            expiresAt: max(clubPayments.expiresAt),
          })
          .from(clubPayments)
          .where(
            and(
              inArray(
                clubPayments.userId,
                page.map((row) => row.id),
              ),
              eq(clubPayments.status, "paid"),
              gt(clubPayments.expiresAt, new Date()),
            ),
          )
          .groupBy(clubPayments.userId)
      : [];
    const byUser = new Map(expiries.map((row) => [row.userId, row.expiresAt]));
    return {
      items: page.map((row) => ({
        ...row,
        clubExpiresAt: byUser.get(row.id) ?? null,
      })),
      nextCursor:
        rows.length > input.limit && last
          ? writeListCursor(scope, last.createdAt, last.id)
          : null,
    };
  });
}
