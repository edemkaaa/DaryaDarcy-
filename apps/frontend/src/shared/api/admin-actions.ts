import { z } from "zod";
import type { TRPCClient } from "@trpc/client";
import type { AppRouter } from "./contract";
import {
  adminActionKey,
  adminActionOutcome,
  type AdminActionKind,
  type AdminActionOutcome,
} from "@shared/admin-action";
import { invalidResponse, ApiError } from "./errors";
import { resendAccessEmail } from "./access-email";

export type AdminActionRequest = {
  idempotencyKey: string;
  kind: AdminActionKind;
  userId: number;
};
export type AdminActionStatus = AdminActionOutcome | { state: "notFound" };
export type AdminActionApi = {
  status(
    request: AdminActionRequest,
    signal: AbortSignal,
  ): Promise<AdminActionStatus>;
  write(
    request: AdminActionRequest,
    signal: AbortSignal,
  ): Promise<AdminActionOutcome>;
};
const requestSchema = z.object({
  idempotencyKey: adminActionKey,
  kind: z.enum(["grantClub", "resendAccessEmail"]),
  userId: z.number().int().positive().safe(),
});
const statusSchema = z.union([
  adminActionOutcome,
  z.object({ state: z.literal("notFound") }).strict(),
]);

export function parseAdminActionStatus(
  value: unknown,
  request: AdminActionRequest,
): AdminActionStatus {
  const result = statusSchema.safeParse(value);
  if (
    !result.success ||
    (result.data.state !== "notFound" &&
      (result.data.kind !== request.kind ||
        result.data.userId !== request.userId))
  )
    throw invalidResponse();
  return result.data;
}

export function adminActionApi(client: TRPCClient<AppRouter>): AdminActionApi {
  return {
    async status(request, signal) {
      requestSchema.parse(request);
      return parseAdminActionStatus(
        await client.admin.actionStatus.query(
          { idempotencyKey: request.idempotencyKey },
          { signal },
        ),
        request,
      );
    },
    async write(request, signal) {
      if (!requestSchema.safeParse(request).success) throw invalidResponse();
      signal.throwIfAborted();
      if (request.kind === "resendAccessEmail") {
        await resendAccessEmail(request.userId, signal, request.idempotencyKey);
        return {
          state: "succeeded",
          kind: request.kind,
          userId: request.userId,
          queued: true,
        };
      }
      const result = z
        .object({ ok: z.literal(true), expiresAt: z.iso.datetime() })
        .safeParse(
          await client.admin.grantClub.mutate(
            { userId: request.userId, idempotencyKey: request.idempotencyKey },
            { signal },
          ),
        );
      if (!result.success) throw invalidResponse();
      return {
        state: "succeeded",
        kind: request.kind,
        userId: request.userId,
        expiresAt: result.data.expiresAt,
      };
    },
  };
}

export function adminActionRetryAt(error: unknown): number | undefined {
  const value = error as {
    retryAfterSec?: unknown;
    meta?: { retryAfterSec?: unknown };
    cause?: unknown;
  } | null;
  const seconds =
    error instanceof ApiError
      ? error.retryAfterSec
      : value?.cause instanceof ApiError
        ? value.cause.retryAfterSec
        : value?.meta?.retryAfterSec;
  if (
    typeof seconds !== "number" ||
    !Number.isSafeInteger(seconds) ||
    seconds <= 0
  )
    return;
  const until = Date.now() + seconds * 1000;
  return Number.isSafeInteger(until) ? until : undefined;
}
