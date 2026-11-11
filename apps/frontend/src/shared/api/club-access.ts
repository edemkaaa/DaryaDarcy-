/** Ответ подписки проверяем отдельно от результата покупки: исторически успешный заказ не подтверждает текущий доступ. */
import type { ApiOutputs } from "./types";
import { invalidResponse } from "./errors";

/** Проверяем признаки прав, оплаты и отмены отдельно, приводя срок к Date без вывода доступа из одной только даты. */
export function parseClubAccess(
  value: unknown,
): ApiOutputs["club"]["subscription"] {
  if (!value || typeof value !== "object") throw invalidResponse();
  const data = value as Record<string, unknown>;
  if (
    typeof data.hasClubAccess !== "boolean" ||
    typeof data.subscribed !== "boolean" ||
    typeof data.cancelAtPeriodEnd !== "boolean" ||
    (data.cancellationStatus !== "none" &&
      data.cancellationStatus !== "pending" &&
      data.cancellationStatus !== "confirmed") ||
    typeof data.isOwner !== "boolean" ||
    typeof data.monthlyPrice !== "string" ||
    !data.monthlyPrice.trim()
  )
    throw invalidResponse();
  const raw = data.expiresAt;
  if (raw !== null && !(raw instanceof Date) && typeof raw !== "string")
    throw invalidResponse();
  const expiresAt = raw === null ? null : new Date(raw as string | Date);
  if (
    (expiresAt && !Number.isFinite(expiresAt.getTime())) ||
    (data.subscribed && !data.isOwner && !expiresAt)
  )
    throw invalidResponse();
  return {
    hasClubAccess: data.hasClubAccess,
    subscribed: data.subscribed,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd,
    cancellationStatus: data.cancellationStatus,
    isOwner: data.isOwner,
    monthlyPrice: data.monthlyPrice,
    expiresAt,
  };
}

/** У claim должны согласоваться granted и orderId: отказ не может притворяться подтверждённым заказом. */
export function requireClubClaim(value: unknown): void {
  const data = value as { granted?: unknown; orderId?: unknown } | null;
  if (
    !data ||
    typeof data.granted !== "boolean" ||
    (data.granted
      ? typeof data.orderId !== "string" || !data.orderId.trim()
      : data.orderId !== null)
  )
    throw invalidResponse();
}
