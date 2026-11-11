/** Архивный типизированный tRPC-клиент Vite с cookie и SuperJSON. */
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../../backend/src/routers";

export const trpc = createTRPCReact<AppRouter>();

/** Использует относительный /api/trpc и передаёт cookie каждого запроса; серверный роутер импортируется только как тип. */
export function makeTrpcClient() {
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: "/api/trpc",
        transformer: superjson,
        /** Дополняет транспорт tRPC credentials=include, не меняя остальные параметры запроса. */
        fetch(url, options) {
          return fetch(url, { ...options, credentials: "include" });
        },
      }),
    ],
  });
}
