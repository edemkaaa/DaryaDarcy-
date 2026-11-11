/** Построение адресов API отделяем от компонентов, чтобы пути одинаково работали с настроенным базовым адресом. */
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || ""
).replace(/\/$/, "");
/** В браузере запрещаем отдельный публичный origin или вложенный base path, чтобы cookie и относительные закрытые URL оставались на одном сайте. */
export function getApiBaseUrl() {
  if (
    API_BASE_URL &&
    typeof window !== "undefined" &&
    window.location?.origin
  ) {
    const configured = new URL(API_BASE_URL, window.location.origin);
    if (
      configured.origin !== window.location.origin ||
      configured.pathname !== "/" ||
      configured.search ||
      configured.hash ||
      configured.username ||
      configured.password
    ) {
      throw new Error(
        "Для сайта, API и закрытых файлов нужен один публичный домен. Настройте прокси /api и оставьте NEXT_PUBLIC_API_BASE_URL пустым.",
      );
    }
  }
  return API_BASE_URL;
}
/** Проверяем публичную базу перед объединением с внутренним API-путём; функция не превращает произвольный URL в доверенный. */
export function apiUrl(path: string) {
  return getApiBaseUrl() + path;
}
export const SESSION_TOKEN_KEY = "app_session_token";
export const USER_INFO_KEY = "daryadarcy-user-info";
/** Административный интерфейс определяется ролью, а не совпадением email или openId; окончательные полномочия проверяет API. */
export function isOwnerUser(
  user:
    | {
        role?: string | null;
        openId?: string | null;
        email?: string | null;
      }
    | null
    | undefined,
) {
  return user?.role === "admin";
}
/** Совместимый вызов возвращает текущий маршрут входа без токенов и query-параметров. */
export const getLoginPath = () => "/login";
