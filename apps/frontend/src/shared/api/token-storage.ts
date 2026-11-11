/** Убираем устаревшие браузерные credentials; актуальная сессия браузера передаётся серверной cookie. */
import { SESSION_TOKEN_KEY, USER_INFO_KEY } from "@/shared/config/api";

export function discardLegacyCredentials(): void {
  if (typeof window === "undefined") return;
  for (const key of [SESSION_TOKEN_KEY, USER_INFO_KEY]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // HttpOnly cookie authentication does not depend on browser storage.
    }
  }
}

export async function getSessionToken(): Promise<null> {
  discardLegacyCredentials();
  return null;
}

export async function setSessionToken(_token: string): Promise<void> {
  discardLegacyCredentials();
}

export async function removeSessionToken(): Promise<void> {
  discardLegacyCredentials();
}
