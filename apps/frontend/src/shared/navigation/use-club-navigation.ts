"use client";
/** Навигационное намерение клуба читаем отдельно от URL-параметров и сверяем при изменениях истории. */
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  captureClubNavigation,
  navigationIntentEvent,
} from "./navigation-intent";

/** Пока вкладка Клуба активна, синхронизируем navigation hint из истории при смене query и внутренних событиях. */
export function useClubNavigation(active: boolean) {
  const params = useSearchParams().toString();
  const [navigation, setNavigation] =
    useState<ReturnType<typeof captureClubNavigation>>(null);
  useEffect(() => {
    if (!active) return;
    /** Читаем hint только на фактическом /club: сохранённый в DOM экран другого маршрута не должен захватить чужое намерение. */
    const sync = () => {
      if (window.location.pathname === "/club")
        setNavigation(captureClubNavigation());
    };
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener(navigationIntentEvent, sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(navigationIntentEvent, sync);
    };
  }, [active, params]);
  return navigation;
}
