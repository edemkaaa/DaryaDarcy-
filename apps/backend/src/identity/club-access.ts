import * as db from "../db";

/** Shared domain policy; database subscription state is checked on every call. */
export async function userHasClubAccess(user: {
  id: number;
  role?: string | null;
  email?: string | null;
  openId?: string | null;
  blockedAt?: Date | null;
}): Promise<boolean> {
  if (user.blockedAt) return false;
  if (db.isOwnerAccount(user)) return true;
  if (user.role === "admin" || user.role === "moderator") return true;
  return Boolean(await db.getActiveClubSubscription(user.id));
}
