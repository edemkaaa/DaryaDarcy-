export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || ""
).replace(/\/$/, "");
export function getApiBaseUrl() {
  return API_BASE_URL;
}
export function apiUrl(path: string) {
  return API_BASE_URL + path;
}
export const SESSION_TOKEN_KEY = "app_session_token";
export const USER_INFO_KEY = "daryadarcy-user-info";
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
export const getLoginPath = () => "/login";
