/** Постраничная история оплат только читает данные и не подтверждает платёж у провайдера. */
import { and, desc, eq, lt, or } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import { z } from "zod";
import { clubPayments } from "../../../../packages/database/src/schema";
import {
  listPageFields,
  listPageScope,
  readListCursor,
  writeListCursor,
} from "../content/list-page";
import { requireContentDatabase } from "../content/read-database";

export const paymentsPageInput = z
  .object(listPageFields)
  .strict()
  .default({ limit: 20 });

/** History only: no settlement, provider calls or access changes. */
/** Возвращает явную read-only проекцию истории оплат в порядке createdAt/id; непрозрачный курсор принадлежит actor и не запускает settlement. */
export async function paymentsPage(
  database: MySql2Database | null,
  actorId: number,
  input: z.infer<typeof paymentsPageInput>,
) {
  requireContentDatabase(database);
  const scope = listPageScope("paymentsPage", actorId);
  const cursor = readListCursor(input.cursor, scope);
  const rows = await database
    .select({
      id: clubPayments.id,
      userId: clubPayments.userId,
      orderId: clubPayments.orderId,
      email: clubPayments.email,
      sum: clubPayments.sum,
      status: clubPayments.status,
      paidAt: clubPayments.paidAt,
      expiresAt: clubPayments.expiresAt,
      cancelAtPeriodEnd: clubPayments.cancelAtPeriodEnd,
      cancelledAt: clubPayments.cancelledAt,
      createdAt: clubPayments.createdAt,
      updatedAt: clubPayments.updatedAt,
    })
    .from(clubPayments)
    .where(
      cursor
        ? or(
            lt(clubPayments.createdAt, cursor.at),
            and(
              eq(clubPayments.createdAt, cursor.at),
              lt(clubPayments.id, cursor.id),
            ),
          )
        : undefined,
    )
    .orderBy(desc(clubPayments.createdAt), desc(clubPayments.id))
    .limit(input.limit + 1);
  const items = rows.slice(0, input.limit),
    last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > input.limit && last
        ? writeListCursor(scope, last.createdAt, last.id)
        : null,
  };
}
