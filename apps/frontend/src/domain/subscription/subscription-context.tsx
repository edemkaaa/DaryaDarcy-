"use client";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
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
  hasClubAccess: boolean;
  hasServiceAccess: boolean;
  isSubscribed: boolean;
  setIsSubscribed: (value: boolean) => void;
  refreshSubscription: () => Promise<void>;
  expiresAt: Date | null;
  cancelAtPeriodEnd: boolean;
  cancellationStatus: "none" | "pending" | "confirmed";
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
  const [now, setNow] = useState(() => Date.now());
  const staff = user?.role === "admin" || user?.role === "moderator";
  const deadline =
    user &&
    !staff &&
    subscription.data?.hasClubAccess === true &&
    subscription.data.subscribed === true
      ? (subscription.data.expiresAt?.getTime() ?? null)
      : null;
  const expired = deadline !== null && now >= deadline;
  useEffect(() => {
    if (deadline === null) return;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      clearTimeout(timer);
      const time = Date.now();
      setNow(time);
      if (time >= deadline) void refetchSubscription();
      else timer = setTimeout(check, Math.min(deadline - time, 2_147_483_647));
    };
    const visible = () => {
      if (!document.hidden) check();
    };
    timer = setTimeout(
      check,
      Math.min(Math.max(0, deadline - Date.now()), 2_147_483_647),
    );
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [deadline, refetchSubscription]);
  const refreshSubscription = useCallback(async () => {
    if (user) await refetchSubscription();
  }, [user, refetchSubscription]);
  const hasConfirmedData =
    typeof subscription.data?.hasClubAccess === "boolean" &&
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
      : expired
        ? subscription.isError
          ? "error"
          : "checking"
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
    hasClubAccess: status === "active",
    hasServiceAccess:
      status === "active" &&
      !isOwner &&
      subscription.data?.subscribed === false,
    isSubscribed:
      status === "active" &&
      (isOwner || subscription.data?.subscribed === true),
    setIsSubscribed: refreshSubscription,
    refreshSubscription,
    expiresAt,
    cancelAtPeriodEnd:
      status === "active" && subscription.data?.cancelAtPeriodEnd === true,
    cancellationStatus:
      user && hasConfirmedData
        ? (subscription.data?.cancellationStatus ?? "none")
        : "none",
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
