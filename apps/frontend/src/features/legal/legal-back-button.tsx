"use client";
import { useRouter } from "@/shared/navigation/router";
import { Action } from "@/shared/ui/action";
import type { ReactNode } from "react";
export function LegalBackButton({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const router = useRouter();
  return (
    <Action onClick={() => router.back()} className={className}>
      {children}
    </Action>
  );
}
