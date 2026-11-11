/** Небольшие валидаторы подтверждают результат мутации до изменения локального интерфейса. */
import { invalidResponse } from "./errors";

/** Успехом мутации считаем явное ok=true в объекте, а не любой ответ с HTTP 200. */
export function requireOk(result: unknown): void {
  if (
    !result ||
    typeof result !== "object" ||
    (result as { ok?: unknown }).ok !== true
  )
    throw invalidResponse();
}
/** Подтверждение отметки должно содержать и булев результат, и допустимый счётчик: частичный ответ нельзя применить к карточке. */
export function requireCommentLike(result: unknown): void {
  const value = result as { liked?: unknown; likeCount?: unknown } | null;
  if (
    !value ||
    typeof value.liked !== "boolean" ||
    !Number.isSafeInteger(value.likeCount) ||
    (value.likeCount as number) < 0
  )
    throw invalidResponse();
}
/** Проверяем успешную выдачу доступа с будущим ISO-сроком; malformed дата не превращается в визуально активную подписку. */
export function requireGrant(result: unknown): void {
  requireOk(result);
  const date = (result as { expiresAt?: unknown }).expiresAt;
  if (
    typeof date !== "string" ||
    !Number.isFinite(Date.parse(date)) ||
    Date.parse(date) <= Date.now()
  )
    throw invalidResponse();
}

/** Сначала подтверждаем структуру всего списка, чтобы дальнейшая проверка отсутствия ID не использовала повреждённые данные. */
export function requireIdList(
  result: unknown,
): asserts result is { id: number }[] {
  if (
    !Array.isArray(result) ||
    result.some((row) => !row || !Number.isSafeInteger(row.id) || row.id <= 0)
  )
    throw invalidResponse();
}

/** Отсутствие удалённой записи принимаем только в проверенном списке; нераспознанный ответ не подтверждает удаление. */
export function requireAbsentId(result: unknown, id: number): void {
  requireIdList(result);
  if (result.some((row) => row.id === id)) throw invalidResponse();
}
