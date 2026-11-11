/** Небольшие валидаторы подтверждают результат мутации до изменения локального интерфейса. */
import { invalidResponse } from "./errors";

export function requireOk(result: unknown): void {
  if (
    !result ||
    typeof result !== "object" ||
    (result as { ok?: unknown }).ok !== true
  )
    throw invalidResponse();
}
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

export function requireIdList(
  result: unknown,
): asserts result is { id: number }[] {
  if (
    !Array.isArray(result) ||
    result.some((row) => !row || !Number.isSafeInteger(row.id) || row.id <= 0)
  )
    throw invalidResponse();
}

/** A malformed list cannot prove that deletion succeeded. */
export function requireAbsentId(result: unknown, id: number): void {
  requireIdList(result);
  if (result.some((row) => row.id === id)) throw invalidResponse();
}
