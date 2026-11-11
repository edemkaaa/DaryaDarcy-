/** Уведомляем об уходе до фиксации нового маршрута, чтобы старая страница больше не владела отложенным перенаправлением. */
export const navigationStartEvent = "darcy:navigation-start";

/** Сообщаем страницам о переходе до завершения Next-навигации; на сервере браузерное событие не создаётся. */
export function notifyNavigationStart(destination?: string) {
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent(navigationStartEvent, { detail: destination }),
    );
}

/** Отзываем право checkout на отложенный redirect при уходе с /club; переход в новой вкладке и download не считаются уходом текущей страницы. */
export function watchCheckoutDeparture(cancel: () => void) {
  /** Переход внутри /club может сохранять намерение, любой другой origin/раздел отменяет текущего владельца результата. */
  const leaving = (destination?: string) => {
    if (!destination) return cancel();
    const url = new URL(destination, window.location.href);
    if (url.origin !== window.location.origin || url.pathname !== "/club")
      cancel();
  };
  const navigation = (event: Event) =>
    leaving((event as CustomEvent<string | undefined>).detail);
  /** Обрабатываем только обычную активированную ссылку в этой вкладке; модификаторы и уже отменённые клики оставляем браузеру. */
  const click = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const anchor =
      event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (
      !(anchor instanceof HTMLAnchorElement) ||
      anchor.download ||
      (anchor.target && anchor.target !== "_self")
    )
      return;
    leaving(anchor.href);
  };
  /** У popstate нет целевого href текущей команды, поэтому возврат консервативно отзывает отложенное перенаправление. */
  const back = () => leaving();
  document.addEventListener("click", click, true);
  window.addEventListener(navigationStartEvent, navigation);
  window.addEventListener("popstate", back);
  return () => {
    document.removeEventListener("click", click, true);
    window.removeEventListener(navigationStartEvent, navigation);
    window.removeEventListener("popstate", back);
  };
}
