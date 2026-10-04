"use client";
import { useSyncExternalStore } from "react";
const subscribe = () => () => {};
/** True after hydration; server and initial client output use the same snapshot. */
export function useBrowserReady() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
