// Архив Expo. Включает доступные платформе ограничения жестов/скриншотов; это не серверная защита файлов.
import { useEffect } from "react";
import { Platform } from "react-native";

/**
 * Club posts: block copy/selection on web and screen recording on native.
 * Screenshots in a mobile browser cannot be fully blocked; this covers what the platform allows.
 */
export function useClubContentProtection(enabled: boolean) {
  // Включает доступные платформе ограничения жестов/скриншотов; это не серверная защита файлов.

  useEffect(() => {
    // При включении выбирает native screen-capture либо DOM-listeners; cleanup снимает ограничения и обрабатывает поздний import.

    if (!enabled) return;

    if (Platform.OS !== "web") {
      let cancelled = false;
      void import("expo-screen-capture").then((ScreenCapture) => {
        if (cancelled) return;
        void ScreenCapture.preventScreenCaptureAsync();
      });
      return () => {
        cancelled = true;
        void import("expo-screen-capture").then((ScreenCapture) => {
          void ScreenCapture.allowScreenCaptureAsync();
        });
      };
    }

    const root = typeof document !== "undefined" ? document.getElementById("root") : null;
    root?.classList.add("club-protected");
    document.body?.classList.add("club-protected");

    const isEditable = (target: EventTarget | null) => {
      // Сохраняет обычное выделение и ввод внутри настоящих editable-полей.

      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
    };
    const block = (event: Event) => {
      // Отменяет браузерное копирование/контекстное действие только вне полей ввода.

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
