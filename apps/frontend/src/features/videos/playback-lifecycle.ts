/** Каждый возврат к проигрыванию меняет эпоху проверки, включая восстановление страницы из bfcache. */
const RESUME_CHECK_COOLDOWN_MS = 1000;

/** Each return to a page needs new playback authority, including bfcache restores. */
export class PlaybackLifecycle {
  private initial = { visible: true, epoch: 0 };
  private snapshot = this.initial;
  /** Возвращаем стабильный snapshot видимости и эпохи до следующего события жизненного цикла. */
  getSnapshot = () => this.snapshot;
  /** SSR начинает с видимого нейтрального snapshot; реальный browser lifecycle подключится подпиской. */
  getServerSnapshot = () => this.initial;
  /** Одна подписка владеет listeners окна и видимости; возврат пользователя меняет эпоху authority-проверки. */
  subscribe = (notify: () => void) => {
    let lastResume = -Infinity;
    let focusStayedInPage = false;
    /** Любое принятое событие меняет epoch вместе с видимостью, заставляя получить новый playback-source. */
    const update = (visible: boolean) => {
      this.snapshot = { visible, epoch: this.snapshot.epoch + 1 };
      notify();
    };
    /** Реальный уход отменяет cooldown, чтобы ближайшее возвращение точно прошло проверку. */
    const resetResume = () => {
      lastResume = -Infinity;
    };
    /** Скрытие отзывает видимую authority и сбрасывает следы фокуса внутри iframe. */
    const hide = () => {
      focusStayedInPage = false;
      resetResume();
      if (this.snapshot.visible) update(false);
    };
    /** Объединяем парные focus/visibility события, но явный pageshow/online и реальное скрытие обходят cooldown. */
    const resume = (force = false) => {
      focusStayedInPage = false;
      if (document.hidden) return hide();
      const now = performance.now();
      // A fast reply can finish before the paired focus/visibility event arrives.
      // Actual hides, window departures, network recovery and bfcache bypass this.
      if (
        !force &&
        this.snapshot.visible &&
        now - lastResume < RESUME_CHECK_COOLDOWN_MS
      )
        return;
      lastResume = now;
      update(true);
    };
    /** Обычная смена видимости проходит через общий cooldown возврата. */
    const onResume = () => resume();
    // Фокус внутри cross-origin iframe тоже вызывает blur родителя; такой переход не равен уходу пользователя из страницы.
    /** Отличаем переход фокуса внутрь cross-origin плеера от настоящего ухода из документа. */
    const onBlur = () => {
      // Focusing a cross-origin player blurs the parent window, but the
      // document (including its iframe descendants) still has focus.
      focusStayedInPage = !document.hidden && document.hasFocus();
      if (!focusStayedInPage) resetResume();
    };
    /** Не пересоздаём iframe из-за возврата фокуса из самого плеера; настоящий возврат обновляет authority. */
    const onFocus = () => {
      if (focusStayedInPage && !document.hidden) {
        focusStayedInPage = false;
        return;
      }
      resume();
    };
    /** Восстановление сети и bfcache требуют безусловной новой проверки источника. */
    const recheck = () => resume(true);
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", recheck);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    window.addEventListener("online", recheck);
    if (document.hidden) hide();
    return () => {
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", recheck);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("online", recheck);
    };
  };
}
