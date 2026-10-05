import { Platform } from "react-native";

/** Legacy no-op — DOM tab patching removed after production regressions. */
export function patchTabSceneShell(_el: HTMLElement | null, _isFocused: boolean): void {}

export function disableAriaHiddenTabScenes(): void {
  if (Platform.OS !== "web" || typeof document === "undefined") return;

  document.querySelectorAll('#root [aria-hidden="true"]').forEach((node) => {
    const el = node as HTMLElement;
    if (el.closest("#dd-tab-bar")) return;
    if (el.id === "dd-boot-overlay" || el.closest("#dd-boot-overlay")) return;
    el.style.pointerEvents = "none";
    el.style.touchAction = "none";
  });
}

export function sweepGhostTabLayersForPath(_pathname?: string): void {}

export function reconcileWebTabScenes(_pathname?: string): void {
  disableAriaHiddenTabScenes();
}
