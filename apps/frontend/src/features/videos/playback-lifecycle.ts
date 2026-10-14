/** Each return to a page needs new playback authority, including bfcache restores. */
export class PlaybackLifecycle {
  private initial = { visible: true, epoch: 0 };
  private snapshot = this.initial;
  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => this.initial;
  subscribe = (notify: () => void) => {
    const update = (visible: boolean) => {
      this.snapshot = { visible, epoch: this.snapshot.epoch + 1 };
      notify();
    };
    const hide = () => update(false);
    const resume = () => update(!document.hidden);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", resume);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    if (document.hidden) hide();
    return () => {
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", resume);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
    };
  };
}
