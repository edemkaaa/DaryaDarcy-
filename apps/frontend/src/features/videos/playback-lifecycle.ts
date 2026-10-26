const RESUME_CHECK_COOLDOWN_MS = 1000;

/** Each return to a page needs new playback authority, including bfcache restores. */
export class PlaybackLifecycle {
  private initial = { visible: true, epoch: 0 };
  private snapshot = this.initial;
  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => this.initial;
  subscribe = (notify: () => void) => {
    let lastResume = -Infinity;
    let focusStayedInPage = false;
    const update = (visible: boolean) => {
      this.snapshot = { visible, epoch: this.snapshot.epoch + 1 };
      notify();
    };
    const resetResume = () => {
      lastResume = -Infinity;
    };
    const hide = () => {
      focusStayedInPage = false;
      resetResume();
      if (this.snapshot.visible) update(false);
    };
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
    const onResume = () => resume();
    const onBlur = () => {
      // Focusing a cross-origin player blurs the parent window, but the
      // document (including its iframe descendants) still has focus.
      focusStayedInPage = !document.hidden && document.hasFocus();
      if (!focusStayedInPage) resetResume();
    };
    const onFocus = () => {
      if (focusStayedInPage && !document.hidden) {
        focusStayedInPage = false;
        return;
      }
      resume();
    };
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
