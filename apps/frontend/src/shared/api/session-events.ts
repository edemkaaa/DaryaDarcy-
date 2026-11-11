/** Общие события проверки доступа связывают сетевые вызовы с провайдером сессии без прямой зависимости каждого запроса от React. */
type Listener = (status: 401 | 403) => void;
const listeners = new Set<Listener>();
/** A failed protected request asks the session owner to recheck identity. */
export function requestSessionCheck(status: 401 | 403): void {
  for (const listener of listeners) listener(status);
}
export function subscribeSessionChecks(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
