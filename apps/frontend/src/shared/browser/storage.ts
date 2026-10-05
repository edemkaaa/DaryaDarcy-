"use client";
const personalKeys = new Set([
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
let personalDataOwner: number | null = null;
const scopedKey = (key: string, owner = personalDataOwner) =>
  personalKeys.has(key) ? `darcy:user:${owner ?? "guest"}:${key}` : key;

export function isPersonalDataOwner(userId: number): boolean {
  return personalDataOwner === userId;
}

/** Unowned legacy data must never be assigned to the next person who signs in. */
export function setPersonalDataOwner(owner: number | null): void {
  for (const key of personalKeys) {
    try {
      window.localStorage.removeItem(key);
      if (owner !== personalDataOwner)
        window.localStorage.removeItem(scopedKey(key));
    } catch {
      /* Browser storage is optional. */
    }
  }
  personalDataOwner = owner;
}

const storage = {
  async getItem(key: string) {
    try {
      return window.localStorage.getItem(scopedKey(key));
    } catch {
      return null;
    }
  },
  async setItem(key: string, value: string) {
    try {
      window.localStorage.setItem(scopedKey(key), value);
    } catch {
      // Optional UI preferences must not prevent navigation or sign-in.
    }
  },
  async removeItem(key: string) {
    try {
      window.localStorage.removeItem(scopedKey(key));
    } catch {}
  },
  async multiRemove(keys: readonly string[]) {
    await Promise.all(keys.map((k) => storage.removeItem(k)));
  },
};
export default storage;
