import * as db from "../db";
import { hasClubAccess } from "./club-access-policy";

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
  return hasClubAccess(user, readSubscription);
}
