/** Чистая политика клубного доступа; вызывающий код выбирает источник текущей подписки. */
import type { ClubPayment } from "../../../../packages/database/src/schema";

/** Чистая политика, общая для фасадов и транзакционных операций контента. */
export async function hasClubAccess(
  user: { id: number; role?: string | null; blockedAt?: Date | null },
  readSubscription: (id: number) => Promise<ClubPayment | undefined>,
): Promise<boolean> {
  if (user.blockedAt) return false;
  if (user.role === "admin" || user.role === "moderator") return true;
  return Boolean(await readSubscription(user.id));
}
