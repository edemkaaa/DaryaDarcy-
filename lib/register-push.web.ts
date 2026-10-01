import type { Router } from "expo-router";

export async function registerPushToken(): Promise<void> {
  // Web push not configured — native app only.
}

export function registerNativePush(_router: Pick<Router, "push">): () => void {
  return () => {};
}
