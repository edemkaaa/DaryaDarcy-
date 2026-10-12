import type { ApiOutputs } from "./types";
import { invalidResponse } from "./errors";

/** Keep content access separate from payment; legacy replies never infer staff access. */
export function parseClubAccess(
  value: unknown,
): ApiOutputs["club"]["subscription"] {
  if (!value || typeof value !== "object") throw invalidResponse();
  const data = value as Record<string, unknown>;
  const hasClubAccess = data.hasClubAccess ?? data.subscribed;
  if (
    typeof data.subscribed !== "boolean" ||
    typeof data.cancelAtPeriodEnd !== "boolean" ||
    typeof data.isOwner !== "boolean" ||
    typeof data.monthlyPrice !== "string" ||
    !data.monthlyPrice.trim() ||
    (data.hasClubAccess !== undefined &&
      typeof data.hasClubAccess !== "boolean") ||
    typeof hasClubAccess !== "boolean" ||
    (!hasClubAccess && (data.subscribed || data.isOwner))
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
    hasClubAccess,
    subscribed: data.subscribed,
    cancelAtPeriodEnd: data.cancelAtPeriodEnd,
    isOwner: data.isOwner,
    monthlyPrice: data.monthlyPrice,
    expiresAt,
  };
}

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
