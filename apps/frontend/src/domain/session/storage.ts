"use client";
/** Локальные маркеры сессии нужны для координации вкладок и неподтверждённого выхода, а не для хранения пароля. */
import storage from "@/shared/browser/storage";
import { USER_INFO_KEY } from "@/shared/config/api";
import type { AuthUser } from "@/shared/api/auth";
export type User = Omit<AuthUser, "lastSignedIn"> & {
  lastSignedIn: Date;
};
export {
  getSessionToken,
  setSessionToken,
  removeSessionToken,
} from "@/shared/api/token-storage";
export async function clearPersonalCache() {
  await storage.multiRemove([
    USER_INFO_KEY,
    "@darcy_club_profile_name",
    "@darcy_club_profile_gender",
    "@darcy_club_profile_avatar",
    "@darcy_club_profile_completed",
    "@darcy_saved_feed",
    "@darcy_saved_club",
    "@darcy_quiz_result",
    "@darcy_quiz_progress",
    "@darcy_last_seen_feed_id",
    "@darcy_last_seen_club_id",
  ]);
}
