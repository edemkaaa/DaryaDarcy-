"use client";
import storage from "@/shared/browser/storage";
import { USER_INFO_KEY } from "@/shared/config/api";
import { discardLegacyCredentials } from "@/shared/api/token-storage";
export type User = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  loginMethod: string | null;
  gender: "female" | "male" | null;
  avatarUrl: string | null;
  lastSignedIn: Date;
  role: string;
};
export {
  getSessionToken,
  setSessionToken,
  removeSessionToken,
} from "@/shared/api/token-storage";
let currentUser: User | null = null;
export async function setUserInfo(user: User): Promise<void> {
  discardLegacyCredentials();
  currentUser = user;
}
export async function clearUserInfo(): Promise<void> {
  discardLegacyCredentials();
  currentUser = null;
}
export async function getUserInfo(): Promise<User | null> {
  discardLegacyCredentials();
  return currentUser;
}
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
    "@darcy_last_seen_feed_id",
    "@darcy_last_seen_club_id",
  ]);
}
