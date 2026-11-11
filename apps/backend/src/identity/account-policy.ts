/** Чистые проверки ролей и блокировки, общие для транспортных и доменных вызовов. */
import type { User } from "../../../../packages/database/src/schema";

/** Проверяем полномочия модерации строго по роли admin или moderator; email и openId не повышают права. */
export function isModeratorAccount(user: {
  role?: string | null;
  email?: string | null;
  openId?: string | null;
}): boolean {
  return user.role === "moderator" || user.role === "admin";
}

/** Используем единый критерий служебной роли для администраторов и модераторов. */
export function isStaffAccount(user: {
  role?: string | null;
  email?: string | null;
  openId?: string | null;
}): boolean {
  return isModeratorAccount(user);
}

/** Считаем аккаунт заблокированным по наличию blockedAt, корректно обрабатывая отсутствие пользователя. */
export function isUserBlocked(
  user: Pick<User, "blockedAt"> | null | undefined,
): boolean {
  return Boolean(user?.blockedAt);
}
