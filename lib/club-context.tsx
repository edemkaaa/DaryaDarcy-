import { useCallback, useContext, useEffect, useMemo, createContext, type ReactNode } from "react";

import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

interface ClubContextType {
  isSubscribed: boolean;
  setIsSubscribed: (value: boolean) => void;
  refreshSubscription: () => void;
  expiresAt: Date | null;
  cancelAtPeriodEnd: boolean;
  isOwner: boolean;
  monthlyPrice: string;
}

const ClubContext = createContext<ClubContextType>({
  isSubscribed: false,
  setIsSubscribed: () => {},
  refreshSubscription: () => {},
  expiresAt: null,
  cancelAtPeriodEnd: false,
  isOwner: false,
  monthlyPrice: "790",
});

export function ClubProvider({ children }: { children: ReactNode }) {
  const { user, isOwner } = useAuth();
  const utils = trpc.useUtils();
  const subscription = trpc.club.subscription.useQuery(undefined, {
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    void utils.club.subscription.invalidate();
  }, [user?.id]);

  const refreshSubscription = useCallback(() => {
    void utils.club.subscription.invalidate();
  }, [utils]);

  const isSubscribed = isOwner || Boolean(subscription.data?.subscribed);
  const setIsSubscribed = useCallback((_value: boolean) => {
    void utils.club.subscription.invalidate();
  }, [utils]);
  const expiresAt = subscription.data?.expiresAt ? new Date(subscription.data.expiresAt) : null;
  const cancelAtPeriodEnd = Boolean(subscription.data?.cancelAtPeriodEnd);
  const monthlyPrice = subscription.data?.monthlyPrice || "790";

  const value = useMemo(
    () => ({
      isSubscribed,
      setIsSubscribed,
      refreshSubscription,
      expiresAt,
      cancelAtPeriodEnd,
      isOwner,
      monthlyPrice,
    }),
    [isSubscribed, setIsSubscribed, refreshSubscription, expiresAt, cancelAtPeriodEnd, isOwner, monthlyPrice],
  );

  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClub() {
  return useContext(ClubContext);
}
