"use client";
import { useEffect } from "react";
/**
 * Club posts: protect copying and selection in the browser.
 * Screenshots in a mobile browser cannot be fully blocked; this covers what the platform allows.
 */
export function useClubContentProtection(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const root =
      typeof document !== "undefined" ? document.getElementById("root") : null;
    root?.classList.add("club-protected");
    document.body?.classList.add("club-protected");
    const isEditable = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
    };
    const block = (event: Event) => {
      if (isEditable(event.target)) return;
      event.preventDefault();
    };
    document.addEventListener("copy", block, true);
    document.addEventListener("cut", block, true);
    document.addEventListener("contextmenu", block, true);
    document.addEventListener("dragstart", block, true);
    return () => {
      root?.classList.remove("club-protected");
      document.body?.classList.remove("club-protected");
      document.removeEventListener("copy", block, true);
      document.removeEventListener("cut", block, true);
      document.removeEventListener("contextmenu", block, true);
      document.removeEventListener("dragstart", block, true);
    };
  }, [enabled]);
}
