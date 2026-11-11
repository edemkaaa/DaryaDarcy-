/** Архивные провайдеры tRPC и React Query для прежнего Vite-клиента. */
import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { makeTrpcClient, trpc } from "./trpc";

/** Создаёт клиенты один раз на mount и сохраняет прежнюю политику кеша 30 секунд; изоляция кеша по аккаунтам нового клиента здесь не реализована. */
export default function TrpcGate({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
      }),
  );
  const [client] = useState(() => makeTrpcClient());

  return (
    <trpc.Provider client={client} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
