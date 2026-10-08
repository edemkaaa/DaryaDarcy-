"use client";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useScreenActive } from "@/shared/navigation/screen-activity";
import { parsePublicAppearance, untilMoscowMidnight } from "./settings";
import {
  PUBLIC_LAUNCH_KEY,
  publicConfigurationOptions,
} from "./public-configuration";

export const CLUB_APPEARANCE_KEY = PUBLIC_LAUNCH_KEY;
export function useClubAppearance() {
  const active = useScreenActive();
  const query = useQuery({
    ...publicConfigurationOptions(),
    select: parsePublicAppearance,
    enabled: active,
  });
  const { refetch } = query;
  useEffect(() => {
    if (!active) return;
    const refresh = () => {
      if (document.visibilityState === "visible")
        void refetch({ cancelRefetch: false });
    };
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        refresh();
        schedule();
      }, untilMoscowMidnight());
    };
    schedule();
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    window.addEventListener("online", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      window.removeEventListener("online", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [active, refetch]);
  return query;
}
