"use client";
import { Suspense, useState, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createAppQueryClient } from "@/shared/api/query-client";
import { trpc, createTRPCClient } from "@/shared/api/trpc";
import { AuthProvider } from "@/domain/session/session-context";
import { ClubProvider } from "@/domain/subscription/subscription-context";
import { ThemeProvider } from "@/shared/styles/theme-provider";
import { InstallGuide } from "@/features/pwa/install-guide";
import { WebPostAlerts } from "@/features/pwa/web-post-alerts";
import { ViewportSync } from "@/shared/browser/viewport";
import { BackgroundCheckNotice } from "@/domain/session/background-check-notice";
import { BackgroundNoticeProvider } from "@/shared/ui/background-notice";
import TabShell from "./tab-shell";
import { NavigationHistory } from "@/shared/navigation/history";
import { TouchPressGuard } from "@/shared/browser/touch-press-guard";
export default function Providers({
  children,
  initialHomeDate,
}: {
  children: ReactNode;
  initialHomeDate: string;
}) {
  const [queryClient] = useState(createAppQueryClient);
  const [client] = useState(createTRPCClient);
  return (
    <ThemeProvider>
      <trpc.Provider client={client} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <Suspense fallback={null}>
            <NavigationHistory />
          </Suspense>
          <TouchPressGuard />
          <AuthProvider>
            <ClubProvider>
              <BackgroundNoticeProvider>
                <ViewportSync />
                <TabShell initialHomeDate={initialHomeDate}>
                  {children}
                </TabShell>
                <InstallGuide />
                <WebPostAlerts />
                <BackgroundCheckNotice />
              </BackgroundNoticeProvider>
            </ClubProvider>
          </AuthProvider>
        </QueryClientProvider>
      </trpc.Provider>
    </ThemeProvider>
  );
}
