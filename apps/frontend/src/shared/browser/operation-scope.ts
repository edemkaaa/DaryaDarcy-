/** Каждая асинхронная операция получает право применить результат только пока её область актуальна; finish не завершает чужую новую задачу. */
export type ScopedOperation = {
  signal: AbortSignal;
  isCurrent: () => boolean;
  assertCurrent: () => void;
  finish: () => void;
};

/** Synchronous lock and cancellation boundary for one editor or comment form. */
// Область удерживает одну текущую задачу; старый finally не должен сбросить более новую операцию.
export class OperationScope {
  private current: { controller: AbortController; cleanup: () => void } | null =
    null;
  private kind: string | null = null;
  private listeners = new Set<() => void>();
  /** Подписчик получает изменения kind; возвращённая функция снимает только его собственное наблюдение. */
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  /** Стабильный snapshot позволяет useSyncExternalStore читать текущий вид операции без копирования контроллера. */
  getSnapshot = () => this.kind;
  /** Уведомляем всех подписчиков после изменения области, сохраняя один источник busy-состояния. */
  private emit() {
    for (const listener of this.listeners) listener();
  }
  /** Сначала снимаем владение и parent listener, затем abort и уведомление: поздний finally отменённой задачи не затронет следующую. */
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
  /** Занятая или лишённая доступа область не выдаёт задачу; успешный begin связывает новый AbortController с parent-сессией. */
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
    /** Применение результата требует совпадения экземпляра задачи, живого signal и всё ещё действующих прав владельца. */
    const isCurrent = () =>
      this.current === current && !controller.signal.aborted && ownsAccess();
    return {
      signal: controller.signal,
      isCurrent,
      /** Преобразуем потерю владения в AbortError до очередной записи состояния или следующего сетевого шага. */
      assertCurrent: () => {
        if (!isCurrent())
          throw new DOMException("Операция отменена", "AbortError");
      },
      /** Завершаем только свой экземпляр задачи и снимаем parent listener; новая операция уже может владеть той же областью. */
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
