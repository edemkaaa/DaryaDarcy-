export type ScopedOperation = {
  signal: AbortSignal;
  isCurrent: () => boolean;
  assertCurrent: () => void;
  finish: () => void;
};

/** Synchronous lock and cancellation boundary for one editor or comment form. */
export class OperationScope {
  private current: { controller: AbortController; cleanup: () => void } | null =
    null;
  private kind: string | null = null;
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.kind;
  private emit() {
    for (const listener of this.listeners) listener();
  }
  cancel = () => {
    const current = this.current;
    this.current = null;
    this.kind = null;
    current?.cleanup();
    current?.controller.abort(
      new DOMException("Операция отменена", "AbortError"),
    );
    this.emit();
  };
  begin(
    kind: string,
    parentSignal: AbortSignal,
    ownsAccess: () => boolean,
  ): ScopedOperation | null {
    if (this.current || parentSignal.aborted || !ownsAccess()) return null;
    const controller = new AbortController();
    const current = {
      controller,
      cleanup: () => parentSignal.removeEventListener("abort", this.cancel),
    };
    this.current = current;
    this.kind = kind;
    parentSignal.addEventListener("abort", this.cancel, { once: true });
    this.emit();
    const isCurrent = () =>
      this.current === current && !controller.signal.aborted && ownsAccess();
    return {
      signal: controller.signal,
      isCurrent,
      assertCurrent: () => {
        if (!isCurrent())
          throw new DOMException("Операция отменена", "AbortError");
      },
      finish: () => {
        if (this.current !== current) return;
        current.cleanup();
        this.current = null;
        this.kind = null;
        this.emit();
      },
    };
  }
}
