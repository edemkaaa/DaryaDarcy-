"use client";
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink, httpLink, splitLink } from "@trpc/client";
import superjson from "superjson";
import { z } from "zod";
import type { AppRouter } from "./contract";
import { fetchApiResponse, fetchUploadResponse } from "./request-lifecycle";
import { userFacingErrorsLink } from "./user-facing-errors-link";
import { operationAbortLink } from "./operation-abort-link";
import { readResponseLink } from "./read-response-link";
import { getApiBaseUrl } from "@/shared/config/api";
/**
 * tRPC React client for type-safe API calls.
 *
 * IMPORTANT (tRPC v11): The `transformer` must be inside the HTTP links,
 * NOT at the root createClient level. This ensures client and server
 * use the same serialization format (superjson).
 */
export const trpc = createTRPCReact<AppRouter>();
const fileUploads = new Set([
  "admin.uploadPrivateContentFile",
  "admin.uploadPrivateAttachment",
  "admin.uploadPublicCover",
  "profile.uploadAvatarWithReceipt",
  "club.uploadPrivateCommentPhoto",
  "admin.uploadMedia",
]);

function operationHeaders(op: {
  type: string;
  context: Record<string, unknown>;
}): Record<string, string> {
  if (op.context.idempotencyKey === undefined) return {};
  const key = z.uuidv4().safeParse(op.context.idempotencyKey);
  if (op.type !== "mutation" || !key.success)
    throw new Error("Некорректная заявка. Запрос не отправлен.");
  return { "Idempotency-Key": key.data };
}
/**
 * Creates the tRPC client with proper configuration.
 * Call this once in your app's root layout.
 */
export function createTRPCClient() {
  return trpc.createClient({
    links: [
      userFacingErrorsLink,
      operationAbortLink,
      readResponseLink,
      splitLink({
        condition: (op) => op.type === "mutation" && fileUploads.has(op.path),
        // Keep the existing batch wire envelope, with exactly one file per HTTP
        // request and its own deadline. No file can hold up another operation.
        true: httpBatchLink({
          maxItems: 1,
          url: `${getApiBaseUrl()}/api/trpc`,
          transformer: superjson,
          fetch: fetchUploadResponse,
          headers: ({ opList }) => operationHeaders(opList[0]),
        }),
        false: splitLink({
          // A per-operation key cannot safely be shared by a request batch.
          condition: (op) => op.context.idempotencyKey !== undefined,
          true: httpLink({
            url: `${getApiBaseUrl()}/api/trpc`,
            transformer: superjson,
            fetch: fetchApiResponse,
            headers: ({ op }) => operationHeaders(op),
          }),
          false: splitLink({
            // Guest recovery proofs must stay in one POST body, never a batch or URL.
            condition: (op) =>
              op.path === "club.createGuestNormalCheckout" ||
              op.path === "club.guestNormalCheckoutStatus",
            true: httpLink({
              url: `${getApiBaseUrl()}/api/trpc`,
              transformer: superjson,
              fetch: fetchApiResponse,
            }),
            false: splitLink({
              // The calendar sends up to 62 day intervals in one query (~6.6 KB).
              // It cannot fit the ordinary batch limit and must travel alone.
              condition: (op) =>
                op.type === "query" && op.path === "admin.postCalendar",
              true: httpBatchLink({
                maxItems: 1,
                maxURLLength: 8192,
                url: `${getApiBaseUrl()}/api/trpc`,
                transformer: superjson,
                fetch: fetchApiResponse,
              }),
              false: httpBatchLink({
                maxItems: 20,
                maxURLLength: 2048,
                url: `${getApiBaseUrl()}/api/trpc`,
                transformer: superjson,
                fetch: fetchApiResponse,
              }),
            }),
          }),
        }),
      }),
    ],
  });
}
