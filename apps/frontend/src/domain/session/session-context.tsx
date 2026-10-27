"use client";
import {
  createContext,
  Fragment,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { LaunchCapabilities } from "@shared/capabilities";
import { APP_CAPABILITIES_QUERY_KEY } from "@/shared/api/capabilities";
import * as Api from "@/shared/api/auth";
import type { User } from "./storage";
import { discardLegacyCredentials } from "@/shared/api/token-storage";
import { isOwnerUser } from "@/shared/config/api";
import { setPersonalDataOwner } from "@/shared/browser/storage";
import { cancelSessionRequests } from "@/shared/api/request-lifecycle";
import { subscribeSessionChecks } from "@/shared/api/session-events";
import {
  SessionController,
  type ConfirmedProfilePatch,
  type SessionStatus,
} from "./session-controller";

const SESSION_EVENT_KEY = "darcy:session-change";
const LOGOUT_PENDING_KEY = "darcy:logout-pending";
const RESUME_CHECK_COOLDOWN_MS = 1000;
function logoutIsPending(): boolean {
  try {
    return window.localStorage.getItem(LOGOUT_PENDING_KEY) === "true";
  } catch {
    return false;
  }
}
type SessionContext = {
  user: User | null;
  status: SessionStatus;
  loading: boolean;
  error: Error | null;
  refreshError: Error | null;
  isAuthenticated: boolean;
  isOwner: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  authenticate: (
    request: (signal: AbortSignal) => Promise<{ user: Api.AuthUser }>,
  ) => Promise<boolean>;
  applySession: (user: Api.AuthUser | null) => Promise<void>;
  reconcileProfile: (
    ownerId: number,
    user: Api.AuthUser | null,
  ) => Promise<boolean>;
  confirmProfileUpdate: (
    ownerId: number,
    patch: ConfirmedProfilePatch,
  ) => boolean;
  invalidateAccess: (resetScreens?: boolean) => void;
};
const Context = createContext<SessionContext | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const cache = useQueryClient();
  const [controller] = useState(
    () =>
      new SessionController({
        getMe: Api.getMe,
        logout: Api.logout,
        resetIdentity: (owner) => {
          const publicCapabilities = cache.getQueryState<LaunchCapabilities>(
            APP_CAPABILITIES_QUERY_KEY,
          );
          cancelSessionRequests();
          void cache.cancelQueries();
          cache.clear();
          // These switches describe the deployment, not the account. Keep only
          // a completed, valid public read, without extending its freshness.
          if (
            publicCapabilities?.status === "success" &&
            publicCapabilities.fetchStatus === "idle" &&
            !publicCapabilities.isInvalidated
          )
            cache.setQueryData(
              APP_CAPABILITIES_QUERY_KEY,
              publicCapabilities.data,
              { updatedAt: publicCapabilities.dataUpdatedAt },
            );
          setPersonalDataOwner(owner);
          discardLegacyCredentials();
        },
        broadcast: () => {
          try {
            window.localStorage.setItem(SESSION_EVENT_KEY, crypto.randomUUID());
          } catch {
            /* Cross-tab coordination is optional when storage is unavailable. */
          }
        },
        setLogoutPending: (pending) => {
          try {
            if (pending)
              window.localStorage.setItem(LOGOUT_PENDING_KEY, "true");
            else window.localStorage.removeItem(LOGOUT_PENDING_KEY);
          } catch {
            /* Local session state still prevents unsafe continuation. */
          }
        },
      }),
  );
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  );
  const user = useMemo(
    () =>
      state.status === "authenticated" && state.user
        ? { ...state.user, lastSignedIn: new Date(state.user.lastSignedIn) }
        : null,
    [state.status, state.user],
  );
  useEffect(() => {
    discardLegacyCredentials();
    setPersonalDataOwner(null);
    const recheck = () => {
      if (logoutIsPending()) void controller.logout();
      else void controller.refresh();
    };
    let lastResumeCheck = -Infinity;
    const onResume = () => {
      if (document.visibilityState !== "visible") return;
      const now = performance.now();
      // A single return can emit both events even after a fast response has
      // finished. Initial, online, storage and access-error checks bypass this.
      if (now - lastResumeCheck < RESUME_CHECK_COOLDOWN_MS) return;
      lastResumeCheck = now;
      recheck();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== SESSION_EVENT_KEY && event.key !== LOGOUT_PENDING_KEY)
        return;
      if (logoutIsPending()) void controller.logout();
      else {
        controller.completeExternalLogout();
        if (controller.getSnapshot().status === "authenticated")
          controller.verifyAfterAccessError(401);
        else void controller.refresh(true);
      }
    };
    const unsubscribe = subscribeSessionChecks(
      controller.verifyAfterAccessError,
    );
    window.addEventListener("focus", onResume);
    window.addEventListener("online", recheck);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onResume);
    recheck();
    return () => {
      unsubscribe();
      window.removeEventListener("focus", onResume);
      window.removeEventListener("online", recheck);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onResume);
      controller.dispose();
    };
  }, [controller]);
  const value = useMemo(
    () => ({
      user,
      status: state.status,
      loading: state.status === "checking" || state.status === "logging-out",
      error: state.error,
      refreshError: state.refreshError,
      isAuthenticated: Boolean(user),
      isOwner: isOwnerUser(user),
      refresh: controller.refresh,
      logout: controller.logout,
      authenticate: controller.authenticate,
      applySession: controller.applySession,
      reconcileProfile: controller.reconcileProfile,
      confirmProfileUpdate: controller.confirmProfileUpdate,
      invalidateAccess: controller.invalidateAccess,
    }),
    [user, state.status, state.error, state.refreshError, controller],
  );
  return (
    <Context.Provider value={value}>
      <Fragment key={state.scope}>{children}</Fragment>
    </Context.Provider>
  );
}
export function useAuth(_options?: { autoFetch?: boolean }) {
  const value = useContext(Context);
  if (!value) throw new Error("Session provider is missing");
  return value;
}
