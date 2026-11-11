// Архив Expo. Настраивает старый batch-клиент с superjson, cookie и native Bearer; 15-секундный race не отменяет сам fetch.
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../backend/src/routers";
import { getApiBaseUrl } from "@/constants/oauth";
import * as Auth from "@/lib/_core/auth";

/**
 * tRPC React client for type-safe API calls.
 *
 * IMPORTANT (tRPC v11): The `transformer` must be inside `httpBatchLink`,
 * NOT at the root createClient level. This ensures client and server
 * use the same serialization format (superjson).
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Creates the tRPC client with proper configuration.
 * Call this once in your app's root layout.
 */
export function createTRPCClient() {
  // Настраивает старый batch-клиент с superjson, cookie и native Bearer; 15-секундный race не отменяет сам fetch.

  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${getApiBaseUrl()}/api/trpc`,
        // tRPC v11: transformer MUST be inside httpBatchLink, not at root
        transformer: superjson,
        async headers() {
          // Подставляет Bearer только если платформенное хранилище предоставляет токен.

          const token = await Auth.getSessionToken();
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        // Custom fetch to include credentials for cookie-based auth
        fetch(url, options) {
          // Добавляет credentials и ограничивает ожидание ответа Promise.race, очищая таймер после завершения.

          let timeoutId: ReturnType<typeof setTimeout> | undefined;
          const timeoutPromise = new Promise<Response>((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error("API request timed out")), 15000);
          });
          const fetchPromise = fetch(url, {
            ...options,
            credentials: "include",
          });
          return Promise.race([fetchPromise, timeoutPromise]).finally(() => {
            if (timeoutId) clearTimeout(timeoutId);
          });
        },
      }),
    ],
  });
}
