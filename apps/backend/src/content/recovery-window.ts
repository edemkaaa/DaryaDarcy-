import { TRPCError } from "@trpc/server";

const RECOVERY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Expire recovery, not the material or its live attachment read evidence. */
export function assertContentRecoveryWindow(createdAt: Date): void {
  if (process.env.CONTENT_RECOVERY_RETENTION_ENABLED !== "true") return;
  const recordedAt = createdAt instanceof Date ? createdAt.getTime() : NaN;
  const now = Date.now();
  if (!Number.isFinite(recordedAt) || !Number.isFinite(now))
    throw new TRPCError({
      code: "SERVICE_UNAVAILABLE",
      message: "Восстановление временно недоступно",
    });
  if (now >= recordedAt + RECOVERY_WINDOW_MS)
    throw new TRPCError({
      code: "CONFLICT",
      message: "Срок восстановления истёк",
    });
}
