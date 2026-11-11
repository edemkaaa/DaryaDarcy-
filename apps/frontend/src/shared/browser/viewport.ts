"use client";
/** Размер видимой области и safe-area обновляются через браузерные события; начальное значение пригодно для серверного рендера. */
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
let browserScreenViewport = serverViewport;
const listeners = new Set<() => void>();
/** Отдельный CSS-offset учитывает iOS-панорамирование visualViewport над клавиатурой даже без нового resize. */
function measureViewportOffset() {
  // iOS can pan the visual viewport above its keyboard without resizing again.
  document.documentElement.style.setProperty(
    "--visual-viewport-top",
    `${window.visualViewport?.offsetTop ?? 0}px`,
  );
}
/** Обновляем app-height, измерения окна и safe-area согласованно; одинаковые значения не вызывают лишних уведомлений подписчиков. */
function measureViewport() {
  measureViewportOffset();
  const nextScreen = getViewport("screen");
  const next = { ...nextScreen, width: Math.min(nextScreen.width, 480) };
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
    nextScreen.width === browserScreenViewport.width &&
    next.height === browserViewport.height &&
    next.scale === browserViewport.scale &&
    Object.entries(nextInsets).every(
      ([edge, value]) =>
        browserInsets[edge as keyof typeof browserInsets] === value,
    )
  )
    return;
  browserViewport = next;
  browserScreenViewport = nextScreen;
  browserInsets = nextInsets;
  listeners.forEach((listener) => listener());
}
/** Глобальные resize/visualViewport listeners существуют, пока есть хотя бы один потребитель; последний cleanup удаляет их. */
function subscribeViewport(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("resize", measureViewport);
    window.visualViewport?.addEventListener("resize", measureViewport);
    window.visualViewport?.addEventListener("scroll", measureViewportOffset);
  }
  measureViewport();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      window.removeEventListener("resize", measureViewport);
      window.visualViewport?.removeEventListener("resize", measureViewport);
      window.visualViewport?.removeEventListener(
        "scroll",
        measureViewportOffset,
      );
    }
  };
}
/** Window-scope ограничен макетом 480px, screen-scope нужен полноэкранному медиа; layout viewport помогает пережить iOS rotation overflow. */
export function getViewport(scope: "window" | "screen" = "window") {
  // Mobile WebKit can keep innerWidth enlarged by old, overflowing content
  // after rotation. Use the layout viewport so that content can shrink again.
  const width =
    typeof window === "undefined"
      ? 480
      : document.documentElement.clientWidth || window.innerWidth;
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
/** Возвращаем стабильный external-store snapshot с единым SSR-значением, не измеряя DOM прямо во время hydration-рендера. */
export function useViewport(scope: "window" | "screen" = "window") {
  return useSyncExternalStore(
    subscribeViewport,
    () => (scope === "screen" ? browserScreenViewport : browserViewport),
    () => serverViewport,
  );
}
const serverInsets = { top: 0, right: 0, bottom: 0, left: 0 };
let browserInsets = serverInsets;
/** Safe-area использует тот же цикл измерения, что viewport, и нулевой серверный snapshot. */
export function useBrowserSafeAreaInsets() {
  return useSyncExternalStore(
    subscribeViewport,
    () => browserInsets,
    () => serverInsets,
  );
}
/** Постоянный невидимый подписчик поддерживает CSS app-height и safe-area даже когда конкретный экран не читает размеры. */
export function ViewportSync() {
  useViewport();
  return null;
}
/** После монтирования читаем prefers-color-scheme и подписываемся на смену; начальное light сохраняет согласованный SSR. */
export function useSystemColorScheme() {
  const [scheme, setScheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    /** MediaQueryList — источник текущего предпочтения; cleanup эффекта снимает ровно этот обработчик change. */
    const change = () => setScheme(media.matches ? "dark" : "light");
    change();
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return scheme;
}
