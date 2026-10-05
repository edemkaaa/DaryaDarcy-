"use client";
import { useState, type ReactNode } from "react";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { getHttpStatus, shouldRetryQuery } from "@/shared/api/errors";
import { requestSessionCheck } from "@/shared/api/session-events";
import { trpc, createTRPCClient } from "@/shared/api/trpc";
import { AuthProvider } from "@/domain/session/session-context";
import { ClubProvider } from "@/domain/subscription/subscription-context";
import { ThemeProvider } from "@/shared/styles/theme-provider";
import { InstallGuide } from "@/features/pwa/install-guide";
import { WebPostAlerts } from "@/features/pwa/web-post-alerts";
import { ViewportSync } from "@/shared/browser/viewport";
export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            const status = getHttpStatus(error);
            if (status === 401 || status === 403) requestSessionCheck(status);
          },
        }),
        mutationCache: new MutationCache({
          onError: (error) => {
            const status = getHttpStatus(error);
            if (status === 401 || status === 403) requestSessionCheck(status);
          },
        }),
        defaultOptions: {
          queries: { refetchOnWindowFocus: false, retry: shouldRetryQuery },
          mutations: { retry: false },
        },
      }),
  );
  const [client] = useState(createTRPCClient);
  return (
    <ThemeProvider>
      <trpc.Provider client={client} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ClubProvider>
              <ViewportSync />
              {children}
              <InstallGuide />
              <WebPostAlerts />
            </ClubProvider>
          </AuthProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </ThemeProvider>
  );
}
