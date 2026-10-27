"use client";
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink, httpLink, splitLink } from "@trpc/client";
import superjson from "superjson";
import { z } from "zod";
import type { AppRouter } from "./contract";
import { fetchApiResponse } from "./request-lifecycle";
import { userFacingErrorsLink } from "./user-facing-errors-link";
import { operationAbortLink } from "./operation-abort-link";
import { getApiBaseUrl } from "@/shared/config/api";
/**
 * tRPC React client for type-safe API calls.
 *
 * IMPORTANT (tRPC v11): The `transformer` must be inside the HTTP links,
 * NOT at the root createClient level. This ensures client and server
 * use the same serialization format (superjson).
 */
export const trpc = createTRPCReact<AppRouter>();
/**
 * Creates the tRPC client with proper configuration.
 * Call this once in your app's root layout.
 */
export function createTRPCClient() {
  return trpc.createClient({
    links: [
      userFacingErrorsLink,
      operationAbortLink,
      splitLink({
        // A per-operation key cannot safely be shared by a request batch.
        condition: (op) => op.context.idempotencyKey !== undefined,
        true: httpLink({
          url: `${getApiBaseUrl()}/api/trpc`,
          transformer: superjson,
          fetch: fetchApiResponse,
          headers: ({ op }) => {
            const key = z.uuidv4().safeParse(op.context.idempotencyKey);
            if (op.type !== "mutation" || !key.success)
              throw new Error("Некорректная заявка. Запрос не отправлен.");
            return { "Idempotency-Key": key.data };
          },
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
    ],
  });
}
