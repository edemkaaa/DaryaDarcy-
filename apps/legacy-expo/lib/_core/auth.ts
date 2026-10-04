import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { SESSION_TOKEN_KEY, USER_INFO_KEY } from "@/constants/oauth";

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

let webUser: User | null = null;

function discardLegacyWebStorage(): void {
  if (typeof window === "undefined") return;
  for (const key of [SESSION_TOKEN_KEY, USER_INFO_KEY]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Cookie authentication must not depend on localStorage availability.
    }
  }
}

export async function getSessionToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    discardLegacyWebStorage();
    return null; // Web requests authenticate with the server's HttpOnly cookie.
  }
  try {
    return await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setSessionToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    discardLegacyWebStorage();
    return; // Set-Cookie was already processed by the credentialed login request.
  }
  try {
    await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
  } catch {
    throw new Error("Не удалось сохранить сессию на устройстве");
  }
}

export async function removeSessionToken(): Promise<void> {
  if (Platform.OS === "web") {
    discardLegacyWebStorage();
    return;
  }
  try {
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
  } catch {}
}

export async function getUserInfo(): Promise<User | null> {
  if (Platform.OS === "web") {
    discardLegacyWebStorage();
    return webUser;
  }
  try {
    const info = await SecureStore.getItemAsync(USER_INFO_KEY);
    return info ? JSON.parse(info) : null;
  } catch {
    return null;
  }
}

export async function setUserInfo(user: User): Promise<void> {
  if (Platform.OS === "web") {
    discardLegacyWebStorage();
    webUser = user;
    return;
  }
  try {
    await SecureStore.setItemAsync(USER_INFO_KEY, JSON.stringify(user));
  } catch {
    // The cached profile is optional; API authorization remains server-owned.
  }
}

export async function clearUserInfo(): Promise<void> {
  if (Platform.OS === "web") {
    discardLegacyWebStorage();
    webUser = null;
    return;
  }
  try {
    await SecureStore.deleteItemAsync(USER_INFO_KEY);
  } catch {}
}
