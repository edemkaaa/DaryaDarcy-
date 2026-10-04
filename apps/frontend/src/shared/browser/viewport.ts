"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
export type ViewportSize = {
  width: number;
  height: number;
  scale: number;
  fontScale: number;
};
// The same snapshot is used for server HTML and the first hydration render.
// Browser measurements are published only after React subscribes.
const serverViewport: ViewportSize = {
  width: 480,
  height: 800,
  scale: 1,
  fontScale: 1,
};
let browserViewport = serverViewport;
const listeners = new Set<() => void>();
function measureViewport() {
  const next = getViewport();
  document.documentElement.style.setProperty(
    "--app-height",
    `${next.height}px`,
  );
  const computed = getComputedStyle(document.documentElement);
  const nextInsets = {
    top: parseFloat(computed.getPropertyValue("--safe-area-inset-top")) || 0,
    right:
      parseFloat(computed.getPropertyValue("--safe-area-inset-right")) || 0,
    bottom:
      parseFloat(computed.getPropertyValue("--safe-area-inset-bottom")) || 0,
    left: parseFloat(computed.getPropertyValue("--safe-area-inset-left")) || 0,
  };
  if (
    next.width === browserViewport.width &&
    next.height === browserViewport.height &&
    next.scale === browserViewport.scale &&
    Object.entries(nextInsets).every(
      ([edge, value]) =>
        browserInsets[edge as keyof typeof browserInsets] === value,
    )
  )
    return;
  browserViewport = next;
  browserInsets = nextInsets;
  listeners.forEach((listener) => listener());
}
function subscribeViewport(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("resize", measureViewport);
    window.visualViewport?.addEventListener("resize", measureViewport);
  }
  measureViewport();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      window.removeEventListener("resize", measureViewport);
      window.visualViewport?.removeEventListener("resize", measureViewport);
    }
  };
}
export function getViewport(scope: "window" | "screen" = "window") {
  const width = typeof window === "undefined" ? 480 : window.innerWidth;
  const height =
    typeof window === "undefined"
      ? 800
      : (window.visualViewport?.height ?? window.innerHeight);
  return {
    width: scope === "window" ? Math.min(width, 480) : width,
    height,
    scale: typeof window === "undefined" ? 1 : window.devicePixelRatio,
    fontScale: 1,
  };
}
export function useViewport() {
  return useSyncExternalStore(
    subscribeViewport,
    () => browserViewport,
    () => serverViewport,
  );
}
const serverInsets = { top: 0, right: 0, bottom: 0, left: 0 };
let browserInsets = serverInsets;
export function useBrowserSafeAreaInsets() {
  return useSyncExternalStore(
    subscribeViewport,
    () => browserInsets,
    () => serverInsets,
  );
}
export function ViewportSync() {
  useViewport();
  return null;
}
export function useSystemColorScheme() {
  const [scheme, setScheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const change = () => setScheme(media.matches ? "dark" : "light");
    change();
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return scheme;
}
