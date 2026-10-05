import * as ReactNative from "react-native";

const env = {
  ownerId: process.env.EXPO_PUBLIC_OWNER_OPEN_ID ?? "",
  ownerEmail: (process.env.EXPO_PUBLIC_OWNER_EMAIL ?? "").trim().toLowerCase(),
  ownerName: process.env.EXPO_PUBLIC_OWNER_NAME ?? "",
  apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? "",
};

export const OWNER_OPEN_ID = env.ownerId;
export const OWNER_EMAIL = env.ownerEmail;
export const OWNER_NAME = env.ownerName;
export const API_BASE_URL = env.apiBaseUrl;

/**
 * Get the API base URL, deriving from current hostname if not set.
 * Metro runs on 8081, API server runs on 3000.
 * URL pattern: https://PORT-sandboxid.region.domain
 */
export function getApiBaseUrl(): string {
  if (API_BASE_URL) {
    const trimmed = API_BASE_URL.replace(/\/$/, "");
    const isLocalApi = /localhost|127\.0\.0\.1/.test(trimmed);
    if (
      isLocalApi &&
      ReactNative.Platform.OS === "web" &&
      typeof window !== "undefined" &&
      window.location &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      return "";
    }
    return trimmed;
  }

  // On web, derive from current hostname by replacing port 8081 with 3000
  if (ReactNative.Platform.OS === "web" && typeof window !== "undefined" && window.location) {
    const { protocol, hostname } = window.location;
    // Pattern: 8081-sandboxid.region.domain -> 3000-sandboxid.region.domain
    const apiHostname = hostname.replace(/^8081-/, "3000-");
    if (apiHostname !== hostname) {
      return `${protocol}//${apiHostname}`;
    }
  }

  // Fallback to empty (will use relative URL)
  return "";
}

export const SESSION_TOKEN_KEY = "app_session_token";
export const USER_INFO_KEY = "daryadarcy-user-info";

export function isOwnerUser(user: { role?: string | null; openId?: string | null; email?: string | null } | null | undefined): boolean {
  return user?.role === "admin";
}

/**
 * Login lives in the app now (email + password), not Manus OAuth.
 */
export function getLoginPath() {
  return "/login";
}
