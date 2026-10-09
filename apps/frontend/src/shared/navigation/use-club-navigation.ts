"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  captureClubNavigation,
  navigationIntentEvent,
} from "./navigation-intent";

export function useClubNavigation(active: boolean) {
  const params = useSearchParams().toString();
  const [navigation, setNavigation] =
    useState<ReturnType<typeof captureClubNavigation>>(null);
  useEffect(() => {
    if (!active) return;
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
