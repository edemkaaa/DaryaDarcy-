"use client";
/** Браузерную цветовую схему читаем через общий hook, чтобы компоненты не создавали собственные media-query подписки. */
import { useSystemColorScheme } from "@/shared/browser/viewport";
import { useEffect, useState } from "react";
/** До hydration возвращаем light, затем системное предпочтение; это сохраняет одинаковый первый серверный и клиентский кадр. */
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
