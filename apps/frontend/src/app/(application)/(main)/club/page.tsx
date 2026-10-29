import type { Metadata } from "next";
import { Suspense } from "react";
import Screen from "@/features/club/club-screen";
import RouteLoading from "@/shared/ui/route-loading";
export const metadata: Metadata = { title: "Клуб Darcy" };
export default function Page() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Screen />
    </Suspense>
  );
}
