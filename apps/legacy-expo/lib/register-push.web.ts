// Архив Expo. Платформенная web-заглушка не запрашивает Expo push-токен.
import type { Router } from "expo-router";

export async function registerPushToken(): Promise<void> {
  // Платформенная web-заглушка не запрашивает Expo push-токен.

  // Web push not configured — native app only.
}

export function registerNativePush(_router: Pick<Router, "push">): () => void {
  // Сохраняет интерфейс cleanup без native listeners в браузере.

  return () => {};
}
