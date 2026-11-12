/** Сброс ждёт показа сохранённой панели, чтобы hidden не потерял команду прокрутки. */
export function finishSectionScrollReset(panel: HTMLElement) {
  if (panel.hidden || panel.dataset.sectionScrollReset !== "true") return;
  panel
    .querySelectorAll<HTMLElement>(".ui-scroll:not(.ui-scroll-horizontal)")
    .forEach((scroll) => {
      if (
        scroll.parentElement?.closest(".ui-scroll") ||
        scroll.closest('[role="dialog"], [data-scroll-header="ignore"]')
      )
        return;
      if (scroll.hasAttribute("data-windowed-collection"))
        scroll.dataset.collectionScrollTarget = "start";
      scroll.scrollTo({ top: 0, behavior: "instant" });
    });
  delete panel.dataset.sectionScrollReset;
}

/** Вызывается только onNavigate явных ссылок разделов; Back и новые вкладки не затрагиваются. */
export function resetSectionScroll(path: string) {
  const panel = [
    ...document.querySelectorAll<HTMLElement>("[data-tab-screen]"),
  ].find((element) => element.dataset.tabScreen === path);
  if (!panel) return;
  panel.dataset.sectionScrollReset = "true";
  finishSectionScrollReset(panel);
}
