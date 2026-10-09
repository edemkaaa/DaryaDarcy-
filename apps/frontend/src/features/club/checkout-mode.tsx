"use client";
import type { ReactNode } from "react";
import { useScreenActive } from "@/shared/navigation/screen-activity";
import { trpc } from "@/shared/api/trpc";
import { ScreenContainer } from "@/shared/ui/screen-container";
import { ClubTestCheckoutResult } from "./checkout-result";
import { useAuth } from "@/domain/session/session-context";
import { getClubPaymentMode } from "./payment-mode";
import { ProdamusReturnDialog } from "./prodamus-return-dialog";

export function ClubCheckoutMode({ children }: { children: ReactNode }) {
  // Direct lookup is inlined by Next at build time. URL/storage cannot opt in.
  const mode = getClubPaymentMode();
  if (mode === "live") return children;
  if (mode === "prodamus-test")
    return (
      <>
        {children}
        <ProdamusReturnDialog />
      </>
    );
  if (mode === "unavailable")
    return (
      <ScreenContainer>
        <p role="alert">Оплата временно недоступна.</p>
      </ScreenContainer>
    );
  return <TestCheckoutScreen />;
}

function TestCheckoutScreen() {
  const active = useScreenActive();
  const { client } = trpc.useUtils();
  const { user, loading, error, refreshError, isAuthenticated } = useAuth();
  return (
    <ScreenContainer>
      <ClubTestCheckoutResult
        client={client}
        active={active}
        purchase={{
          sessionReady:
            !loading &&
            !error &&
            !refreshError &&
            (!isAuthenticated || Boolean(user?.email)),
          accountEmail: user?.email ?? null,
        }}
      />
    </ScreenContainer>
  );
}
