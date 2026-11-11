/** Чистые проверки ролей и блокировки, общие для транспортных и доменных вызовов. */
import type { User } from "../../../../packages/database/src/schema";

export function isModeratorAccount(user: {
  role?: string | null;
  email?: string | null;
  openId?: string | null;
}): boolean {
  return user.role === "moderator" || user.role === "admin";
}

export function isStaffAccount(user: {
  role?: string | null;
  email?: string | null;
  openId?: string | null;
}): boolean {
  return isModeratorAccount(user);
}

export function isUserBlocked(
  user: Pick<User, "blockedAt"> | null | undefined,
): boolean {
  return Boolean(user?.blockedAt);
}
