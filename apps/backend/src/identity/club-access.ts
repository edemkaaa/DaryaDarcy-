/** Совместимый вход в политику доступа с возможностью сохранить транзакционный контекст читателя. */
import * as db from "../db";
import { hasClubAccess } from "./club-access-policy";

/** Общая политика; переданный reader сохраняет проверки в SQL-транзакции вызывающего кода. */
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
