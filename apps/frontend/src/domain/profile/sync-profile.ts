"use client";
import AsyncStorage, { isPersonalDataOwner } from "@/shared/browser/storage";
import { ApiError } from "@/shared/api/errors";
import { uriToBase64 } from "@/shared/media/image-upload";
export const CLUB_PROFILE_NAME_KEY = "@darcy_club_profile_name";
export const CLUB_PROFILE_GENDER_KEY = "@darcy_club_profile_gender";
export const CLUB_PROFILE_AVATAR_KEY = "@darcy_club_profile_avatar";
type Gender = "female" | "male";
export type ClubProfileServerApi = {
  updateProfile: (input: {
    name?: string;
    gender?: Gender;
    avatarUrl?: string;
  }) => Promise<unknown>;
  uploadAvatar: (input: {
    base64: string;
    filename: string;
    mimeType: string;
  }) => Promise<{
    url: string;
  }>;
};
function isRemoteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}
/** Push locally saved club profile (name, gender, avatar) to the server user record. */
export async function syncClubProfileToServer(
  api: ClubProfileServerApi,
  options: {
    userId: number;
    currentAvatarUrl?: string | null;
  },
): Promise<{
  syncedAvatarUrl?: string;
}> {
  const assertOwner = () => {
    if (!isPersonalDataOwner(options.userId))
      throw new ApiError("Запрос отменён.", 0, undefined, false, "cancelled");
  };
  assertOwner();
  const [name, gender, localAvatar] = await Promise.all([
    AsyncStorage.getItem(CLUB_PROFILE_NAME_KEY),
    AsyncStorage.getItem(CLUB_PROFILE_GENDER_KEY),
    AsyncStorage.getItem(CLUB_PROFILE_AVATAR_KEY),
  ]);
  assertOwner();
  const profilePatch: {
    name?: string;
    gender?: Gender;
    avatarUrl?: string;
  } = {};
  if (name?.trim()) profilePatch.name = name.trim();
  if (gender === "female" || gender === "male") profilePatch.gender = gender;
  const serverHasAvatar = isRemoteUrl(options.currentAvatarUrl ?? "");
  let syncedAvatarUrl: string | undefined;
  if (!serverHasAvatar && localAvatar?.trim()) {
    const avatar = localAvatar.trim();
    if (isRemoteUrl(avatar)) {
      profilePatch.avatarUrl = avatar;
      syncedAvatarUrl = avatar;
    } else {
      const base64 = await uriToBase64(avatar);
      assertOwner();
      const result = await api.uploadAvatar({
        base64,
        filename: "avatar.jpg",
        mimeType: "image/jpeg",
      });
      assertOwner();
      syncedAvatarUrl = result.url;
      await AsyncStorage.setItem(CLUB_PROFILE_AVATAR_KEY, result.url);
    }
  }
  if (Object.keys(profilePatch).length > 0) {
    assertOwner();
    await api.updateProfile(profilePatch);
  }
  return { syncedAvatarUrl };
}
