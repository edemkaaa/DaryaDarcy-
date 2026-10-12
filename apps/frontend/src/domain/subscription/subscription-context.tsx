"use client";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  createContext,
  type ReactNode,
} from "react";
import { useAuth } from "@/domain/session/session-context";
import { trpc } from "@/shared/api/trpc";
import { isTemporaryRequestError, shouldRetryQuery } from "@/shared/api/errors";
import { parseClubAccess } from "@/shared/api/club-access";
export type SubscriptionStatus =
  | "guest"
  | "checking"
  | "active"
  | "inactive"
  | "error";
interface ClubContextType {
  status: SubscriptionStatus;
  error: unknown;
  refreshError: unknown;
  /** Legacy content gate; billing UI must also distinguish service access. */
  isSubscribed: boolean;
  hasServiceAccess: boolean;
  setIsSubscribed: (value: boolean) => void;
  refreshSubscription: () => Promise<void>;
  expiresAt: Date | null;
  cancelAtPeriodEnd: boolean;
  isOwner: boolean;
  monthlyPrice: string;
}
const ClubContext = createContext<ClubContextType | null>(null);
export function ClubProvider({ children }: { children: ReactNode }) {
  const { user, isOwner, invalidateAccess } = useAuth();
  const subscription = trpc.club.subscription.useQuery(undefined, {
    enabled: Boolean(user),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: shouldRetryQuery,
    select: parseClubAccess,
  });
  const refetchSubscription = subscription.refetch;
  const refreshSubscription = useCallback(async () => {
    if (user) await refetchSubscription();
  }, [user, refetchSubscription]);
  const hasConfirmedData =
    typeof subscription.data?.subscribed === "boolean" &&
    typeof subscription.data?.cancelAtPeriodEnd === "boolean";
  const backgroundFailure =
    hasConfirmedData &&
    subscription.isError &&
    isTemporaryRequestError(subscription.error);
  const status: SubscriptionStatus = !user
    ? "guest"
    : isOwner
      ? "active"
      : subscription.isError && !backgroundFailure
        ? "error"
        : subscription.isPending
          ? "checking"
          : !hasConfirmedData
            ? "error"
            : subscription.data?.hasClubAccess === true
              ? "active"
              : "inactive";
  const wasActive = useRef(false);
  useEffect(() => {
    if (wasActive.current && status !== "active")
      invalidateAccess(status !== "error");
    wasActive.current = status === "active";
  }, [status, invalidateAccess]);
  const expiration = status === "active" ? subscription.data?.expiresAt : null;
  const expiresAt = useMemo(() => {
    if (!expiration) return null;
    const parsed = new Date(expiration);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }, [expiration]);
  const value: ClubContextType = {
    status,
    error: subscription.error,
    refreshError:
      user && !isOwner && backgroundFailure ? subscription.error : null,
    isSubscribed: status === "active",
    hasServiceAccess:
      status === "active" &&
      !isOwner &&
      subscription.data?.subscribed === false,
    setIsSubscribed: refreshSubscription,
    refreshSubscription,
    expiresAt,
    cancelAtPeriodEnd:
      status === "active" && subscription.data?.cancelAtPeriodEnd === true,
    isOwner,
    monthlyPrice:
      typeof subscription.data?.monthlyPrice === "string"
        ? subscription.data.monthlyPrice
        : "790",
  };
  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}
export function useClub() {
  const value = useContext(ClubContext);
  if (!value) throw new Error("Subscription provider is missing");
  return value;
}
