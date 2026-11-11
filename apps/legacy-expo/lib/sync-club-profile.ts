// Архив Expo. Отличает HTTP(S) аватар от локального URI устройства.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { uriToBase64 } from "@/lib/admin-photo-upload";

export const CLUB_PROFILE_NAME_KEY = "@darcy_club_profile_name";
export const CLUB_PROFILE_GENDER_KEY = "@darcy_club_profile_gender";
export const CLUB_PROFILE_AVATAR_KEY = "@darcy_club_profile_avatar";

type Gender = "female" | "male";

export type ClubProfileServerApi = {
  updateProfile: (input: { name?: string; gender?: Gender; avatarUrl?: string }) => Promise<unknown>;
  uploadAvatar: (input: { base64: string; filename: string; mimeType: string }) => Promise<{ url: string }>;
};

function isRemoteUrl(value: string): boolean {
  // Отличает HTTP(S) аватар от локального URI устройства.

  return /^https?:\/\//i.test(value);
}

/** Push locally saved club profile (name, gender, avatar) to the server user record. */
export async function syncClubProfileToServer(
  api: ClubProfileServerApi,
  options: { currentAvatarUrl?: string | null } = {},
): Promise<{ syncedAvatarUrl?: string }> {
  // Переносит старый общий кеш профиля на сервер; существующий remote-аватар не заменяет, загрузка и обновление профиля раздельны.

  const [name, gender, localAvatar] = await Promise.all([
    AsyncStorage.getItem(CLUB_PROFILE_NAME_KEY),
    AsyncStorage.getItem(CLUB_PROFILE_GENDER_KEY),
    AsyncStorage.getItem(CLUB_PROFILE_AVATAR_KEY),
  ]);

  const profilePatch: { name?: string; gender?: Gender; avatarUrl?: string } = {};
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
      const result = await api.uploadAvatar({ base64, filename: "avatar.jpg", mimeType: "image/jpeg" });
      syncedAvatarUrl = result.url;
      await AsyncStorage.setItem(CLUB_PROFILE_AVATAR_KEY, result.url);
    }
  }

  if (Object.keys(profilePatch).length > 0) {
    await api.updateProfile(profilePatch);
  }

  return { syncedAvatarUrl };
}
