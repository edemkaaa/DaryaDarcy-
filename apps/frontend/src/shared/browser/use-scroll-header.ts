"use client";
/** Наблюдение за областями прокрутки обновляет состояние шапки без перерисовки всей страницы на каждом событии. */
import { useLayoutEffect, useRef } from "react";
import { ScrollHeaderState } from "./scroll-header-state";

/** Наблюдаем корневую вертикальную область активного экрана; состояние шапки меняем через DOM без React-рендера на каждый scroll. */
export function useScrollHeader(path: string, hideOnScroll = true) {
  const headerRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const header = headerRef.current;
    const content = contentRef.current;
    if (!header || !content) return;
    const state = new ScrollHeaderState();
    let screen: HTMLElement | null = null;
    /** Шапка не скрывается под видимым клавиатурным фокусом; inert синхронизируется с её фактической доступностью. */
    const setHidden = (hidden: boolean) => {
      // Keep keyboard focus accessible; a clicked link must not pin the header.
      const focused = document.activeElement;
      const keyboardFocus =
        focused instanceof HTMLElement &&
        header.contains(focused) &&
        focused.matches(":focus-visible");
      const hide = hidden && !keyboardFocus;
      if (header.dataset.hidden === String(hide)) return;
      header.dataset.hidden = String(hide);
      header.inert = hide;
    };
    setHidden(false);
    if (!hideOnScroll) return;
    /** Вложенные карусели, диалоги и inert-панели не управляют общей шапкой; нужен верхний вертикальный scroll контейнер. */
    const isScreen = (target: HTMLElement) =>
      target.matches(".ui-scroll:not(.ui-scroll-horizontal)") &&
      !target.closest(
        '[data-scroll-header="ignore"], [role="dialog"], [inert]',
      ) &&
      !target.parentElement?.closest(".ui-scroll");
    /** После асинхронной замены экрана заново выбираем scroll-root и сбрасываем историю направления. */
    const syncScreen = () => {
      if (screen?.isConnected && isScreen(screen)) return;
      screen =
        [...content.querySelectorAll<HTMLElement>(".ui-scroll")].find(
          isScreen,
        ) ?? null;
      state.reveal(screen?.scrollTop ?? 0);
      setHidden(false);
    };
    syncScreen();
    // Async session/data gates can replace a screen without changing its route.
    const observer = new MutationObserver(syncScreen);
    observer.observe(content, { childList: true, subtree: true });
    /** Новая область получает собственную базовую позицию, после чего пороги состояния решают скрытие шапки. */
    const onScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !isScreen(target)) return;
      if (screen !== target) {
        screen = target;
        // A restored scroll position is the baseline for this screen.
        state.reveal(target.scrollTop);
      }
      setHidden(
        state.update(
          target.scrollTop,
          target.scrollHeight - target.clientHeight,
        ),
      );
    };
    /** Клавиатурная навигация раскрывает шапку, если сам экран не заблокирован диалогом. */
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || content.closest("[inert]")) return;
      state.reveal(screen?.scrollTop ?? 0);
      setHidden(false);
    };
    // Element scroll events do not bubble; capture also covers late-mounted screens.
    content.addEventListener("scroll", onScroll, {
      capture: true,
      passive: true,
    });
    document.addEventListener("keydown", onKeyDown);
    return () => {
      observer.disconnect();
      content.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [path, hideOnScroll]);
  return { headerRef, contentRef };
}
