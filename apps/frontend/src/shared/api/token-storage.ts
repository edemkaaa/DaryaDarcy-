/** Убираем устаревшие браузерные credentials; актуальная сессия браузера передаётся серверной cookie. */
import { SESSION_TOKEN_KEY, USER_INFO_KEY } from "@/shared/config/api";

/** Удаляем старые token/user-info ключи по возможности; отказ localStorage не ломает действующую HttpOnly-cookie сессию. */
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

/** Совместимый reader больше не выдаёт токен JavaScript-клиенту и заодно убирает старые значения. */
export async function getSessionToken(): Promise<null> {
  discardLegacyCredentials();
  return null;
}

/** Совместимая функция намеренно не сохраняет переданную строку; новая авторизация не использует localStorage bearer token. */
export async function setSessionToken(_token: string): Promise<void> {
  discardLegacyCredentials();
}

/** Совместимая очистка удаляет только legacy-ключи; серверный logout выполняется своим REST-методом. */
export async function removeSessionToken(): Promise<void> {
  discardLegacyCredentials();
}
