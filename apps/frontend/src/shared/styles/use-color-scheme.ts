"use client";
/** Браузерную цветовую схему читаем через общий hook, чтобы компоненты не создавали собственные media-query подписки. */
import { useSystemColorScheme } from "@/shared/browser/viewport";
import { useEffect, useState } from "react";
/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);
  useEffect(() => {
    setHasHydrated(true);
  }, []);
  const colorScheme = useSystemColorScheme();
  if (hasHydrated) {
    return colorScheme;
  }
  return "light";
}
