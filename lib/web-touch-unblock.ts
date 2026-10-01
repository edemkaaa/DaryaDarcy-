import { Platform } from "react-native";
import { disableAriaHiddenTabScenes } from "@/lib/web-tab-scene-fix";

/** Light touch fix: only disable pointer events on aria-hidden layers. */
export function runWebTouchUnblock(_pathname?: string): void {
  if (Platform.OS !== "web" || typeof document === "undefined") return;

  document.getElementById("dd-boot-layer")?.remove();

  const root = document.getElementById("root");
  if (root) {
    root.style.pointerEvents = "auto";
    root.style.touchAction = "manipulation";
  }

  disableAriaHiddenTabScenes();
}

export function installWebTouchUnblock(): void {
  if (Platform.OS !== "web" || typeof document === "undefined") return;

  runWebTouchUnblock();
  document.addEventListener("DOMContentLoaded", () => runWebTouchUnblock());
  window.addEventListener("load", () => runWebTouchUnblock());
}
