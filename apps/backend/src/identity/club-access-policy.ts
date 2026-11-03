import type { ClubPayment } from "../../../../packages/database/src/schema";

/** Pure policy shared by facade callers and transaction-bound content writers. */
export async function hasClubAccess(
  user: { id: number; role?: string | null; blockedAt?: Date | null },
  readSubscription: (id: number) => Promise<ClubPayment | undefined>,
): Promise<boolean> {
  if (user.blockedAt) return false;
  if (user.role === "admin" || user.role === "moderator") return true;
  return Boolean(await readSubscription(user.id));
}
