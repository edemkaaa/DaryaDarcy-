"use client";
import type { ReactNode } from "react";
import { useScreenActive } from "@/shared/navigation/screen-activity";
import { trpc } from "@/shared/api/trpc";
import { ScreenContainer } from "@/shared/ui/screen-container";
import { ClubTestCheckoutResult } from "./checkout-result";

export function ClubCheckoutMode({ children }: { children: ReactNode }) {
  // Direct lookup is inlined by Next at build time. URL/storage cannot opt in.
  const flag = process.env.NEXT_PUBLIC_CLUB_TEST_CHECKOUT;
  if (flag === undefined || flag === "" || flag === "false") return children;
  if (flag !== "true")
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
  return (
    <ScreenContainer>
      <ClubTestCheckoutResult client={client} active={active} />
    </ScreenContainer>
  );
}
