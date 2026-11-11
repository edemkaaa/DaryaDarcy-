/** Читает действующий доступ на переданном соединении или транзакции, не открывая другой пул. */
import { and, desc, eq } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  clubPayments,
  type ClubPayment,
} from "../../../../packages/database/src/schema";

/** Читает на переданном пуле/транзакции без повторного получения глобальной БД. */
/** На переданном reader выбирает paid-периоды по убыванию expiry и возвращает первый ещё действующий; опциональный share-read видит актуальное состояние под блокировкой. */
export async function readActiveClubSubscription(
  db: Pick<MySql2Database, "select">,
  userId: number,
  lockMode?: "share",
): Promise<ClubPayment | undefined> {
  const query = db
    .select()
    .from(clubPayments)
    .where(
      and(eq(clubPayments.userId, userId), eq(clubPayments.status, "paid")),
    )
    .orderBy(desc(clubPayments.expiresAt));
  // Блокирующее чтение видит текущий доступ даже после более раннего snapshot-чтения.
  const rows = await (lockMode ? query.for(lockMode) : query);
  const now = Date.now();
  return rows.find(
    (row) => row.expiresAt && new Date(row.expiresAt).getTime() > now,
  );
}
