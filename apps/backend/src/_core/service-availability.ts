import { ServiceUnavailableException } from "@nestjs/common";

export const SERVICE_UNAVAILABLE_MESSAGE =
  "Сервис временно недоступен. Попробуйте позже.";

/** Только известные отказы доступности; неизвестные ошибки остаются 500. */
export function isServiceUnavailable(error: unknown): boolean {
  let current = error;
  // Drizzle и tRPC оборачивают ошибку драйвера в cause. Ограничиваем обход,
  // чтобы повреждённая или циклическая цепочка не блокировала обработчик.
  for (let depth = 0; depth < 8 && current instanceof Error; depth++) {
    if (current instanceof ServiceUnavailableException) return true;
    // mysql2 выдаёт обычный Error без code при переполнении очереди пула.
    // Не ищем подстроку: SQL и сообщения доменных ошибок могут содержать её.
    if (current.message === "Queue limit reached.") return true;
    current = current.cause;
  }
  return false;
}
