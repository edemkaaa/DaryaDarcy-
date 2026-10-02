import * as Api from "@/lib/_core/api";
import * as Auth from "@/lib/_core/auth";
import { isOwnerUser } from "@/constants/oauth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import { registerPushToken } from "@/lib/register-push";

type UseAuthOptions = {
  autoFetch?: boolean;
};

type AuthContextValue = {
  user: Auth.User | null;
  loading: boolean;
  error: Error | null;
  isAuthenticated: boolean;
  isOwner: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  applySession: (apiUser: Api.AuthUser | null) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapApiUser(apiUser: Api.AuthUser): Auth.User {
  return {
    id: apiUser.id,
    openId: apiUser.openId,
    name: apiUser.name,
    email: apiUser.email,
    phone: apiUser.phone ?? null,
    loginMethod: apiUser.loginMethod,
    gender: apiUser.gender ?? null,
    avatarUrl: apiUser.avatarUrl ?? null,
    lastSignedIn: new Date(apiUser.lastSignedIn),
    role: apiUser.role || "user",
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Auth.User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const applySession = useCallback(async (apiUser: Api.AuthUser | null) => {
    if (!apiUser) {
      setUser(null);
      await Auth.clearUserInfo();
      return;
    }
    const userInfo = mapApiUser(apiUser);
    setUser(userInfo);
    await Auth.setUserInfo(userInfo);
    void registerPushToken();
  }, []);

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (Platform.OS === "web") {
        const apiUser = await Api.getMe();
        if (apiUser) {
          await applySession(apiUser);
        } else {
          setUser(null);
          await Auth.clearUserInfo();
          await Auth.removeSessionToken();
        }
      } else {

        const sessionToken = await Auth.getSessionToken();
        if (!sessionToken) {
          setUser(null);
        } else {
          const cachedUser = await Auth.getUserInfo();
          setUser(cachedUser);
        }
      }
    } catch (err) {
      const nextError = err instanceof Error ? err : new Error("Failed to fetch user");
      setError(nextError);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  const logout = useCallback(async () => {
    try {
      await Api.logout();
    } catch (err) {
      console.error("[Auth] Logout API call failed:", err);
    } finally {
      await Auth.removeSessionToken();
      await Auth.clearUserInfo();
      setUser(null);
      setError(null);
    }
  }, []);

  const isAuthenticated = useMemo(() => Boolean(user), [user]);
  const isOwner = useMemo(() => isOwnerUser(user), [user]);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      isAuthenticated,
      isOwner,
      refresh: fetchUser,
      logout,
      applySession,
    }),
    [user, loading, error, isAuthenticated, isOwner, fetchUser, logout, applySession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(_options?: UseAuthOptions) {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
