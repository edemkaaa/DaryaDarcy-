/** Общие события проверки доступа связывают сетевые вызовы с провайдером сессии без прямой зависимости каждого запроса от React. */
type Listener = (status: 401 | 403) => void;
const listeners = new Set<Listener>();
/** Передаём отказ доступа подписанным владельцам сессии, не устанавливая гостя внутри сетевого слоя. */
export function requestSessionCheck(status: 401 | 403): void {
  for (const listener of listeners) listener(status);
}
/** Подписка возвращает симметричное отключение, чтобы размонтированный провайдер не получал чужие ошибки доступа. */
export function subscribeSessionChecks(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
