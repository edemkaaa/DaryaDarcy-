import * as db from "../db";

/** Shared policy; an injected reader keeps checks on the caller's SQL transaction. */
export async function userHasClubAccess(
  user: {
    id: number;
    role?: string | null;
    email?: string | null;
    openId?: string | null;
    blockedAt?: Date | null;
  },
  readSubscription: (
    userId: number,
  ) => ReturnType<
    typeof db.getActiveClubSubscription
  > = db.getActiveClubSubscription,
): Promise<boolean> {
  if (user.blockedAt) return false;
  if (db.isOwnerAccount(user)) return true;
  if (user.role === "admin" || user.role === "moderator") return true;
  return Boolean(await readSubscription(user.id));
}
