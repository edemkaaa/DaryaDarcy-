// Архив Expo. Распознаёт iPhone/iPad Safari, включая iPadOS с MacIntel и touchpoints.
import { Platform } from "react-native";

/** iPhone/iPad Safari and iOS PWA (Platform.OS is still "web"). */
export function isAppleMobileWeb(): boolean {
  // Распознаёт iPhone/iPad Safari, включая iPadOS с MacIntel и touchpoints.

  if (Platform.OS !== "web" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function isMobileWeb(): boolean {
  // Проверяет старый mobile-web user agent, не пытаясь определить физический размер экрана.

  if (Platform.OS !== "web" || typeof navigator === "undefined") return false;
  return /Android|iPad|iPhone|iPod/i.test(navigator.userAgent);
}
