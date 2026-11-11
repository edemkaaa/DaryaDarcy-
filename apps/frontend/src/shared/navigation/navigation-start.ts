/** Уведомляем об уходе до фиксации нового маршрута, чтобы старая страница больше не владела отложенным перенаправлением. */
export const navigationStartEvent = "darcy:navigation-start";

/** Revoke page-owned redirects before Next commits the destination route. */
export function notifyNavigationStart(destination?: string) {
  if (typeof window !== "undefined")
    window.dispatchEvent(
      new CustomEvent(navigationStartEvent, { detail: destination }),
    );
}

export function watchCheckoutDeparture(cancel: () => void) {
  const leaving = (destination?: string) => {
    if (!destination) return cancel();
    const url = new URL(destination, window.location.href);
    if (url.origin !== window.location.origin || url.pathname !== "/club")
      cancel();
  };
  const navigation = (event: Event) =>
    leaving((event as CustomEvent<string | undefined>).detail);
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
