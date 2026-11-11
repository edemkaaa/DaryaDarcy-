// Архив Expo. Объединяет повторные click/press в пределах 400 мс; это локальная защита жеста, не идемпотентность записи.
import { Platform } from "react-native";
import { isAppleMobileWeb } from "@/lib/device";

type PressFn = () => void;

function dedupePress<Args extends unknown[]>(fn: (...args: Args) => void): (...args: Args) => void {
  // Объединяет повторные click/press в пределах 400 мс; это локальная защита жеста, не идемпотентность записи.

  let last = 0;
  return (...args: Args) => {
    const now = Date.now();
    if (now - last < 400) return;
    last = now;
    fn(...args);
  };
}

/** iOS Safari/PWA often ignores RN Web `onPress` — add click fallback. */
export function pressableProps<Args extends unknown[]>(onPress: (...args: Args) => void) {
  // Добавляет click fallback только Apple mobile web, оставляя остальные платформы на onPress.

  if (Platform.OS !== "web" || !isAppleMobileWeb()) {
    return { onPress };
  }
  const handler = dedupePress(onPress);
  return {
    onPress: handler,
    onClick: handler,
  } as const;
}

/** Rich-text toolbar: keep textarea selection when tapping Ж/К/🔗 on touch devices. */
export function formatToolbarProps(onAction: PressFn, beforeAction?: () => void) {
  // Сохраняет выделение textarea перед форматированием и устраняет двойное touch/click действие.

  const run = dedupePress(() => {
    beforeAction?.();
    onAction();
  });

  if (Platform.OS !== "web") {
    return { onPressIn: run };
  }

  if (isAppleMobileWeb()) {
    return {
      onTouchStart: (e: { preventDefault: () => void }) => {
        // Отменяет перенос фокуса и заранее запоминает выделение до основного действия.

        e.preventDefault();
        beforeAction?.();
      },
      onPress: run,
      onClick: run,
    } as const;
  }

  return {
    onMouseDown: (e: { preventDefault: () => void }) => /* На desktop web не даёт кнопке забрать фокус у редактируемого текста. */ e.preventDefault(),
    onPress: run,
  } as const;
}
